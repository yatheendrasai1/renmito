package com.renmito.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;

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

    static final String ACTION_SMS_PARSED = "com.renmito.app.SMS_PARSED";

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
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) return;

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        String format = bundle.getString("format");
        if (pdus == null) return;

        for (Object pdu : pdus) {
            SmsMessage sms = SmsMessage.createFromPdu((byte[]) pdu, format);
            if (sms == null) continue;

            String sender = sms.getDisplayOriginatingAddress();
            String body   = sms.getMessageBody();

            // Only process messages that look transactional
            if (!TXN_PATTERN.matcher(body).find()) continue;

            JSONObject parsed = parseTransaction(body, sender);
            if (parsed == null) continue;

            // Forward to SmsPlugin via a local Intent (caught by SmsPlugin's receiver)
            Intent forward = new Intent(ACTION_SMS_PARSED);
            forward.putExtra("json", parsed.toString());
            context.sendBroadcast(forward);
        }
    }

    // ─── Parser ──────────────────────────────────────────────────────────────

    private JSONObject parseTransaction(String body, String sender) {
        Matcher amountMatcher = AMOUNT_PATTERN.matcher(body);
        if (!amountMatcher.find()) return null;

        double amount;
        try {
            String raw = amountMatcher.group(1).replace(",", "");
            amount = Double.parseDouble(raw);
        } catch (Exception e) {
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
