package com.renmito.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.Toast;

import androidx.work.Data;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

// Home-screen widget: a fixed 2x2 grid of point-log tiles. Tapping a tile
// enqueues LogPointWorker, which creates the point log via the backend without
// opening the app. The tile → logTypeId mapping and the JWT are read from the
// "RenmitoWidget" SharedPreferences file, kept current by TokenSyncPlugin.
public class RenmitoPointLogWidget extends AppWidgetProvider {

    static final String ACTION_LOG_POINT = "com.renmito.app.action.LOG_POINT";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_NOTE = "note";

    // Tile label view id → point-log title. Titles must match WIDGET_TILE_TITLES
    // (src/lib/tokenSync.ts) and the seeded DefaultLogType names.
    private static final int[] TILE_IDS = {
        R.id.tile_wake, R.id.tile_breakfast, R.id.tile_lunch, R.id.tile_dinner
    };
    // The "✎" strip on each tile → opens QuickLogActivity to add a note.
    private static final int[] NOTE_IDS = {
        R.id.note_wake, R.id.note_breakfast, R.id.note_lunch, R.id.note_dinner
    };
    private static final String[] TILE_TITLES = {
        "Woke Up", "Breakfast", "Lunch", "Dinner"
    };

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_point_log);
            for (int i = 0; i < TILE_IDS.length; i++) {
                views.setOnClickPendingIntent(TILE_IDS[i], instantPendingIntent(context, i));
                views.setOnClickPendingIntent(NOTE_IDS[i], notePendingIntent(context, i));
            }
            mgr.updateAppWidget(id, views);
        }
    }

    // Tapping the label logs instantly (broadcast → LogPointWorker).
    private PendingIntent instantPendingIntent(Context context, int tileIndex) {
        Intent intent = new Intent(context, RenmitoPointLogWidget.class)
            .setAction(ACTION_LOG_POINT)
            .putExtra(EXTRA_TITLE, TILE_TITLES[tileIndex]);
        // Unique requestCode per tile so the PendingIntents don't collapse.
        return PendingIntent.getBroadcast(
            context, tileIndex, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // Tapping the "✎" strip opens the note dialog (Activity → LogPointWorker).
    private PendingIntent notePendingIntent(Context context, int tileIndex) {
        Intent intent = new Intent(context, QuickLogActivity.class)
            .putExtra(EXTRA_TITLE, TILE_TITLES[tileIndex])
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        // Offset requestCode so note intents don't collide with instant ones.
        return PendingIntent.getActivity(
            context, 100 + tileIndex, intent,
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
