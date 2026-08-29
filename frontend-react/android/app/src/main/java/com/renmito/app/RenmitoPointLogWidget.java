package com.renmito.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.Toast;

import androidx.work.Data;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONArray;
import org.json.JSONObject;

// Home-screen widget: up to a 2x2 grid of point-log tiles. Tile labels are
// user-configurable (chosen in the app, mirrored into "RenmitoWidget" prefs by
// TokenSyncPlugin); this provider renders whatever titles are stored and hides
// unused slots. Tapping a label logs instantly; the "✎" strip opens the note
// dialog. Both paths run through LogPointWorker.
public class RenmitoPointLogWidget extends AppWidgetProvider {

    static final String ACTION_LOG_POINT = "com.renmito.app.action.LOG_POINT";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_NOTE = "note";

    // Label view id per slot (tap = instant log).
    private static final int[] TILE_IDS = {
        R.id.tile_wake, R.id.tile_breakfast, R.id.tile_lunch, R.id.tile_dinner
    };
    // "✎" strip per slot (tap = note dialog).
    private static final int[] NOTE_IDS = {
        R.id.note_wake, R.id.note_breakfast, R.id.note_lunch, R.id.note_dinner
    };
    // Tile container per slot (shown/hidden based on how many tiles are set).
    private static final int[] BOX_IDS = {
        R.id.box_0, R.id.box_1, R.id.box_2, R.id.box_3
    };
    // Fallback titles when the user hasn't chosen any / prefs not yet synced.
    private static final String[] DEFAULT_TITLES = {
        "Woke Up", "Breakfast", "Lunch", "Dinner"
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] appWidgetIds) {
        String[] titles = readTileTitles(context);
        for (int id : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_point_log);
            for (int i = 0; i < BOX_IDS.length; i++) {
                if (i < titles.length) {
                    views.setViewVisibility(BOX_IDS[i], View.VISIBLE);
                    views.setTextViewText(TILE_IDS[i], titles[i]);
                    views.setOnClickPendingIntent(TILE_IDS[i], instantPendingIntent(context, i, titles[i]));
                    views.setOnClickPendingIntent(NOTE_IDS[i], notePendingIntent(context, i, titles[i]));
                } else {
                    views.setViewVisibility(BOX_IDS[i], View.GONE);
                }
            }
            // Collapse an entirely-empty bottom row so 1-2 tiles don't leave a gap.
            views.setViewVisibility(R.id.row_bottom, titles.length > 2 ? View.VISIBLE : View.GONE);
            mgr.updateAppWidget(id, views);
        }
    }

    // Titles come from the "tiles" JSON written by TokenSyncPlugin; fall back to
    // the default set if absent so the widget is never blank.
    private String[] readTileTitles(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(
            TokenSyncPlugin.PREFS, Context.MODE_PRIVATE);
        String json = prefs.getString(TokenSyncPlugin.KEY_TILES, null);
        if (json == null) return DEFAULT_TITLES;
        try {
            JSONArray arr = new JSONArray(json);
            int n = Math.min(arr.length(), BOX_IDS.length);
            if (n == 0) return DEFAULT_TITLES;
            String[] titles = new String[n];
            for (int i = 0; i < n; i++) {
                JSONObject t = arr.getJSONObject(i);
                titles[i] = t.optString("title");
            }
            return titles;
        } catch (Exception e) {
            Log.w("RenmitoPointLogWidget", "bad tiles json", e);
            return DEFAULT_TITLES;
        }
    }

    // Tapping the label logs instantly (broadcast → LogPointWorker).
    private PendingIntent instantPendingIntent(Context context, int slot, String title) {
        Intent intent = new Intent(context, RenmitoPointLogWidget.class)
            .setAction(ACTION_LOG_POINT)
            .putExtra(EXTRA_TITLE, title);
        // Unique requestCode per slot so the PendingIntents don't collapse.
        return PendingIntent.getBroadcast(
            context, slot, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // Tapping the "✎" strip opens the note dialog (Activity → LogPointWorker).
    private PendingIntent notePendingIntent(Context context, int slot, String title) {
        Intent intent = new Intent(context, QuickLogActivity.class)
            .putExtra(EXTRA_TITLE, title)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        // Offset requestCode so note intents don't collide with instant ones.
        return PendingIntent.getActivity(
            context, 100 + slot, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (!ACTION_LOG_POINT.equals(intent.getAction())) return;

        String title = intent.getStringExtra(EXTRA_TITLE);
        if (title == null) return;

        Toast.makeText(context, "Logging " + title + "…", Toast.LENGTH_SHORT).show();

        Data input = new Data.Builder().putString(EXTRA_TITLE, title).build();
        OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(LogPointWorker.class)
            .setInputData(input)
            .build();
        WorkManager.getInstance(context.getApplicationContext()).enqueue(work);
    }
}
