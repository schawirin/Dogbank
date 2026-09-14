// DogBank demo — narration + on-screen captions post-processor.
// Reads out/cues.json (beat → video-relative ms) + script.json (copy) and produces
// demo-narrated.mp4 = the recording with styled caption cards (rendered as transparent
// PNGs via Playwright) + a PT-BR voiceover (macOS `say`), plus editable SRTs.
//
// ffmpeg here has no drawtext/subtitles filter, so captions are composited as image
// overlays. Run AFTER record-demo.mjs. Usage: node narrate.mjs
//
// Lab/demo tooling only.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const VIDEO = join(HERE, 'demo.mp4');
const OUTFILE = join(HERE, 'demo-narrated.mp4');

// Language: LANG_MODE env or script.json "lang" (default en). Captions/VO/voice follow it.
const LANG = (process.env.LANG_MODE || '').toLowerCase() || null;
const VOICES = { en: 'Samantha', pt: 'Luciana' };
let LANGR = 'en'; // resolved in main() from LANG || script.lang
const pick = (b, f) => b[`${f}_${LANGR}`] ?? b[`${f}_pt`] ?? '';

// TTS provider: ElevenLabs (professional voice) when ELEVENLABS_API_KEY is set, else macOS `say`.
const EL_KEY = process.env.ELEVENLABS_API_KEY || null;
const EL_VOICE = process.env.EL_VOICE || 'nPczCjzI2devNBz1zQrb'; // Brian — deep, resonant, professional
const EL_MODEL = process.env.EL_MODEL || 'eleven_multilingual_v2';

const log = (m) => console.log(`\x1b[36m▶ ${m}\x1b[0m`);

// Synthesize one VO line → audio file path. Returns .wav (ElevenLabs) or .aiff (say).
async function synthVO(text, base, sayVoice, sayRate) {
  if (EL_KEY) {
    const wav = `${base}.wav`, mp3 = `${base}.mp3`;
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({
        text, model_id: EL_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true },
      }),
    });
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', '-', '-ar', '44100', '-ac', '1', wav],
      { input: Buffer.from(await r.arrayBuffer()) });
    return wav;
  }
  const aiff = `${base}.aiff`, txt = `${base}.txt`;
  writeFileSync(txt, text);
  execFileSync('say', ['-v', sayVoice, '-r', sayRate, '-f', txt, '-o', aiff]);
  return aiff;
}

