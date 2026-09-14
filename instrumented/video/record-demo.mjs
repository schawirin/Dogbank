// DogBank / EvilDog — app-side demo recorder (Playwright → .webm → .mp4 via ffmpeg).
// Drives the live app at lab.dogbank.dog through the full security-masterclass arc:
//   login → dashboard → EvilDog (EN) → RUN PIPELINE (attack) → loot →
//   segment block → RUN PIPELINE (PIPELINE FAIL) → escalate 3 IPs → CONTAINED.
// Datadog-side cuts (AAP / SIEM / Workflow UI) are recorded separately by the user.
//
// Emits out/cues.json (beat → video-relative ms) consumed by narrate.mjs.
//
// Run:  cd instrumented/video && npm install && node record-demo.mjs
// Lab-scoped only. Admin token is the public lab configmap value.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');

const BASE = 'https://lab.dogbank.dog';
const TOK = 'dogbank-admin-token-demo';         // public lab admin token (configmap)
const CPF = '98765432101';                       // Pedro Silva — MFA account (survives the segment block)
const PIN = '123456';                            // 6-digit PIN

const ADMIN = { headers: { 'X-Admin-Token': TOK }, timeout: 15000 };

const log = (m) => console.log(`\x1b[36m▶ ${m}\x1b[0m`);
const warn = (m) => console.log(`\x1b[33m⚠ ${m}\x1b[0m`);

// Deterministic pipeline wait via the backend state API (independent of UI text).
// `sawReset` guards against accepting the *previous* run's terminal state before
// the freshly-clicked run has reset the DAG server-side. `marks` records a cue the
// first time a given node reaches success (sub-beats used for narration).
async function pipelineStatus(page) {
  const r = await page.request.get(`${BASE}/api/evildog/pipeline/state`, { timeout: 10000 }).catch(() => null);
  if (!r || !r.ok()) return { done: 0, failed: false, nodes: {} };
  const nodes = (await r.json().catch(() => ({}))).nodes || {};
  const done = Object.values(nodes).filter((v) => v === 'success').length;
  const failed = Object.entries(nodes).some(([k, v]) => v === 'fail' && k !== 'DETECT');
  return { done, failed, nodes };
}

