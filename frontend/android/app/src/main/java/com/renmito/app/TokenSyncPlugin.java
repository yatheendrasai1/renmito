package com.renmito.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges the JWT auth token from the Angular WebView into Android SharedPreferences
 * so the home-screen widget can authenticate API calls without opening the app.
 */
@CapacitorPlugin(name = "TokenSync")
public class TokenSyncPlugin extends Plugin {

    static final String PREFS_NAME = "RenmitoPrefs";
    static final String TOKEN_KEY  = "auth_token";

    @PluginMethod
    public void saveToken(PluginCall call) {
        String token = call.getString("token", "");
        getPrefs().edit().putString(TOKEN_KEY, token).apply();
        call.resolve();
    }

    @PluginMethod
    public void clearToken(PluginCall call) {
        getPrefs().edit().remove(TOKEN_KEY).apply();
        call.resolve();
    }

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }
}
