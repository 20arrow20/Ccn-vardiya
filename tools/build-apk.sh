#!/usr/bin/env bash
# APK derler: Android SDK yoksa indirir (dl.google.com erişimi gerekir), sonra debug APK üretir.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
export JAVA_HOME=${JAVA_HOME_17:-/usr/lib/jvm/java-17-openjdk-amd64}
export ANDROID_HOME=${ANDROID_HOME:-$HOME/android-sdk}
SDKM="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
if [ ! -x "$SDKM" ]; then
  mkdir -p "$ANDROID_HOME/cmdline-tools"; tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/ct.zip" https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  unzip -q "$tmp/ct.zip" -d "$tmp"; rm -rf "$ANDROID_HOME/cmdline-tools/latest"; mv "$tmp/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi
yes | "$SDKM" --licenses >/dev/null || true
"$SDKM" "platforms;android-34" "build-tools;34.0.0" "platform-tools" >/dev/null
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
node tools/build.mjs
npx cap sync android
(cd android && ./gradlew assembleDebug --no-daemon -q)
VERSION=$(node -p "require('./package.json').version")
cp android/app/build/outputs/apk/debug/app-debug.apk "VardiyaPanosu-$VERSION.apk"
echo "APK: $ROOT/VardiyaPanosu-$VERSION.apk"
