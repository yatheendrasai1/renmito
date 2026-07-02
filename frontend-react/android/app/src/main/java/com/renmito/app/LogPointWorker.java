package com.renmito.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;

// Creates a point log via the backend, off the main thread. Reads the JWT and
// the tile → logTypeId map from the "RenmitoWidget" prefs (written by the
// WebView via TokenSyncPlugin). The backend resolves logTypeSource itself, so
// the payload only needs { entryType, title, logTypeId, pointAtISO }.
public class LogPointWorker extends Worker {

    // Matches environment.mobile.ts — the widget has no access to environment.*.
    private static final String API_BASE = "https://renmito.vercel.app/api";

    public LogPointWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        // Base title identifies the log type; an optional note (from the "✎"
        // dialog) is appended to the saved title.
        String base = getInputData().getString(RenmitoPointLogWidget.EXTRA_TITLE);
        if (base == null) return Result.failure();
        String note = getInputData().getString(RenmitoPointLogWidget.EXTRA_NOTE);

        SharedPreferences prefs = getApplicationContext()
            .getSharedPreferences(TokenSyncPlugin.PREFS, Context.MODE_PRIVATE);
        String token = prefs.getString(TokenSyncPlugin.KEY_TOKEN, null);
        String tilesJson = prefs.getString(TokenSyncPlugin.KEY_TILES, null);

        if (token == null) {
            toast("Open Renmito and sign in first");
            return Result.success();
        }

        String logTypeId = resolveLogTypeId(tilesJson, base);
        if (logTypeId == null) {
            toast("Open Renmito once to set up the widget");
            return Result.success();
        }

        String title = (note != null && !note.trim().isEmpty())
            ? base + " — " + note.trim()
            : base;

        try {
            int code = postLog(token, title, logTypeId);
            if (code >= 200 && code < 300) {
                toast("✓ " + base + " logged");
                return Result.success();
            } else if (code == 401) {
                toast("Session expired — open Renmito to sign in");
                return Result.success();
            } else {
                toast("Couldn't log " + title + " (" + code + ")");
                return Result.retry();
            }
        } catch (Exception e) {
            Log.w("LogPointWorker", "post failed", e);
            toast("Couldn't log " + title + " — will retry");
            return Result.retry();
        }
    }

    private String resolveLogTypeId(String tilesJson, String title) {
        if (tilesJson == null) return null;
        try {
            JSONArray arr = new JSONArray(tilesJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject t = arr.getJSONObject(i);
                if (title.equals(t.optString("title"))) {
                    String id = t.optString("logTypeId", "");
                    if (!id.isEmpty()) return id;
                }
            }
        } catch (Exception e) {
            Log.w("LogPointWorker", "bad tiles json", e);
        }
        return null;
    }

    private int postLog(String token, String title, String logTypeId) throws Exception {
        String localDate = LocalDate.now().toString();   // yyyy-MM-dd, device tz
        String pointAtISO = Instant.now().toString();     // UTC instant

        JSONObject body = new JSONObject();
        body.put("entryType", "point");
        body.put("title", title);
        body.put("logTypeId", logTypeId);
        body.put("pointAtISO", pointAtISO);

        URL url = new URL(API_BASE + "/logs/" + localDate);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload);
            }
            return conn.getResponseCode();
        } finally {
            conn.disconnect();
        }
    }

    private void toast(String msg) {
        new Handler(Looper.getMainLooper()).post(() ->
            Toast.makeText(getApplicationContext(), msg, Toast.LENGTH_SHORT).show());
    }
}
