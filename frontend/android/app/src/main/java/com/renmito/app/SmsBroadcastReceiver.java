package com.renmito.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Receives android.provider.Telephony.SMS_RECEIVED broadcasts and forwards
 * transactional messages to SmsPlugin via a local broadcast so the WebView
 * can pick them up without launching a full Activity.
 *
 * Only two categories of SMS are forwarded:
 *   1. Messages matching TXN_PATTERN (real bank/UPI transactions)
 *   2. Messages containing "zero eg" (test phrase for manual verification)
 * All other SMS are silently ignored.
 */
public class SmsBroadcastReceiver extends BroadcastReceiver {

    private static final String TAG = "RenmitoSMS";

    static final String ACTION_SMS_PARSED = "com.renmito.app.SMS_PARSED";

    // Debit/credit transaction keywords — covers HDFC, IDFC and common bank patterns
    private static final Pattern TXN_PATTERN = Pattern.compile(
        "\\bdebited\\b|\\bcredited\\b|\\bspent\\b|sent\\s+rs|\\brefunded\\b|credit\\s+alert" +
        "|\\bdeducted\\b|\\bpaid\\b|\\btransferred\\b|\\bpurchase\\b|\\bpayment\\b|\\bcharged\\b|\\bwithdrawn\\b",
        Pattern.CASE_INSENSITIVE
    );

    // Determines if the transaction is a credit (inflow) vs debit (outflow)
    private static final Pattern CREDIT_PATTERN = Pattern.compile(
        "\\bcredited\\b|credit\\s+alert|\\brefunded\\b|\\breceived\\b",
        Pattern.CASE_INSENSITIVE
    );

    // Matches: Rs.312.61 / Rs. 1500.00 / Rs. 60,740.00 / INR 491.00 / ₹500
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
        "(?:rs\\.?\\s*|inr\\s*|₹\\s*)([\\d,]+(?:\\.\\d{1,2})?)",
        Pattern.CASE_INSENSITIVE
    );

    // Matches: Ref 256270695080 / RRN 609168171796 / UPI Ref No. 122460070572 / UPI 754973861386
    private static final Pattern REF_PATTERN = Pattern.compile(
        "(?:upi\\s+ref(?:\\s+no\\.?)?|rrn|ref(?:\\s+no\\.?)?|upi|txn(?:\\s+id)?|utr)\\s*[:#.]?\\s*([0-9]{10,20})",
        Pattern.CASE_INSENSITIVE
    );

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "onReceive fired, action=" + intent.getAction());

        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) return;

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        String format = bundle.getString("format");
        if (pdus == null) return;

        Log.d(TAG, "SMS received, pdu count=" + pdus.length);

        for (Object pdu : pdus) {
            SmsMessage sms = SmsMessage.createFromPdu((byte[]) pdu, format);
            if (sms == null) continue;

            String sender = sms.getDisplayOriginatingAddress();
            String body   = sms.getMessageBody();
            if (body == null) continue;

            boolean isTestPhrase = body.toLowerCase(Locale.ROOT).contains("zero eg");
            boolean isTxn        = TXN_PATTERN.matcher(body).find();
            Log.d(TAG, "SMS from=" + sender + " isTxn=" + isTxn + " isTestPhrase=" + isTestPhrase);

            if (!isTxn && !isTestPhrase) continue;

            JSONObject parsed = parseTransaction(body, sender, isTestPhrase);
            if (parsed == null) continue;

            Intent forward = new Intent(ACTION_SMS_PARSED);
            forward.setPackage(context.getPackageName());
            forward.putExtra("json", parsed.toString());
            context.sendBroadcast(forward);
            Log.d(TAG, "ACTION_SMS_PARSED broadcast sent");
        }
    }

    private JSONObject parseTransaction(String body, String sender, boolean isTestPhrase) {
        Matcher amountMatcher = AMOUNT_PATTERN.matcher(body);
        double amount = 0;
        if (amountMatcher.find()) {
            try {
                amount = Double.parseDouble(amountMatcher.group(1).replace(",", ""));
            } catch (Exception ignored) {}
        } else if (!isTestPhrase) {
            return null;
        }

        String reference = "";
        Matcher refMatcher = REF_PATTERN.matcher(body);
        if (refMatcher.find()) reference = refMatcher.group(1);

        boolean isCredit = CREDIT_PATTERN.matcher(body).find();
        String merchant  = extractMerchant(body);
        String dateStr   = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());

        try {
            JSONObject obj = new JSONObject();
            obj.put("amount",          amount);
            obj.put("currency",        "INR");
            obj.put("merchant",        merchant);
            obj.put("category",        "Uncategorized");
            obj.put("date",            dateStr);
            obj.put("entryType",       "automatic");
            obj.put("transactionType", isCredit ? "credit" : "debit");
            obj.put("smsRaw",          body);
            obj.put("smsSender",       sender != null ? sender : "");
            obj.put("referenceId",     reference);
            obj.put("paymentMethod",   detectPaymentMethod(body));
            obj.put("isTestPhrase",    isTestPhrase);
            return obj;
        } catch (Exception e) {
            return null;
        }
    }

    private String extractMerchant(String body) {
        // Multiline UPI format: "Sent Rs.X\nFrom ...\nTo MERCHANT\nOn..."
        Pattern toPat = Pattern.compile("^To\\s+(.+?)\\s*$", Pattern.MULTILINE | Pattern.CASE_INSENSITIVE);
        Matcher m = toPat.matcher(body);
        if (m.find()) return m.group(1).trim();

        // "at Swiggy Limited on 16 MAY" — stop before on/via/ref/avbl/punctuation
        Pattern atPat = Pattern.compile(
            "(?:^|\\s)at\\s+([A-Za-z][A-Za-z0-9\\s&.'-]{1,40}?)(?:\\s+on|\\s+via|\\s+ref|\\s+avbl|\\.|,|$)",
            Pattern.CASE_INSENSITIVE
        );
        m = atPat.matcher(body);
        if (m.find()) return m.group(1).trim();

        // "from VPA user@bank" or "from user@bank" — credit/received
        Pattern vpaPat = Pattern.compile("from\\s+(?:vpa\\s+)?(\\S+@\\S+)", Pattern.CASE_INSENSITIVE);
        m = vpaPat.matcher(body);
        if (m.find()) return m.group(1).trim();

        return "";
    }

    private String detectPaymentMethod(String body) {
        String lower = body.toLowerCase(Locale.ROOT);
        if (lower.contains("credit card"))  return "Credit Card";
        if (lower.contains("debit card"))   return "Debit Card";
        if (lower.contains("upi") || lower.contains("vpa"))
                                             return "UPI";
        if (lower.contains("neft") || lower.contains("imps") || lower.contains("rtgs") || lower.contains("rrn"))
                                             return "Net Banking";
        if (lower.contains("wallet"))        return "Wallet";
        return "";
    }
}
