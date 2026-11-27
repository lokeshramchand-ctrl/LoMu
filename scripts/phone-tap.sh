#!/usr/bin/env bash
# Taps the phone only while LoMu is the app on screen; anything else (a chat, a story, the lock screen) aborts the tap.
# Usage: scripts/phone-tap.sh X Y   (needs one adb device, or ANDROID_SERIAL set)
set -euo pipefail
ADB=${ADB:-/c/Softwares/platform-tools/adb}
focus=$("$ADB" shell dumpsys window | grep -m1 mCurrentFocus || true)
case "$focus" in
  *com.lomu.app*) "$ADB" shell input tap "$1" "$2" ;;
  *) echo "refusing to tap: LoMu is not in the foreground ($focus)" >&2; exit 1 ;;
esac
