package com.renmito.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

/**
 * Capacitor plugin that bridges the Android SMS listener to the WebView.
 *
 * JS usage (via Capacitor Plugins):
 *   SmsPlugin.startListening({ showNotification: true })
 *   SmsPlugin.stopListening()
 *   SmsPlugin.checkPermissions()
 *   SmsPlugin.requestPermissions()
 *
 * Parsed SMS transactions are emitted as the "smsTransaction" event on the
 * Capacitor event bus so the Angular service can subscribe with:
 *   Capacitor.addListener('smsTransaction', handler)
 */
@CapacitorPlugin(
    name = "SmsPlugin",
    permissions = {
        @Permission(strings = { Manifest.permission.RECEIVE_SMS }, alias = "receive"),
        @Permission(strings = { Manifest.permission.READ_SMS },    alias = "read"),
    }
)
public class SmsPlugin extends Plugin {

    private BroadcastReceiver parsedReceiver;
    private boolean listening = false;

    // ─── Public plugin methods ────────────────────────────────────────────────

    @PluginMethod
    public void startListening(PluginCall call) {
        boolean showNotification = call.getBoolean("showNotification", true);

        if (!hasSmsPermissions()) {
            call.reject("SMS permissions not granted. Call requestPermissions() first.");
            return;
        }

        if (!listening) {
            registerParsedReceiver();
            listening = true;
        }

        if (showNotification) startForegroundService();

        JSObject result = new JSObject();
        result.put("listening", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        if (listening) {
            unregisterParsedReceiver();
            listening = false;
        }
        stopForegroundService();

        JSObject result = new JSObject();
        result.put("listening", false);
        call.resolve(result);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("receive", checkPermission("receive"));
        result.put("read",    checkPermission("read"));
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        requestAllPermissions(call, "permissionsCallback");
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("receive", checkPermission("receive"));
        result.put("read",    checkPermission("read"));
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
                    notifyListeners("smsTransaction", jsObj);
                } catch (Exception ignored) {}
            }
        };
        IntentFilter filter = new IntentFilter(SmsBroadcastReceiver.ACTION_SMS_PARSED);
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

    private void startForegroundService() {
        Intent svc = new Intent(getContext(), ExpenseNotificationService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(svc);
        } else {
            getContext().startService(svc);
        }
    }

    private void stopForegroundService() {
        Intent svc = new Intent(getContext(), ExpenseNotificationService.class);
        getContext().stopService(svc);
    }

    private boolean hasSmsPermissions() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
            && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS)    == PackageManager.PERMISSION_GRANTED;
    }

    private String checkPermission(String alias) {
        String perm = alias.equals("receive") ? Manifest.permission.RECEIVE_SMS : Manifest.permission.READ_SMS;
        return ContextCompat.checkSelfPermission(getContext(), perm) == PackageManager.PERMISSION_GRANTED
                ? "granted" : "denied";
    }
}
