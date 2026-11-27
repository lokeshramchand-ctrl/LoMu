# Phone to-do (needs the Pixel connected)

Nothing here could be checked while the phone was away. Do them in order; each takes a minute or two.

## Before you start
- Phone on the home Wi-Fi, screen unlocked, USB or wireless debugging connected (`adb devices` shows it once, not twice; use `ANDROID_SERIAL=2A231FDH2003FL`).
- **LoMu must be the app on screen.** Taps go through `scripts/phone-tap.sh X Y`, which refuses unless LoMu has focus. (On 27 Nov a plain tap landed in another app because LoMu was not in front.)
- Latest build installed: pushing to `music` installs it through the pre-push hook (`.git/phone-update.log`).

## 1. Keep mixes offline (built, never run on the phone)
1. Settings > Offline > switch **Keep mixes offline (Wi-Fi)** on. It should stay on after leaving and returning.
2. Go Home, wait for the mixes to load, then wait a few minutes on Wi-Fi.
3. Media > Downloaded should now list songs from Daily Mix, Discover Weekly and the time mixes (up to 250).
4. Turn mobile data on and Wi-Fi off: nothing new may download (metered check).
5. Next day: songs that left the mixes disappear from Downloaded; liked songs and ones you downloaded by hand stay.
6. Failure signs: switch does not persist, nothing downloads after 10 minutes, or Downloaded fills with hundreds of songs you did not expect.

## 2. Autoplay by time of day (built, ranking verified once)
1. Play one song and open the queue (list icon, bottom right of the player).
2. The next songs should be one per artist, nothing skipped or blocked, and lean toward artists you play at this hour (compare with the matching "Morning / Afternoon / Evening / Late Night Mix" on Home).
3. Repeat at another time of day; the order should change.

## 3. Lyrics (never checked on the phone)
1. Play a song with lyrics, open the lyrics (speech-bubble icon, bottom left of the player).
2. Lines should follow the song and scroll; try a song with no lyrics (should say so, not spin).
3. Airplane mode on a song already played: lyrics already shown should still be there.

## 4. LoMu Connect (never checked on the phone)
1. Sign in to the same account on the browser (LAN address) and on the phone.
2. Phone: Home > devices icon (top right). The browser should be listed.
3. Play on the browser; from the phone: pause, next, pick a song. The browser should obey (autoplay policy may need one click on the page first).
4. Reverse it: control the phone from the browser.
5. Note anything that lags more than 2-3 seconds.

## 5. Wrapped on the phone (my notes say unverified)
Open Wrapped; the totals should match the web Wrapped for the same period.

## 6. Home address learned from the server (after the Coolify redeploy)
Once the server shows `version` starting `96526566` or newer at `/api/health`, and `LOMU_LAN_ADDRESS` is set:
Settings should show the home address after a sync, and sync should work with the public domain blocked (WARP on).
Check the server from this PC with:
`curl --resolve lomu.example.com:443:192.168.1.20 https://lomu.example.com/api/health`
(the domain does not work from inside the home network; that is expected).

## 7. Phone self-update (needs your yes first)
Why: today the phone updates only when a USB/Wi-Fi debugging push happens. `.github/workflows/android.yml` builds the APK in the cloud and publishes it as a release, signed with the **same debug key already on the phone**, so it installs over the current app and nothing is lost.
1. Add the secret (a debug key with the public default password, low value): `base64 -w0 ~/.android/debug.keystore | gh secret set ANDROID_KEYSTORE_B64`
2. Push any app change. A release `android-v<number>` appears with `LoMu.apk`.
3. On the phone, download it from the release page and install over the current app. If it says the app is not compatible, the signature differs: stop and tell me, do not uninstall.
4. Later (not built): an in-app "Check for update" button that does steps 3 for you.

## Server side (not the phone)
The live server still ran `de634781` on 27 Nov. In Coolify check which branch and commit it builds, redeploy with a fresh build, and set `LOMU_LAN_ADDRESS=192.168.1.20`, `LOMU_PROXY_HOPS=2`.
