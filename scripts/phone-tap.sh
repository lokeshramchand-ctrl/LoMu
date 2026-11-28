#!/usr/bin/env bash
set -euo pipefail
ADB=${ADB:-/c/Softwares/platform-tools/adb}
focus=$("$ADB" shell dumpsys window | grep -m1 mCurrentFocus || true)
case "$focus" in
  *com.lomu.app*) "$ADB" shell input tap "$1" "$2" ;;
  *) echo "refusing to tap: LoMu is not in the foreground ($focus)" >&2; exit 1 ;;
esac
