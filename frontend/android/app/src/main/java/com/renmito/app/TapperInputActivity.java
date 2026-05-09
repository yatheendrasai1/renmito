package com.renmito.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class TapperInputActivity extends Activity {

    private static final String API_BASE = "https://renmito.vercel.app/api";

    private static final String[] OPTIONS = {
        "transit started",   "transit ended",
        "meeting started",   "meeting ended",
        "breakfast",         "lunch",
        "dinner",            "break",
        "debugging started", "debugging ended",
        "code time started", "code time ended",
    };

    private String createdNoteId = null;
    private String todayDate     = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.activity_tapper_input);

        // Anchor to bottom, full width, transparent chrome
        Window window = getWindow();
        window.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT);
        window.setGravity(Gravity.BOTTOM);
        window.setBackgroundDrawableResource(android.R.color.transparent);
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        // Views
        LinearLayout optionsWrapper  = findViewById(R.id.options_wrapper);
        LinearLayout optionsContainer = findViewById(R.id.options_container);
        EditText etNote              = findViewById(R.id.et_note);
        Button btnSave               = findViewById(R.id.btn_save);
        Button btnDone               = findViewById(R.id.btn_done);

        btnDone.setOnClickListener(v -> finish());

        // Enable Save only when there is custom text
        etNote.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int st, int c, int a) {}
            @Override public void onTextChanged(CharSequence s, int st, int b, int c) {}
            @Override public void afterTextChanged(Editable s) {
                btnSave.setEnabled(s.length() > 0 && createdNoteId != null);
            }
        });

        btnSave.setOnClickListener(v -> {
            String text = etNote.getText().toString().trim();
            if (text.isEmpty() || createdNoteId == null) return;
            btnSave.setEnabled(false);
            btnDone.setEnabled(false);
            updateTapperNote(text);
        });

        // Build option chips (added to optionsContainer in pairs)
        buildOptionChips(optionsContainer, btnDone);

        // Step 1: create the note immediately on open (captures the timestamp server-side)
        createTapperNote(optionsWrapper);
    }

    // ── Build chips ───────────────────────────────────────────────────────────

    private void buildOptionChips(LinearLayout container, Button btnDone) {
        int dp8  = dp(8);
        int dp6  = dp(6);
        int dp4  = dp(4);

        for (int i = 0; i < OPTIONS.length; i += 2) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            );
            rowParams.setMargins(0, 0, 0, dp6);
            row.setLayoutParams(rowParams);

            row.addView(makeChip(OPTIONS[i], dp8, dp4, btnDone));
            if (i + 1 < OPTIONS.length) {
                View spacer = new View(this);
                spacer.setLayoutParams(new LinearLayout.LayoutParams(dp8, 0));
                row.addView(spacer);
                row.addView(makeChip(OPTIONS[i + 1], dp8, dp4, btnDone));
            }

            container.addView(row);
        }
    }

    private Button makeChip(String label, int padH, int padV, Button btnDone) {
        Button chip = new Button(this);
        chip.setText(label);
        chip.setTextColor(Color.parseColor("#C8CAFF"));
        chip.setTextSize(12f);
        chip.setAllCaps(false);
        chip.setBackground(getDrawable(R.drawable.chip_bg));
        chip.setMinHeight(0);
        chip.setPadding(padH, padV + dp(6), padH, padV + dp(6));

        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
        );
        chip.setLayoutParams(p);
        chip.setEnabled(false); // enabled once note is created

        chip.setOnClickListener(v -> {
            chip.setEnabled(false);
            btnDone.setEnabled(false);
            updateTapperNote(label);
        });

        return chip;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    private void createTapperNote(LinearLayout optionsWrapper) {
        SharedPreferences prefs = getSharedPreferences(TokenSyncPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        String token = prefs.getString(TokenSyncPlugin.TOKEN_KEY, null);

        if (token == null || token.isEmpty()) {
            Toast.makeText(this, getString(R.string.tapper_not_logged_in), Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        todayDate = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(new Date());
        String tappedAt = new SimpleDateFormat("h:mm a", Locale.getDefault()).format(new Date());
        String urlStr   = API_BASE + "/notes/" + todayDate + "/notes";
        String body     = "{\"type\":\"tapper\",\"content\":\"\"}";

        new Thread(() -> {
            try {
                HttpURLConnection conn = openConnection(urlStr, "POST", token);
                writeBody(conn, body);

                int    status       = conn.getResponseCode();
                String responseBody = readResponse(conn);

                runOnUiThread(() -> {
                    if (status == 200 || status == 201) {
                        try {
                            createdNoteId = new JSONObject(responseBody).optString("_id", null);
                        } catch (Exception ignored) {}

                        // Update header and reveal options
                        ((TextView) findViewById(R.id.tv_tapped_at))
                            .setText(getString(R.string.tapper_tapped_at, tappedAt));
                        optionsWrapper.setVisibility(View.VISIBLE);

                        // Enable all chips and the custom Save button (once text is typed)
                        enableAllChips(optionsWrapper);
                    } else {
                        Toast.makeText(this, getString(R.string.tapper_error, status), Toast.LENGTH_SHORT).show();
                        finish();
                    }
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(this, getString(R.string.tapper_network_error), Toast.LENGTH_SHORT).show();
                    finish();
                });
            }
        }).start();
    }

    private void enableAllChips(LinearLayout optionsWrapper) {
        LinearLayout container = optionsWrapper.findViewById(R.id.options_container);
        if (container == null) return;
        for (int r = 0; r < container.getChildCount(); r++) {
            View row = container.getChildAt(r);
            if (row instanceof LinearLayout) {
                LinearLayout rowLayout = (LinearLayout) row;
                for (int c = 0; c < rowLayout.getChildCount(); c++) {
                    View child = rowLayout.getChildAt(c);
                    if (child instanceof Button) child.setEnabled(true);
                }
            }
        }
        // Save button enabled by TextWatcher once user types
    }

    // ── Update ────────────────────────────────────────────────────────────────

    private void updateTapperNote(String content) {
        SharedPreferences prefs = getSharedPreferences(TokenSyncPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        String token = prefs.getString(TokenSyncPlugin.TOKEN_KEY, null);
        if (token == null || createdNoteId == null) { finish(); return; }

        String safeContent = content.replace("\\", "\\\\").replace("\"", "\\\"");
        String urlStr = API_BASE + "/notes/" + todayDate + "/notes/" + createdNoteId;
        String body   = "{\"content\":\"" + safeContent + "\"}";

        new Thread(() -> {
            try {
                HttpURLConnection conn = openConnection(urlStr, "PUT", token);
                writeBody(conn, body);

                int status = conn.getResponseCode();
                runOnUiThread(() -> {
                    if (status == 200 || status == 201) {
                        Toast.makeText(this, getString(R.string.tapper_saved), Toast.LENGTH_SHORT).show();
                    } else {
                        Toast.makeText(this, getString(R.string.tapper_error, status), Toast.LENGTH_SHORT).show();
                    }
                    finish();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(this, getString(R.string.tapper_network_error), Toast.LENGTH_SHORT).show();
                    finish();
                });
            }
        }).start();
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    private HttpURLConnection openConnection(String urlStr, String method, String token) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod(method);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Authorization", "Bearer " + token);
        conn.setDoOutput(true);
        conn.setConnectTimeout(10_000);
        conn.setReadTimeout(10_000);
        return conn;
    }

    private static void writeBody(HttpURLConnection conn, String body) throws Exception {
        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.getBytes("UTF-8"));
        }
    }

    private static String readResponse(HttpURLConnection conn) {
        try {
            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder  sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
