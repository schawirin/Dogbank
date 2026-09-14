// Splice the user's REAL Datadog screen recordings (IP block in AAP, user block via
// Cloud SIEM → Workflow) into the narrated app video → demo-final.mp4.
// Each recording is framed on a dark 1920x1080 canvas with a caption card + an
// ElevenLabs (Brian) voiceover, then spliced at the ▸DATADOG beats.
//
// Needs: demo-narrated.mp4 + ELEVENLABS_API_KEY in env. Run after narrate.mjs.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const NARRATED = join(HERE, 'demo-narrated.mp4');
const FINAL = join(HERE, 'demo-final.mp4');
const ACCENT = '#7c4dd6';
const EL_KEY = process.env.ELEVENLABS_API_KEY;
const EL_VOICE = process.env.EL_VOICE || 'nPczCjzI2devNBz1zQrb'; // Brian
const EL_MODEL = process.env.EL_MODEL || 'eleven_multilingual_v2';

const log = (m) => console.log(`\x1b[36m▶ ${m}\x1b[0m`);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const probeDur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

// Resolve a Desktop recording by its time substring (filenames use U+202F before AM/PM).
const desktop = join(homedir(), 'Desktop');
const rec = (t) => {
  const f = readdirSync(desktop).find((n) => n.includes(t) && n.toLowerCase().endsWith('.mov'));
  if (!f) throw new Error(`recording not found for ${t}`);
  return join(desktop, f);
};

async function synth(text, wav) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: EL_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true } }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', '-', '-ar', '48000', '-ac', '2', wav], { input: Buffer.from(await r.arrayBuffer()) });
}

