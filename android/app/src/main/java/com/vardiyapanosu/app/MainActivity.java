package com.vardiyapanosu.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // uygulamanın kendi eklentisi: ML Kit ile vardiya listesi okuma
        registerPlugin(OcrPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
