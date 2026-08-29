package com.renmito.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Mirrors the WebView's JWT and the point-log widget tile list into a native
// SharedPreferences file so the home-screen widget (which runs without the
// WebView) can authenticate and know which point-logs to create.
//
// Storage lives in a dedicated MODE_PRIVATE file — same app UID, so the
// AppWidgetProvider / WorkManager read it back directly. Keys:
//   token → current JWT Bearer token (or absent when logged out)
//   tiles → JSON array of { title, logTypeId } for the fixed tile set
@CapacitorPlugin(name = "TokenSync")
public class TokenSyncPlugin extends Plugin {

    static final String PREFS = "RenmitoWidget";
    static final String KEY_TOKEN = "token";
    static final String KEY_TILES = "tiles";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void saveToken(PluginCall call) {
        String token = call.getString("token");
        if (token == null) {
            call.reject("Missing token");
            return;
        }
        prefs().edit().putString(KEY_TOKEN, token).apply();
        call.resolve();
    }

    @PluginMethod
    public void clearToken(PluginCall call) {
        prefs().edit().remove(KEY_TOKEN).apply();
        call.resolve();
    }

    @PluginMethod
    public void saveTiles(PluginCall call) {
        String tiles = call.getString("tiles");
        if (tiles == null) {
            call.reject("Missing tiles");
            return;
        }
        prefs().edit().putString(KEY_TILES, tiles).apply();
        refreshWidgets();
        call.resolve();
    }

    // Nudge any placed widgets to re-render with the new tile labels.
    private void refreshWidgets() {
        Context ctx = getContext();
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        ComponentName widget = new ComponentName(ctx, RenmitoPointLogWidget.class);
        int[] ids = mgr.getAppWidgetIds(widget);
        if (ids == null || ids.length == 0) return;
        Intent intent = new Intent(ctx, RenmitoPointLogWidget.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        ctx.sendBroadcast(intent);
    }
}
