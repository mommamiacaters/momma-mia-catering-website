---
module: Momma Mia Mobile
date: 2026-05-25
problem_type: developer_experience
component: tooling
symptoms:
  - "npm run start:mobile fails: 'CommandError: No Android connected device found, and no emulators could be started automatically.'"
  - "ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @momma-mia/mobile android: `expo start --android` Exit status 1"
  - "npm run start launches web but the mobile half dies immediately"
root_cause: incomplete_setup
resolution_type: tooling_addition
severity: medium
tags: [expo, expo-start-android, android-emulator, launcher-script, adb, ntkdaemon, metro]
---

# Troubleshooting: `expo start --android` "No Android connected device found" → explicit launcher script

## Problem
`npm run start:mobile` (and the mobile half of `npm run start`) failed immediately because the root
script was `pnpm --filter @momma-mia/mobile android` → **`expo start --android`**, which depends on
Expo discovering *and auto-starting* an Android emulator. On this machine that's unreliable, so the
mobile app wouldn't launch.

## Environment
- Expo SDK 55, Windows, Git Bash; Node 24.13; pnpm workspace (`apps/mobile`)
- AVD `momma_pixel` (Android 35), device id `emulator-5554`; SDK at `%LOCALAPPDATA%\Android\Sdk`
- Date: 2026-05-25

## Symptoms
```
> momma-mia@0.0.0 start:mobile
> pnpm --filter @momma-mia/mobile android
$ expo start --android
CommandError: No Android connected device found, and no emulators could be started automatically.
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @momma-mia/mobile@1.0.0 android: `expo start --android` Exit status 1
```
`adb devices` showed **no devices**, and no `qemu`/emulator process was running.

## What Didn't Work
**Relying on `expo start --android`.** It must find the `emulator` binary + an AVD and boot it, then
run `startAdbReverseAsync` over all attached devices.
- **Why it's fragile here:** (1) when no emulator is running, Expo's auto-start sometimes gives up
  ("no emulators could be started automatically"); and (2) even with one running, the Nahimic
  `NTKDaemonService` (TCP 5563) makes adb register a dead phantom `emulator-5562` that aborts
  `--android`'s reverse step (see related doc). Two independent failure modes on the same command.

## Solution
Stop depending on `--android` auto-magic; **own the sequence** in a launcher script
(`scripts/run-android.mjs`) and point `start:mobile` at it.

```jsonc
// package.json (root)
"start": "concurrently -k -n web,mobile -c blue,magenta \"pnpm run start:web\" \"pnpm run start:mobile\"",
"start:mobile": "node scripts/run-android.mjs",        // was: pnpm --filter @momma-mia/mobile android
"start:mobile:expo": "pnpm --filter @momma-mia/mobile start"  // plain expo start → QR for Expo Go
```

```js
// scripts/run-android.mjs (essence)
adbOut(['start-server']);
if (!adbOut(['devices']).includes('emulator-'))            // 1. boot AVD if none running
  spawn(emulatorBin, ['-avd', AVD, '-no-boot-anim'], { detached: true, stdio: 'ignore' }).unref();
adbOut(['wait-for-device']);                               // 2. wait for boot
while (getprop sys.boot_completed !== '1') sleep(2s);
adbOut(['-s', DEVICE, 'reverse', 'tcp:8081', 'tcp:8081']); // 3. reverse (wiped by kill-server!)
freePort(8081);                                            // 4. kill zombie Metro holding 8081
const expo = spawn('pnpm', ['--filter','@momma-mia/mobile','start'], { stdio:'inherit', shell:true });
// 5. when http://localhost:8081/status === 200 → adb shell am start -d exp://127.0.0.1:8081
```
Resolves the SDK path from `ANDROID_HOME`/`ANDROID_SDK_ROOT`; AVD via `MOMMA_AVD` (default `momma_pixel`).
**Verified end-to-end:** booted device → reverse set → Metro `Android Bundled (1760 modules)` →
`/status: 200` → app opened.

## Why This Works
1. **Root cause:** `expo start --android` couples *device discovery/boot* + *reverse* + *Metro* into
   one opaque step that has two flaky dependencies on this box (auto-start + the NTKDaemon phantom).
2. **Why the fix works:** the script makes each step explicit and idempotent — it boots the AVD by
   name, waits for `sys.boot_completed`, sets `adb reverse` itself (and re-asserts it after Metro is
   up), frees a stale port-8081 listener, then opens Expo Go via `am start`. Nothing depends on
   Expo's auto-detection or a clean adb tracker.

## Prevention
- Use **`npm run start`** (web + emulator) / **`npm run start:mobile`** (emulator) / **`npm run
  start:mobile:expo`** (QR for a physical iPhone/Android). All documented in the README "Running the
  Apps" section.
- For a brand-new machine: install Android Studio + create an AVD named `momma_pixel` (or set
  `MOMMA_AVD`), install Expo Go on it, set `ANDROID_HOME`.
- Don't reach for `expo start --android` directly here; if you must, stop `NTKDaemonService` first.

## Related Issues
- See also: [expo-go-something-went-wrong-adb-reverse-momma-mobile-20260525.md](./expo-go-something-went-wrong-adb-reverse-momma-mobile-20260525.md) — the `adb reverse`-cleared blue-screen, same toolchain (the launcher re-asserts reverse to prevent it).
- Background on the NTKDaemon phantom + emulator setup: memory `mommamia-mobile-expo`.
