package com.renmito.app;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

/**
 * Capacitor plugin that bridges the Android notification listener to the WebView.
 *
 * JS usage (via Capacitor Plugins):
 *   NotificationPlugin.startListening()
 *   NotificationPlugin.stopListening()
 *   NotificationPlugin.checkPermission()     → { status: 'granted' | 'denied' }
 *   NotificationPlugin.openNotificationSettings()
 *
 * Parsed notification transactions are emitted as the "notificationTransaction"
 * event so the Angular service can subscribe with:
 *   Capacitor.addListener('notificationTransaction', handler)
 *
 * Note: notification access is NOT a runtime permission — the user must grant it
 * manually at Settings → Notifications → Notification access.
 */
@CapacitorPlugin(name = "NotificationPlugin")
public class NotificationPlugin extends Plugin {

    private BroadcastReceiver parsedReceiver;
    private boolean listening = false;

    // ─── Public plugin methods ────────────────────────────────────────────────

    @PluginMethod
    public void startListening(PluginCall call) {
        if (!isPermissionGranted()) {
            call.reject("Notification access not granted. Call openNotificationSettings() first.");
            return;
        }
        TransactionNotificationListenerService.forwardingEnabled = true;
        if (!listening) {
            registerParsedReceiver();
            listening = true;
        }
        JSObject result = new JSObject();
        result.put("listening", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        TransactionNotificationListenerService.forwardingEnabled = false;
        if (listening) {
            unregisterParsedReceiver();
            listening = false;
        }
        JSObject result = new JSObject();
        result.put("listening", false);
        call.resolve(result);
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("status", isPermissionGranted() ? "granted" : "denied");
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }

    // ─── Internals ────────────────────────────────────────────────────────────

    private void registerParsedReceiver() {
        parsedReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String json = intent.getStringExtra("json");
                if (json == null) return;
                try {
                    JSONObject obj = new JSONObject(json);
                    JSObject jsObj = JSObject.fromJSONObject(obj);
                    notifyListeners("notificationTransaction", jsObj);
                } catch (Exception ignored) {}
            }
        };
        IntentFilter filter = new IntentFilter(TransactionNotificationListenerService.ACTION_NOTIFICATION_PARSED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(parsedReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(parsedReceiver, filter);
        }
    }

    private void unregisterParsedReceiver() {
        if (parsedReceiver != null) {
            try { getContext().unregisterReceiver(parsedReceiver); } catch (Exception ignored) {}
            parsedReceiver = null;
        }
    }

    private boolean isPermissionGranted() {
        String flat = Settings.Secure.getString(
                getContext().getContentResolver(),
                "enabled_notification_listeners"
        );
        if (flat == null || flat.isEmpty()) return false;
        String pkgName = getContext().getPackageName();
        for (String component : flat.split(":")) {
            try {
                if (ComponentName.unflattenFromString(component).getPackageName().equals(pkgName)) {
                    return true;
                }
            } catch (Exception ignored) {}
        }
        return false;
    }
}