const cardHTML = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  html,body{width:1920px;height:1080px;background:transparent;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .lower{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);width:1660px}
  .card{background:linear-gradient(180deg,rgba(12,17,24,.92),rgba(8,11,16,.96));border:1px solid rgba(255,255,255,.08);
    border-left:6px solid ${ACCENT};border-radius:16px;padding:18px 30px 20px;box-shadow:0 20px 60px rgba(0,0,0,.55)}
  .eyebrow{font-family:Menlo,monospace;font-size:17px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:#c9b3ee;display:flex;align-items:center;gap:11px;margin-bottom:8px}
  .tag{font-size:13px;font-weight:800;color:#fff;background:#632CA6;padding:5px 11px;border-radius:8px;box-shadow:0 0 16px rgba(99,44,166,.5)}
  .caption{font-size:37px;line-height:1.14;font-weight:800;color:#fff;letter-spacing:-.3px}
</style></head><body><div class="lower"><div class="card">
  <div class="eyebrow"><span class="tag">▸ DATADOG</span>${esc(c.eyebrow.replace(/^DATADOG · /, ''))}</div>
  <div class="caption">${esc(c.caption)}</div>
</div></div></body></html>`;

// CUTS[0] → inserted at SPLIT1 (after loot); CUTS[1] → at SPLIT2 (before contained).
// Order: block the IP first; then, when the attacker spreads to new IPs, block the users.
// VO is written to track the on-screen actions (OCR'd) so it doesn't drift.
const CUTS = [
  {
    id: 'block_ip', video: rec('10.37.54'), eyebrow: 'DATADOG · BLOCK IP',
    caption: "App & API Protection — block the attacker's IPs at the edge",
    vo: "First response, in Datadog's App and API Protection. The dashboard shows every attack on the bank in real time. We open the attackers view and block the malicious IPs — added to the denylist and enforced at the edge through Remote Config. Requests from those addresses are now denied before they ever reach the bank.",
  },
  {
    id: 'block_user', video: rec('10.40.30'), eyebrow: 'DATADOG · BLOCK USERS',
    caption: 'Cloud SIEM → a Workflow blocks the exposed non-MFA users',
    vo: "But the attacker just spins up new IPs. So from the Cloud SIEM signal, we run a Datadog workflow that disables the exposed non-MFA users automatically. The fraud is contained — buying the team time to ship a hotfix for the vulnerability.",
  },
];

async function main() {
  if (!existsSync(NARRATED)) throw new Error('missing demo-narrated.mp4 — run narrate.mjs first');
  if (!EL_KEY) throw new Error('ELEVENLABS_API_KEY not set');
  const cues = JSON.parse(readFileSync(join(OUT, 'cues.json'), 'utf8'));
  // Place cuts just AFTER the preceding beat's narration ends (in the gap) so the reasoning
  // finishes and the transition never lands mid-sentence. Falls back to cue times.
  const vt = existsSync(join(OUT, 'vo-timing.json')) ? JSON.parse(readFileSync(join(OUT, 'vo-timing.json'), 'utf8')) : {};
  const SPLIT1 = vt.loot ? vt.loot.voEnd + 0.7 : cues.block / 1000;      // after "the damage" → IP block
  const SPLIT2 = vt.escalate ? vt.escalate.voEnd + 0.7 : cues.contained / 1000; // after "3 IPs" → user block
  log(`splits: S1=${SPLIT1.toFixed(1)}s S2=${SPLIT2.toFixed(1)}s`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const c of CUTS) {
    log(`building real cut: ${c.id}`);
    // caption card (transparent overlay)
    await page.setContent(cardHTML(c), { waitUntil: 'load' });
    c.png = join(OUT, `real_${c.id}.png`);
    await page.screenshot({ path: c.png, omitBackground: true });
    // narration + clip
    c.wav = join(OUT, `real_${c.id}.wav`);
    await synth(c.vo, c.wav);
    const voDur = probeDur(c.wav);
    const recDur = probeDur(c.video);
    // Breathing room: the screen appears, a beat of silence (leadIn), THEN the narration,
    // then a tail. Fit the recording to that window by speeding it up (kills the silent
    // gap, stays dynamic). Never slow down; cap the speed-up at 2.4x.
    const leadIn = 0.8, tail = 1.4;
    let clipDur = leadIn + voDur + tail;
    let speed = recDur / clipDur;
    if (speed > 2.4) { speed = 2.4; clipDur = recDur / speed; }
    if (speed < 1) { speed = 1; clipDur = recDur; }
    const dly = Math.round(leadIn * 1000);
    c.mp4 = join(OUT, `real_${c.id}.mp4`);
    execFileSync('ffmpeg', [
      '-y', '-i', c.video, '-loop', '1', '-i', c.png, '-i', c.wav,
      '-filter_complex',
      `color=c=0x0a0e14:s=1920x1080:r=25:d=${clipDur.toFixed(3)}[bg];` +
      `[0:v]setpts=(PTS-STARTPTS)/${speed.toFixed(4)},scale=1600:864:force_original_aspect_ratio=decrease,setsar=1,fps=25[rec];` +
      `[bg][rec]overlay=(W-w)/2:24:shortest=1[fr];` +
      `[fr][1:v]overlay=0:0[v];` +
      `[2:a]adelay=${dly}|${dly},apad,aformat=sample_rates=48000:channel_layouts=stereo[a]`,
      '-map', '[v]', '-map', '[a]', '-t', clipDur.toFixed(3),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '192k', c.mp4,
    ], { stdio: 'ignore' });
    c.clipDur = clipDur;
    log(`  ${c.id}: rec ${recDur.toFixed(1)}s → ${clipDur.toFixed(1)}s @${speed.toFixed(2)}x (vo ${voDur.toFixed(1)}s)`);
  }
  await browser.close();

  // Splice with crossfades for fluid transitions: [app 0→S1] ⇄ IP ⇄ [app S1→S2] ⇄ USER ⇄ [app S2→end].
  // Input 1 = CUTS[0] (block_ip) → at S1; input 2 = CUTS[1] (block_user) → at S2.
  const nDur = probeDur(NARRATED);
  const [ipCut, userCut] = CUTS;
  const XF = 0.5; // crossfade duration
  const segDur = [SPLIT1, ipCut.clipDur, SPLIT2 - SPLIT1, userCut.clipDur, nDur - SPLIT2];
  const offs = [];
  let L = segDur[0];
  for (let i = 1; i < segDur.length; i++) { offs.push(L - XF); L = L + segDur[i] - XF; }
  const totalDur = L;

  const vn = (src, out) => `${src},setpts=PTS-STARTPTS,format=yuv420p,fps=25[${out}]`;
  const an = (src, out) => `${src},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[${out}]`;
  const xf = (a, b, o, out) => `[${a}][${b}]xfade=transition=fade:duration=${XF}:offset=${o.toFixed(3)}[${out}]`;
  const filter = [
    vn(`[0:v]trim=0:${SPLIT1}`, 'v0'), vn('[1:v]copy', 'v1'), vn(`[0:v]trim=${SPLIT1}:${SPLIT2}`, 'v2'), vn('[2:v]copy', 'v3'), vn(`[0:v]trim=${SPLIT2}`, 'v4'),
    an(`[0:a]atrim=0:${SPLIT1}`, 'a0'), an('[1:a]anull', 'a1'), an(`[0:a]atrim=${SPLIT1}:${SPLIT2}`, 'a2'), an('[2:a]anull', 'a3'), an(`[0:a]atrim=${SPLIT2}`, 'a4'),
    xf('v0', 'v1', offs[0], 'xv1'), xf('xv1', 'v2', offs[1], 'xv2'), xf('xv2', 'v3', offs[2], 'xv3'), xf('xv3', 'v4', offs[3], 'vv'),
    '[a0][a1]acrossfade=d=' + XF + '[xa1]', '[xa1][a2]acrossfade=d=' + XF + '[xa2]', '[xa2][a3]acrossfade=d=' + XF + '[xa3]', '[xa3][a4]acrossfade=d=' + XF + '[aa]',
  ].join(';');

  const TEMP = join(OUT, 'spliced_nomusic.mp4');
  log('splicing with crossfades');
  execFileSync('ffmpeg', [
    '-y', '-i', NARRATED, '-i', ipCut.mp4, '-i', userCut.mp4,
    '-filter_complex', filter, '-map', '[vv]', '-map', '[aa]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '192k', TEMP,
  ], { stdio: 'ignore' });

  // Light background music under the whole thing (low volume, fade in/out).
  const BGM = process.env.BGM_FILE || '/Users/pedro.schawirin/Documents/FIAP/video-vulnerabilidades/musica/Stealth Music - Going Dark.mp3';
  const BGM_VOL = process.env.BGM_VOL || '0.06';
  log(`mixing background music (${BGM.split('/').pop()} @ vol ${BGM_VOL})`);
  execFileSync('ffmpeg', [
    '-y', '-i', TEMP, '-i', BGM,
    '-filter_complex',
    `[1:a]atrim=0:${totalDur.toFixed(3)},afade=t=in:d=1.5,afade=t=out:st=${(totalDur - 2.5).toFixed(3)}:d=2.5,` +
    `volume=${BGM_VOL},aformat=sample_rates=48000:channel_layouts=stereo[bg];` +
    `[0:a][bg]amix=inputs=2:normalize=0:duration=first[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', FINAL,
  ], { stdio: 'inherit' });
  log(`done → ${FINAL} (${probeDur(FINAL).toFixed(1)}s)`);
}

main().catch((e) => { console.error('\x1b[31m✖ stitch-real failed:\x1b[0m', e); process.exit(1); });
