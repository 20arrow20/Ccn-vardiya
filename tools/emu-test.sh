#!/bin/bash
# Emülatörde uygulamayı kurar, açar ve WebView üzerinden okuma testini çalıştırır (GitHub Actions'ta).
set -x
adb install -r -g android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.vardiyapanosu.app/.MainActivity
sleep 25
SOCK=$(adb shell cat /proc/net/unix | tr -d '\r' | grep -o "webview_devtools_remote_[0-9]*" | head -1)
echo "soket: $SOCK"
adb forward tcp:9222 "localabstract:$SOCK"
curl -s http://127.0.0.1:9222/json
node tools/emu-test.mjs
adb logcat -d | grep -iE "Capacitor|mlkit|OcrPlugin|AndroidRuntime" | tail -60
