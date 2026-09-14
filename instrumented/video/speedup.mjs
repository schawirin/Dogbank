// Time-compress the slow "pipeline running" phases of the silent recording so the
// video feels dynamic, and remap the cue timestamps to match. Idempotent: preserves
// demo-raw.mp4 / cues-raw.json and regenerates demo.mp4 / cues.json from them.
//
// Run after record-demo.mjs, BEFORE narrate.mjs. Windows are [startCue, endCue, factor].

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const log = (m) => console.log(`\x1b[36m▶ ${m}\x1b[0m`);

// Preserve originals once, then always work from them (idempotent).
const RAWV = join(HERE, 'demo-raw.mp4'), RAWC = join(OUT, 'cues-raw.json');
if (!existsSync(RAWV)) copyFileSync(join(HERE, 'demo.mp4'), RAWV);
if (!existsSync(RAWC)) copyFileSync(join(OUT, 'cues.json'), RAWC);

const cues = JSON.parse(readFileSync(RAWC, 'utf8'));
const s = (id) => cues[id] / 1000;

// Speed up: recon/scan (attack_start→detect) and the blocked re-run (block→fail).
const WINS = [
  [s('attack_start'), s('detect'), 2.0],
  [s('block'), s('fail'), 2.2],
].sort((a, b) => a[0] - b[0]);

// Map an original timestamp to the compressed timeline.
const remap = (t) => {
  let shift = 0;
  for (const [w0, w1, F] of WINS) {
    if (t >= w1) shift += (w1 - w0) * (1 - 1 / F);
    else if (t > w0) { shift += (t - w0) * (1 - 1 / F); break; }
    else break;
  }
  return t - shift;
};

// Build the ffmpeg segment list: normal / sped / normal / sped / normal ...
const bounds = [0];
for (const [w0, w1] of WINS) { bounds.push(w0, w1); }
const DUR = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', RAWV]).toString().trim());
bounds.push(DUR);

const parts = [], labels = [];
for (let i = 0; i < bounds.length - 1; i++) {
  const a = bounds[i], b = bounds[i + 1];
  const win = WINS.find(([w0, w1]) => w0 === a && w1 === b);
  const pts = win ? `(PTS-STARTPTS)/${win[2]}` : 'PTS-STARTPTS';
  parts.push(`[0:v]trim=${a.toFixed(3)}:${b.toFixed(3)},setpts=${pts},format=yuv420p,fps=25[v${i}]`);
  labels.push(`[v${i}]`);
}
parts.push(`${labels.join('')}concat=n=${labels.length}:v=1[v]`);

log(`compressing ${WINS.length} window(s): ${WINS.map(([a, b, f]) => `${a.toFixed(0)}-${b.toFixed(0)}s @${f}x`).join(', ')}`);
execFileSync('ffmpeg', [
  '-y', '-i', RAWV, '-filter_complex', parts.join(';'),
  '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25',
  '-movflags', '+faststart', join(HERE, 'demo.mp4'),
], { stdio: 'ignore' });

// Remap cues to the new timeline.
const out = {};
for (const [k, v] of Object.entries(cues)) {
  out[k] = k.startsWith('_') ? Math.round(remap(v / 1000) * 1000) : Math.round(remap(v / 1000) * 1000);
}
writeFileSync(join(OUT, 'cues.json'), JSON.stringify(out, null, 2));
const newDur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(HERE, 'demo.mp4')]).toString().trim());
log(`done → demo.mp4 ${DUR.toFixed(1)}s → ${newDur.toFixed(1)}s; cues remapped`);
