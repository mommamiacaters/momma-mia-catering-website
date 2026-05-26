---
module: Momma Mia Mobile
date: 2026-05-25
problem_type: developer_experience
component: tooling
symptoms:
  - "Expo Go shows blue 'Something went wrong. Sorry about that. You can go back to Expo home or try to reload the project.'"
  - "Persists across relaunches even though tsc is clean and Metro is running"
  - "Metro log shows NO incoming bundle request (no 'Android Bundled' line)"
root_cause: config_error
resolution_type: environment_setup
severity: medium
tags: [expo, expo-go, adb, adb-reverse, android-emulator, metro, kill-server]
---

# Troubleshooting: Expo Go "Something went wrong" after `adb kill-server` (cleared `adb reverse`)

## Problem
The Momma Mia mobile app (Expo Go on the Android emulator) showed the blue **"Something went wrong"**
screen and would not load, even though `tsc` was clean, Metro was running, and the code was fine.
It looked like the freshly-installed `expo-linear-gradient` native module was crashing the app — it
wasn't. The app simply **could not reach Metro** to download the JS bundle.

## Environment
- Expo SDK 55, React Native 0.83, Expo Go on `emulator-5554` (Android)
- Host: Windows, Git Bash; Metro via `npx expo start`
- App launched with `adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"`
- Date: 2026-05-25

## Symptoms
- Expo Go: "Something went wrong. … go back to Expo home or try to reload the project." (blue screen)
- Re-issuing the `am start exp://127.0.0.1:8081` deep link just re-showed the **cached** error screen.
- `adb logcat` showed **no** JS/red-box error (ruling out a code/native-module crash).
- **The tell:** the Metro terminal log showed only `Waiting on http://localhost:8081` and **no
  `Android Bundled …` line** — i.e. Expo Go never even requested a bundle.

## What Didn't Work

**Attempted Solution 1:** Assumed the new `expo-linear-gradient` native module was missing from Expo Go
and crashing on render.
- **Why it failed:** Wrong hypothesis. `expo-linear-gradient` ships in Expo Go SDK 55. logcat had no JS
  error, and — decisively — Metro showed no bundle request at all, so no app code (LinearGradient
  included) had even executed yet.

**Attempted Solution 2:** Re-launched via the `exp://127.0.0.1:8081` deep link repeatedly.
- **Why it failed:** Expo Go held the cached error screen; the deep link didn't force a re-fetch.

## Solution

The earlier `adb kill-server` (run to recover a **wedged/hung adb**) silently dropped the
`adb reverse tcp:8081 tcp:8081` port-forward. On the emulator, `127.0.0.1:8081` is the *device*
loopback — it only reaches the host's Metro **through that reverse mapping**. With it gone, Expo Go
couldn't fetch the manifest/bundle.

```bash
# 1) restore the reverse port-forward that kill-server wiped
adb -s emulator-5554 reverse tcp:8081 tcp:8081
adb -s emulator-5554 reverse --list      # verify: "host-xx tcp:8081 tcp:8081"

# 2) force Expo Go to actually re-fetch — the deep link alone re-shows the cached
#    error screen, so tap the in-app RELOAD (circular arrow) on the error screen:
adb -s emulator-5554 shell input tap <reload-button-xy>
```
Metro then logged `Android Bundled … (1760 modules)` and the app loaded normally.

## Why This Works
1. **Root cause:** `adb kill-server` tears down the adb server **and all its `reverse`/`forward`
   mappings**. The Expo dev workflow on this emulator depends on `adb reverse tcp:8081` so that
   `exp://127.0.0.1:8081` (device loopback) tunnels to the host Metro. Remove the mapping → the
   manifest fetch silently fails → Expo Go's generic "Something went wrong".
2. **Why the fix addresses it:** re-adding the reverse mapping restores host reachability; tapping the
   in-app reload makes Expo Go retry the fetch (the cached error screen won't retry on its own).
3. **Underlying issue:** a *connectivity/config* failure masquerading as a *code* failure. The single
   most diagnostic signal was the **absence** of a bundle request in the Metro log.

## Prevention
- **After any `adb kill-server` / adb server restart, immediately re-run
  `adb reverse tcp:8081 tcp:8081`** before reloading the app. (Same applies after the emulator reboots.)
- **Triage rule:** when Expo Go shows "Something went wrong," check the Metro log first. **No
  `Bundled` line = the client never reached Metro** → it's connectivity (`adb reverse` / wrong host /
  Metro down), *not* your code. A code/native error WOULD show a bundle + a logcat red-box.
- Prefer the LAN host (`exp://<host-lan-ip>:8081`) or keep a reusable `adb reverse` step in the launch
  routine so a kill-server doesn't strand the emulator. See memory `mommamia-mobile-expo` (launch workaround).
- Related Git-Bash gotcha hit the same session: `adb shell screencap -p /sdcard/x.png` has its
  `/sdcard/...` path mangled by MSYS — use `adb exec-out screencap -p > local.png` (or prefix
  `MSYS_NO_PATHCONV=1`).

## Related Issues
- See also: [expo-start-android-no-device-launcher-momma-mobile-20260525.md](./expo-start-android-no-device-launcher-momma-mobile-20260525.md) — the `expo start --android` "no device" failure; the launcher it adds re-asserts this `adb reverse` mapping.
- Adjacent mobile note: `docs/solutions/ui-bugs/scroll-spy-active-chip-freeze-momma-mia-mobile-20260524.md`.
