#!/usr/bin/env bash
set -uo pipefail

ADB="${ADB:-/c/Softwares/platform-tools/adb}"
[ -n "${1:-}" ] && ADB="$ADB -s $1"
APK=app/build/outputs/apk/debug/app-debug.apk
PKG=com.lomu.app
OUT="${OUT:-smoke-out}"
mkdir -p "$OUT"

fail() { echo "FAIL: $*"; $ADB logcat -d -t 300 > "$OUT/logcat.txt" 2>/dev/null; exit 1; }

$ADB get-state >/dev/null 2>&1 || fail "no device connected (enable USB debugging and accept the prompt)"
[ -f "$APK" ] || fail "$APK not found, run ./gradlew :app:assembleDebug"

$ADB logcat -c
$ADB install -r "$APK" | grep -q Success || fail "install failed"
$ADB shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS 2>/dev/null
$ADB shell am force-stop "$PKG"
$ADB shell am start -n "$PKG/com.lomu.app.MainActivity" | grep -qi error && fail "could not start the activity"
sleep 8

$ADB shell pidof "$PKG" >/dev/null || fail "process is not running after launch (crashed?)"
if $ADB logcat -d -s AndroidRuntime:E | grep -q "FATAL EXCEPTION"; then fail "FATAL EXCEPTION in logcat"; fi
$ADB shell dumpsys activity activities | grep -q "$PKG/com.lomu.app.MainActivity" || fail "MainActivity is not on screen"

$ADB exec-out screencap -p > "$OUT/launch.png"

sleep 4
$ADB shell pidof "$PKG" >/dev/null || fail "process died after the home screen loaded"
echo "PASS: LoMu launched and stayed up. Screenshot: $OUT/launch.png"