async function waitPipeline(page, want, { marks = {}, cue = null, timeoutMs = 150000 } = {}) {
  const t0 = Date.now();
  let sawReset = false;
  const armed = {};        // node -> seen non-success since this wait began (guards vs stale success)
  const fired = new Set();
  while (Date.now() - t0 < timeoutMs) {
    const { done, failed, nodes } = await pipelineStatus(page);
    if (!sawReset && (done < 8 || failed)) sawReset = true;   // new run has started
    if (cue) {
      for (const [node, name] of Object.entries(marks)) {
        if (nodes[node] !== 'success') armed[node] = true;    // node reset / not finished yet
        else if (armed[node] && !fired.has(name)) { fired.add(name); cue(name); }
      }
    }
    if (sawReset && want === 'completed' && done >= 8) return 'completed';
    if (sawReset && want === 'failed' && failed) return 'failed';
    await page.waitForTimeout(1500);
  }
  return 'timeout';
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
    ignoreHTTPSErrors: true,
  });
  // Force the whole app (incl. the EvilDog tab) into English before any script runs.
  await context.addInitScript(() => localStorage.setItem('dogbank_lang', 'en'));

  const page = await context.newPage();
  const video = page.video();
  const dwell = (ms) => page.waitForTimeout(ms);

  // Video-relative cue clock. Recording starts ~here (first page); narrate.mjs
  // calibrates any small offset against the encoded duration.
  const t0 = Date.now();
  const cues = {};
  const cue = (name) => { cues[name] = Date.now() - t0; log(`cue ${name} @ ${(cues[name] / 1000).toFixed(1)}s`); };

  try {
    // ── SCENE 1 · Login (CPF → PIN) ──────────────────────────────────────────────
    // Open on the login page first so the video doesn't start on a blank frame.
    log('login: CPF');
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    cue('intro');

    // Pre-state: unblock the non-MFA segment so the baseline attack lands, and rotate
    // to a fresh source IP (the previous spoofed IP may sit on the AAP denylist from
    // earlier testing, which would otherwise block the attack at RECON).
    log('reset: unblock non-MFA segment + rotate to a fresh source IP');
    await page.request.post(`${BASE}/api/auth/admin/unblock-no-mfa`, ADMIN).catch(() => {});
    await page.request.post(`${BASE}/api/evildog/rotate-ip`, { timeout: 15000 }).catch(() => {});

    await page.locator('#cpf').click();
    await page.locator('#cpf').pressSequentially(CPF, { delay: 55 });
    await dwell(600);
    await page.locator('button[type="submit"]').click();

    log('login: PIN');
    await page.waitForURL('**/password', { timeout: 15000 });
    await dwell(700);
    for (const d of PIN) {
      await page.getByRole('button', { name: d, exact: true }).click();
      await dwell(230);
    }
    await dwell(400);
    await page.locator('button[type="submit"]').click();

    // ── SCENE 1 · Dashboard ──────────────────────────────────────────────────────
    log('dashboard');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    cue('dashboard');
    await dwell(4500);

    // ── SCENE 2 · EvilDog tab (EN) + maximize ────────────────────────────────────
    log('open EvilDog');
    await page.goto(`${BASE}/dashboard/evildog`, { waitUntil: 'domcontentloaded' });
    const runBtn = page.getByRole('button', { name: /run pipeline/i });
    await runBtn.waitFor({ state: 'visible', timeout: 20000 });
    cue('evildog');
    await dwell(1500);
    await page.getByRole('button', { name: 'Maximize' }).click().catch(() => warn('maximize button not found'));
    await dwell(2500); // let the operator take in the orchestrator before the attack

    // ── SCENE 3-4 · ATTACK: run the full kill-chain ──────────────────────────────
    log('RUN PIPELINE (attack)');
    cue('attack_start');
    await runBtn.click();
    const r1 = await waitPipeline(page, 'completed', {
      cue, marks: { DETECT: 'detect', INJECT: 'exfil', ATO: 'ato' },
    });
    if (r1 !== 'completed') throw new Error(`baseline pipeline did not complete (${r1})`);
    cue('attack_done');
    log('pipeline COMPLETED (8/8)');
    await dwell(3000);

    // Loot: open the REPORT node → reveal the exfiltrated customer base
    log('open REPORT loot');
    await page.getByText('REPORT', { exact: true }).first().click();
    await page.getByText('Base de clientes exfiltrada').waitFor({ state: 'visible', timeout: 15000 });
    cue('loot');
    await dwell(1800);
    await page.getByRole('button', { name: /revelar tudo/i }).click().catch(() => {});
    await dwell(6000);
    // Close the loot modal via its X button (Escape also exits fullscreen — avoid it).
    const modal = page.locator('div.fixed.inset-0.z-\\[10000\\]');
    await modal.getByRole('button').first().click();
    await modal.waitFor({ state: 'detached', timeout: 8000 })
      .catch(async () => { await modal.click({ position: { x: 6, y: 6 } }); }); // backdrop fallback
    await dwell(1500);

    // ── SCENE 7 · CONTAINMENT: block the non-MFA segment, re-run → PIPELINE FAIL ──
    log('block non-MFA segment (SOAR remediation)');
    cue('block');
    await page.request.post(`${BASE}/api/auth/admin/block-no-mfa`, { ...ADMIN, data: { reason: 'demo' } })
      .catch(() => warn('block request failed'));
    await dwell(2600);

    log('RUN PIPELINE (blocked → PIPELINE FAIL)');
    await runBtn.click();
    const r2 = await waitPipeline(page, 'failed');
    log(`containment pipeline: ${r2}`);
    await page.getByText('PIPELINE FAIL').first()
      .waitFor({ state: 'visible', timeout: 20000 }).catch(() => warn('no PIPELINE FAIL banner'));
    cue('fail');
    await dwell(3000);

    // Escalate to 3 simultaneous spoofed IPs → all lanes get CONTAINED (segment block holds)
    log('escalate to 3 IPs');
    cue('escalate');
    await page.getByRole('button', { name: /escalate/i }).click();
    await page.getByText(/CONTAINED/).first().waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForFunction(
      () => (document.body.innerText.match(/CONTAINED/g) || []).length >= 3,
      null, { timeout: 90000 },
    ).catch(() => warn('fewer than 3 lanes reached CONTAINED'));
    log('all lanes CONTAINED');
    cue('contained');
    await dwell(3500);
    cue('outro');
    await dwell(4000);
  } finally {
    // ── Cleanup: leave the lab unblocked for the next take ──────────────────────
    log('cleanup: unblock non-MFA segment');
    cues._duration = Date.now() - t0;
    await page.request.post(`${BASE}/api/auth/admin/unblock-no-mfa`, ADMIN).catch(() => {});
    await context.close();
    await browser.close();
  }

  // ── Encode .webm → .mp4 (H.264, faststart) + write cue sheet ───────────────────
  const webm = await video.path();
  const mp4 = join(HERE, 'demo.mp4');
  writeFileSync(join(OUT, 'cues.json'), JSON.stringify(cues, null, 2));
  log(`cues → ${join(OUT, 'cues.json')}`);
  log(`encoding ${webm} → ${mp4}`);
  execFileSync('ffmpeg', [
    '-y', '-i', webm,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    mp4,
  ], { stdio: 'inherit' });
  log(`done → ${mp4}`);
}

main().catch((e) => { console.error('\x1b[31m✖ recording failed:\x1b[0m', e); process.exit(1); });
