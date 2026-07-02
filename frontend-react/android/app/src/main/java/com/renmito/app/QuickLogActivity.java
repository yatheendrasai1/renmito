package com.renmito.app;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.work.Data;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

// Small dialog-themed screen opened from a tile's "✎" strip. Collects an
// optional note, then enqueues LogPointWorker (same path as an instant tap) so
// the note is appended to the saved log title. Does no networking itself.
public class QuickLogActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_quick_log);
        setFinishOnTouchOutside(true);

        final String base = getIntent().getStringExtra(RenmitoPointLogWidget.EXTRA_TITLE);
        if (base == null) { finish(); return; }

        ((TextView) findViewById(R.id.quick_log_title)).setText("Log: " + base);
        final EditText noteField = findViewById(R.id.quick_log_note);

        findViewById(R.id.quick_log_cancel).setOnClickListener(v -> finish());

        ((Button) findViewById(R.id.quick_log_save)).setOnClickListener(v -> {
            String note = noteField.getText().toString();
            Data input = new Data.Builder()
                .putString(RenmitoPointLogWidget.EXTRA_TITLE, base)
                .putString(RenmitoPointLogWidget.EXTRA_NOTE, note)
                .build();
            WorkManager.getInstance(getApplicationContext()).enqueue(
                new OneTimeWorkRequest.Builder(LogPointWorker.class)
                    .setInputData(input)
                    .build());
            finish();
        });
    }
}
