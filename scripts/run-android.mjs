#!/usr/bin/env node
/**
 * Robust "run the mobile app on the Android emulator" launcher.
 *
 * Why not `expo start --android`? On this machine that path is fragile:
 *  - the Nahimic `NTKDaemonService` (TCP 5563) makes adb register a dead phantom
 *    `emulator-5562`, which aborts Expo's `startAdbReverseAsync`; and
 *  - Expo's emulator auto-start sometimes reports "no emulators could be started".
 *
 * This script does it explicitly and reliably:
 *   1. ensure the adb server is up
 *   2. boot the AVD if no emulator is running
 *   3. wait for the device to finish booting
 *   4. `adb reverse tcp:8081` (so exp://127.0.0.1:8081 reaches host Metro —
 *      this mapping is wiped by `adb kill-server`, so we always re-assert it)
 *   5. start Metro (`expo start`) and, once it's serving, open the app in Expo Go
 *
 * Env overrides: ANDROID_HOME / ANDROID_SDK_ROOT, MOMMA_AVD (default momma_pixel).
 */
import { spawn, execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const isWin = process.platform === 'win32';
const SDK =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk');
const adb = path.join(SDK, 'platform-tools', isWin ? 'adb.exe' : 'adb');
const emulatorBin = path.join(SDK, 'emulator', isWin ? 'emulator.exe' : 'emulator');
const AVD = process.env.MOMMA_AVD || 'momma_pixel';
const DEVICE = process.env.MOMMA_DEVICE || 'emulator-5554';
const PORT = 8081;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adbOut = (args) => {
  try {
    return execFileSync(adb, args, { encoding: 'utf8' });
  } catch (e) {
    return `${e.stdout || ''}${e.stderr || ''}`;
  }
};

// Free a TCP port held by a zombie Metro (it leaves a listener that never serves).
function freePort(port) {
  try {
    if (isWin) {
      const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        if (line.includes(`:${port}`) && /LISTENING/i.test(line)) {
          const pid = line.trim().split(/\s+/).pop();
          if (pid && pid !== '0') pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execFileSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore' });
          console.log(`✓ Freed port ${port} (killed stale PID ${pid})`);
        } catch {
          /* already gone */
        }
      }
    } else {
      const pids = execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
      for (const pid of pids) try { process.kill(Number(pid), 'SIGKILL'); } catch {}
    }
  } catch {
    /* nothing on the port */
  }
}

async function main() {
  adbOut(['start-server']);

  if (!adbOut(['devices']).includes('emulator-')) {
    console.log(`▶ Booting Android emulator (${AVD})…`);
    spawn(emulatorBin, ['-avd', AVD, '-no-boot-anim'], { detached: true, stdio: 'ignore' }).unref();
  } else {
    console.log('✓ Emulator already running');
  }

  adbOut(['wait-for-device']);
  process.stdout.write('⏳ Waiting for the device to finish booting');
  for (let i = 0; i < 150; i++) {
    if (adbOut(['-s', DEVICE, 'shell', 'getprop', 'sys.boot_completed']).trim() === '1') break;
    process.stdout.write('.');
    await sleep(2000);
  }
  console.log('\n✓ Device booted');

  adbOut(['-s', DEVICE, 'reverse', `tcp:${PORT}`, `tcp:${PORT}`]);
  console.log(`✓ adb reverse tcp:${PORT} set`);

  freePort(PORT); // kill any zombie Metro holding 8081 (it leaves a dead listener)

  console.log('▶ Starting Metro — the app opens on the emulator automatically once it’s ready…\n');
  const expo = spawn('pnpm', ['--filter', '@momma-mia/mobile', 'start'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  // Wait for Metro to serve, then open the app in Expo Go.
  (async () => {
    for (let i = 0; i < 150; i++) {
      try {
        const r = await fetch(`http://localhost:${PORT}/status`);
        if (r.ok) break;
      } catch {
        /* not up yet */
      }
      await sleep(1500);
    }
    adbOut(['-s', DEVICE, 'reverse', `tcp:${PORT}`, `tcp:${PORT}`]); // re-assert after any adb churn
    adbOut(['-s', DEVICE, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `exp://127.0.0.1:${PORT}`]);
    console.log('\n✓ Opened the app in Expo Go on the emulator. Press a in this terminal to reopen, r to reload.\n');
  })();

  expo.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
