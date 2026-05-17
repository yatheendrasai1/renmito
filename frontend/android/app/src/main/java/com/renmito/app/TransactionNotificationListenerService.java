package com.renmito.app;

import android.app.Notification;
import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * System-level notification listener. Reads the title + body of every incoming
 * notification, checks it for transaction patterns, and forwards parsed data to
 * NotificationPlugin via a local broadcast.
 *
 * The user must grant notification access manually at:
 *   Settings → Notifications → Notification access → Renmito
 *
 * Forwarding is gated by a static flag set by NotificationPlugin so that we only
 * process and forward when the JS layer has explicitly called startListening().
 */
public class TransactionNotificationListenerService extends NotificationListenerService {

    static final String ACTION_NOTIFICATION_PARSED = "com.renmito.app.NOTIFICATION_PARSED";

    /** Toggled by NotificationPlugin.startListening() / stopListening(). */
    static volatile boolean forwardingEnabled = false;

    // Matches amounts like "Rs.1,234.56", "INR 2500", "₹450"
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
            "(?:rs\\.?|inr|₹)\\s*([\\d,]+(?:\\.\\d{1,2})?)",
            Pattern.CASE_INSENSITIVE
    );

    // Matches "txn id", "ref no", "utr" etc.
    private static final Pattern REF_PATTERN = Pattern.compile(
            "(?:txn(?:\\s+id)?|ref(?:\\s+no)?|utr|transaction(?:\\s+id)?)\\s*[:#]?\\s*([A-Z0-9]{6,24})",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern TXN_PATTERN = Pattern.compile(
            "debited|deducted|paid|spent|transferred|purchase|payment|charged|withdrawn",
            Pattern.CASE_INSENSITIVE
    );

    // "zero eg" test phrase — forwarded regardless of TXN_PATTERN when test mode is on
    static final String TEST_PHRASE = "zero eg";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (!forwardingEnabled) return;
        if (sbn == null) return;

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textCs  = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

        String title = titleCs != null ? titleCs.toString() : "";
        String text  = bigText != null ? bigText.toString() : (textCs != null ? textCs.toString() : "");
        String full  = (title + " " + text).trim();

        if (full.isEmpty()) return;

        String pkg = sbn.getPackageName();

        // Determine if this is a test-phrase notification
        boolean isTestPhrase = full.toLowerCase(Locale.ROOT).contains(TEST_PHRASE);

        // Skip non-transactional, non-test notifications
        if (!TXN_PATTERN.matcher(full).find() && !isTestPhrase) return;

        JSONObject parsed = buildPayload(full, pkg, isTestPhrase);
        if (parsed == null) return;

        Intent broadcast = new Intent(ACTION_NOTIFICATION_PARSED);
        broadcast.putExtra("json", parsed.toString());
        sendBroadcast(broadcast);
    }

    // ─── Parser ──────────────────────────────────────────────────────────────

    private JSONObject buildPayload(String text, String source, boolean isTestPhrase) {
        double amount = 0;
        boolean hasAmount = false;

        Matcher amtM = AMOUNT_PATTERN.matcher(text);
        if (amtM.find()) {
            try {
                amount = Double.parseDouble(amtM.group(1).replace(",", ""));
                hasAmount = true;
            } catch (Exception ignored) {}
        }

        // For non-test notifications without a parseable amount, skip
        if (!hasAmount && !isTestPhrase) return null;

        String reference = "";
        Matcher refM = REF_PATTERN.matcher(text);
        if (refM.find()) reference = refM.group(1);

        String merchant = extractMerchant(text);
        String dateStr  = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        String payMethod = detectPaymentMethod(text);

        try {
            JSONObject obj = new JSONObject();
            obj.put("amount",         amount);
            obj.put("currency",       "INR");
            obj.put("merchant",       merchant);
            obj.put("category",       "Uncategorized");
            obj.put("date",           dateStr);
            obj.put("entryType",      "automatic");
            obj.put("smsRaw",         text);
            obj.put("smsSender",      source);
            obj.put("referenceId",    reference);
            obj.put("paymentMethod",  payMethod);
            obj.put("isTestPhrase",   isTestPhrase);
            return obj;
        } catch (Exception e) {
            return null;
        }
    }

    private String extractMerchant(String body) {
        Pattern atPat = Pattern.compile(
                "(?:at|to)\\s+([A-Za-z][A-Za-z0-9\\s&.'-]{1,30}?)(?:\\s+on|\\s+via|\\s+ref|\\.|,|$)",
                Pattern.CASE_INSENSITIVE
        );
        Matcher m = atPat.matcher(body);
        if (m.find()) return m.group(1).trim();
        return "";
    }

    private String detectPaymentMethod(String body) {
        String lower = body.toLowerCase(Locale.ROOT);
        if (lower.contains("upi"))                                          return "UPI";
        if (lower.contains("credit card"))                                  return "Credit Card";
        if (lower.contains("debit card"))                                   return "Debit Card";
        if (lower.contains("net banking") || lower.contains("netbanking")) return "Net Banking";
        if (lower.contains("wallet"))                                       return "Wallet";
        if (lower.contains("neft") || lower.contains("imps") || lower.contains("rtgs")) return "Net Banking";
        return "";
    }
}
