package com.renmito.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(TokenSyncPlugin.class);
        registerPlugin(SmsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