// Per-beat accent: DogBank purple (app), attack red, Datadog purple, amber (denied), green (contained).
const ACCENT = {
  intro: '#8b5cf6', dashboard: '#8b5cf6',
  evildog: '#ef4444', attack_start: '#ef4444', detect: '#ef4444', exfil: '#ef4444',
  ato: '#ef4444', attack_done: '#ef4444', loot: '#ef4444', escalate: '#ef4444',
  block: '#7c4dd6', fail: '#f59e0b', contained: '#22c55e', outro: '#7c4dd6',
};

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const probeDur = (f) =>
  parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const srtTime = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
  const sec = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  const mmm = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${sec},${mmm}`;
};

function cardHTML(beat, accent) {
  const note = pick(beat, 'datadog_note');
  const ddog = note
    ? `<div class="ddog"><span class="tag">▸ DATADOG</span><span class="txt">${esc(note)}</span></div>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;box-sizing:border-box}
    html,body{width:1920px;height:1080px;background:transparent;
      font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
    .lower{position:absolute;left:50%;bottom:60px;transform:translateX(-50%);width:1600px}
    .card{position:relative;background:linear-gradient(180deg,rgba(12,17,24,.90),rgba(8,11,16,.95));
      border:1px solid rgba(255,255,255,.08);border-left:6px solid ${accent};border-radius:18px;
      padding:24px 34px 26px;box-shadow:0 24px 70px rgba(0,0,0,.5)}
    .eyebrow{font-family:Menlo,"Courier New",monospace;font-size:19px;font-weight:700;
      letter-spacing:3px;text-transform:uppercase;color:${accent};display:flex;align-items:center;gap:11px;margin-bottom:9px}
    .dot{width:10px;height:10px;border-radius:3px;background:${accent};box-shadow:0 0 14px ${accent}}
    .caption{font-size:42px;line-height:1.16;font-weight:800;color:#fff;letter-spacing:-.3px}
    .ddog{margin-top:18px;display:flex;align-items:flex-start;gap:13px}
    .tag{flex:none;font-family:Menlo,monospace;font-size:15px;font-weight:800;letter-spacing:1.5px;
      color:#fff;background:#632CA6;padding:7px 13px;border-radius:9px;box-shadow:0 0 18px rgba(99,44,166,.55);white-space:nowrap}
    .txt{font-size:23px;line-height:1.34;color:#d7c6f0;font-weight:600;padding-top:4px}
  </style></head><body><div class="lower"><div class="card">
    <div class="eyebrow"><span class="dot"></span>${esc(pick(beat, 'title'))}</div>
    <div class="caption">${esc(pick(beat, 'caption'))}</div>${ddog}
  </div></div></body></html>`;
}

async function main() {
  if (!existsSync(VIDEO)) throw new Error(`missing ${VIDEO} — run record-demo.mjs first`);
  const cues = JSON.parse(readFileSync(join(OUT, 'cues.json'), 'utf8'));
  const script = JSON.parse(readFileSync(join(HERE, 'script.json'), 'utf8'));
  LANGR = LANG || script.lang || 'en';
  const VOICE = VOICES[LANGR] || 'Samantha';
  const RATE = LANGR === 'pt' ? '190' : '185';
  const DUR = probeDur(VIDEO);
  log(`lang ${LANGR} · voice ${VOICE} · video ${DUR.toFixed(2)}s`);

  // Order beats by their cue time; caption window = [start, next start) (last → end of video).
  const beats = script.cues
    .filter((c) => cues[c.id] != null)
    .map((c) => ({ ...c, start: cues[c.id] / 1000 }))
    .sort((a, b) => a.start - b.start);
  beats.forEach((b, i) => { b.end = i + 1 < beats.length ? beats[i + 1].start : DUR; });

  mkdirSync(join(OUT, 'cap'), { recursive: true });

  // 1) Render each caption card to a transparent PNG.
  log('rendering caption cards');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const b of beats) {
    await page.setContent(cardHTML(b, ACCENT[b.id] || '#8b5cf6'), { waitUntil: 'load' });
    b.png = join(OUT, 'cap', `${b.id}.png`);
    await page.screenshot({ path: b.png, omitBackground: true });
  }
  await browser.close();

  // 2) Generate PT-BR voiceover per beat; anchor at the cue, floor at the previous
  //    segment's end so segments never overlap (budgeted VO keeps drift tiny).
  log(`generating voiceover (${EL_KEY ? `ElevenLabs ${EL_VOICE}` : `say ${VOICE}`})`);
  let cursor = 0;
  for (const b of beats) {
    b.aiff = await synthVO(pick(b, 'vo'), join(OUT, 'cap', b.id), VOICE, RATE);
    b.voDur = probeDur(b.aiff);
    // Breathing room: let a newly-appeared screen settle before the narration starts.
    const leadIn = { dashboard: 0.5, evildog: 0.6, attack_start: 0.4 }[b.id] || 0;
    b.voStart = Math.max(b.start + leadIn, cursor);
    b.voEnd = b.voStart + b.voDur;
    // Extra breathing after beats right before a Datadog cut, so the reasoning finishes
    // and the cut lands in a gap (not mid-sentence).
    const tailGap = { loot: 1.4, escalate: 1.4 }[b.id] || 0.35;
    cursor = b.voStart + b.voDur + tailGap;
  }
  const narrationEnd = cursor;
  // Export the real VO timing so stitch-real can place cuts in narration gaps (no clipping).
  writeFileSync(join(OUT, 'vo-timing.json'), JSON.stringify(
    Object.fromEntries(beats.map((b) => [b.id, { voStart: +b.voStart.toFixed(3), voEnd: +b.voEnd.toFixed(3) }])), null, 2));
  const maxDrift = Math.max(...beats.map((b) => b.voStart - b.start));
  console.table(beats.map((b) => ({
    id: b.id, start: +b.start.toFixed(1), end: +b.end.toFixed(1),
    voStart: +b.voStart.toFixed(1), voDur: +b.voDur.toFixed(1), drift: +(b.voStart - b.start).toFixed(1),
  })));
  log(`voiceover: max drift ${maxDrift.toFixed(1)}s, narration ends ${narrationEnd.toFixed(1)}s (video ${DUR.toFixed(1)}s)`);

  // Freeze-frame the tail if the narration runs past the recording, so nothing is cut.
  const PAD = Math.max(0, narrationEnd + 0.5 - DUR);
  const TOTAL = DUR + PAD;
  beats[beats.length - 1].end = TOTAL; // hold the outro caption over the frozen tail
  if (PAD > 0.05) log(`padding tail with ${PAD.toFixed(1)}s freeze-frame → ${TOTAL.toFixed(1)}s`);

  // 3) Assemble: overlay caption PNGs (timed) + mix delayed VO. ffmpeg has no drawtext,
  //    so captions ride in as image overlays.
  const N = beats.length;
  const inputs = ['-y', '-i', VIDEO];
  beats.forEach((b) => inputs.push('-loop', '1', '-t', TOTAL.toFixed(3), '-i', b.png)); // 1..N
  beats.forEach((b) => inputs.push('-i', b.aiff));                                      // N+1..2N

  const vparts = [];
  let prev = 'base';
  vparts.push(PAD > 0.05
    ? `[0:v]tpad=stop_mode=clone:stop_duration=${PAD.toFixed(3)}[base]`
    : `[0:v]copy[base]`);
  beats.forEach((b, i) => {
    const out = `v${i}`;
    vparts.push(`[${prev}][${1 + i}:v]overlay=0:0:enable='between(t,${b.start.toFixed(3)},${b.end.toFixed(3)})'[${out}]`);
    prev = out;
  });
  const aparts = [];
  beats.forEach((b, i) => {
    const d = Math.round(b.voStart * 1000);
    aparts.push(`[${1 + N + i}:a]adelay=${d}|${d}[au${i}]`);
  });
  aparts.push(`${beats.map((_, i) => `[au${i}]`).join('')}amix=inputs=${N}:normalize=0:dropout_transition=0[aout]`);

  const filter = [...vparts, ...aparts].join(';');
  log('encoding demo-narrated.mp4');
  execFileSync('ffmpeg', [
    ...inputs,
    '-filter_complex', filter,
    '-map', `[v${N - 1}]`, '-map', '[aout]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
    OUTFILE,
  ], { stdio: 'inherit' });

  // 4) Editable subtitle sidecars (PT + EN), each with its own Datadog note.
  const srt = (lang) => beats.map((b, i) => {
    const note = b[`datadog_note_${lang}`];
    return `${i + 1}\n${srtTime(b.start)} --> ${srtTime(b.end)}\n${b[`caption_${lang}`]}${note ? `\n${note}` : ''}\n`;
  }).join('\n');
  writeFileSync(join(HERE, 'demo.pt.srt'), srt('pt'));
  writeFileSync(join(HERE, 'demo.en.srt'), srt('en'));

  log(`done → ${OUTFILE}`);
  log(`subtitles → demo.pt.srt / demo.en.srt`);
}

main().catch((e) => { console.error('\x1b[31m✖ narration failed:\x1b[0m', e); process.exit(1); });
