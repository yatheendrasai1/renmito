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
 */
public class SmsBroadcastReceiver extends BroadcastReceiver {

    private static final String TAG = "RenmitoSMS";

    static final String ACTION_SMS_PARSED = "com.renmito.app.SMS_PARSED";
    static final String ACTION_SMS_RAW    = "com.renmito.app.SMS_RAW";

    // Matches patterns like "debited by Rs.1,234.56", "INR 2500 debited", "spent Rs 450"
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
            "(?:rs\\.?|inr|₹)\\s*([\\d,]+(?:\\.\\d{1,2})?)",
            Pattern.CASE_INSENSITIVE
    );

    // Matches "transaction reference", "txn id", "ref no", "utr"
    private static final Pattern REF_PATTERN = Pattern.compile(
            "(?:txn(?:\\s+id)?|ref(?:\\s+no)?|utr|transaction(?:\\s+id)?)\\s*[:#]?\\s*([A-Z0-9]{6,24})",
            Pattern.CASE_INSENSITIVE
    );

    // Known transaction keywords
    private static final Pattern TXN_PATTERN = Pattern.compile(
            "debited|deducted|paid|spent|transferred|purchase|payment|charged|withdrawn",
            Pattern.CASE_INSENSITIVE
    );

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "onReceive fired, action=" + intent.getAction());

        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) return;

        Bundle bundle = intent.getExtras();
        if (bundle == null) { Log.w(TAG, "bundle is null, ignoring"); return; }

        Object[] pdus = (Object[]) bundle.get("pdus");
        String format = bundle.getString("format");
        if (pdus == null) { Log.w(TAG, "pdus is null, ignoring"); return; }

        Log.d(TAG, "SMS received, pdu count=" + pdus.length);

        for (Object pdu : pdus) {
            SmsMessage sms = SmsMessage.createFromPdu((byte[]) pdu, format);
            if (sms == null) { Log.w(TAG, "createFromPdu returned null"); continue; }

            String sender = sms.getDisplayOriginatingAddress();
            String body   = sms.getMessageBody();

            Log.d(TAG, "SMS from=" + sender + " body_len=" + (body != null ? body.length() : 0) + " body=" + body);

            // Always forward every SMS as a raw event so the test log can capture it
            try {
                JSONObject raw = new JSONObject();
                raw.put("body",      body);
                raw.put("sender",    sender != null ? sender : "");
                raw.put("timestamp", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(new Date()));
                Intent rawIntent = new Intent(ACTION_SMS_RAW);
                rawIntent.putExtra("json", raw.toString());
                context.sendBroadcast(rawIntent);
                Log.d(TAG, "ACTION_SMS_RAW broadcast sent for body: " + body);
            } catch (Exception e) {
                Log.e(TAG, "Failed to send ACTION_SMS_RAW: " + e.getMessage());
            }

            boolean isTestPhrase = body.toLowerCase(Locale.ROOT).contains("zero eg");
            boolean isTxn        = TXN_PATTERN.matcher(body).find();
            Log.d(TAG, "isTestPhrase=" + isTestPhrase + " isTxn=" + isTxn);

            // Drop messages that are neither transactional nor the test phrase
            if (!isTxn && !isTestPhrase) {
                Log.d(TAG, "Not transactional and not test phrase — skipping ACTION_SMS_PARSED");
                continue;
            }

            JSONObject parsed = parseTransaction(body, sender, isTestPhrase);
            if (parsed == null) { Log.w(TAG, "parseTransaction returned null"); continue; }

            // Forward parsed transaction to SmsPlugin
            Intent forward = new Intent(ACTION_SMS_PARSED);
            forward.putExtra("json", parsed.toString());
            context.sendBroadcast(forward);
            Log.d(TAG, "ACTION_SMS_PARSED broadcast sent");
        }
    }

    // ─── Parser ──────────────────────────────────────────────────────────────

    private JSONObject parseTransaction(String body, String sender, boolean isTestPhrase) {
        Matcher amountMatcher = AMOUNT_PATTERN.matcher(body);
        double amount = 0;
        if (amountMatcher.find()) {
            try {
                amount = Double.parseDouble(amountMatcher.group(1).replace(",", ""));
            } catch (Exception ignored) {}
        } else if (!isTestPhrase) {
            // Real transactions must have a parseable amount; test phrases don't
            return null;
        }

        String reference = "";
        Matcher refMatcher = REF_PATTERN.matcher(body);
        if (refMatcher.find()) reference = refMatcher.group(1);

        String merchant = extractMerchant(body);
        String dateStr  = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());

        try {
            JSONObject obj = new JSONObject();
            obj.put("amount",        amount);
            obj.put("currency",      "INR");
            obj.put("merchant",      merchant);
            obj.put("category",      "Uncategorized");
            obj.put("date",          dateStr);
            obj.put("entryType",     "automatic");
            obj.put("smsRaw",        body);
            obj.put("smsSender",     sender != null ? sender : "");
            obj.put("referenceId",   reference);
            obj.put("paymentMethod", detectPaymentMethod(body));
            obj.put("isTestPhrase",  isTestPhrase);
            return obj;
        } catch (Exception e) {
            return null;
        }
    }

    private String extractMerchant(String body) {
        // Try "at <Merchant>" / "to <Merchant>" patterns
        Pattern atPat = Pattern.compile("(?:at|to)\\s+([A-Za-z][A-Za-z0-9\\s&.'-]{1,30}?)(?:\\s+on|\\s+via|\\s+ref|\\.|,|$)", Pattern.CASE_INSENSITIVE);
        Matcher m = atPat.matcher(body);
        if (m.find()) {
            return m.group(1).trim();
        }
        return "";
    }

    private String detectPaymentMethod(String body) {
        String lower = body.toLowerCase(Locale.ROOT);
        if (lower.contains("upi"))                    return "UPI";
        if (lower.contains("credit card"))            return "Credit Card";
        if (lower.contains("debit card"))             return "Debit Card";
        if (lower.contains("net banking") || lower.contains("netbanking")) return "Net Banking";
        if (lower.contains("wallet"))                 return "Wallet";
        if (lower.contains("neft") || lower.contains("imps") || lower.contains("rtgs")) return "Net Banking";
        return "";
    }
}
