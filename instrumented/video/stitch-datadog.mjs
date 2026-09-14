// Stitch live Datadog captures into the narrated app video → demo-final.mp4.
// Builds two captioned "Datadog" cuts (IDENTIFY = Security Signals, BLOCK = Workflow
// graph) from the CDP screenshots, each framed on a dark canvas with a caption card +
// PT-BR voiceover, then splices them into demo-narrated.mp4 at the ▸DATADOG beats.
//
// Run after record-demo.mjs + narrate.mjs (needs demo-narrated.mp4 + out/ddog_*.png).

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const NARRATED = join(HERE, 'demo-narrated.mp4');
const FINAL = join(HERE, 'demo-final.mp4');
const VOICE = 'Samantha', RATE = '185'; // en_US to match the English narration
const ACCENT = '#7c4dd6'; // Datadog purple

const log = (m) => console.log(`\x1b[36m▶ ${m}\x1b[0m`);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const probeDur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

// Splice points = the ▸DATADOG beats from the recording (unchanged in the narrated cut,
// which only freeze-pads the tail).
const cues = JSON.parse(readFileSync(join(OUT, 'cues.json'), 'utf8'));
const SPLIT1 = cues.block / 1000;       // after loot → insert IDENTIFY
const SPLIT2 = cues.contained / 1000;   // before contained/outro → insert BLOCK

const CUTS = [
  {
    id: 'identify', bg: join(OUT, 'ddog_signals.png'), eyebrow: 'DATADOG · IDENTIFY',
    caption: 'Cloud SIEM + AAP: the whole attack surfaces in Security Signals',
    vo: 'In Datadog, the whole attack surfaces in Security Signals: the scanning tool, the exploit on the public endpoint, and the account takeover. A A P flags the injection instantly.',
  },
  {
    id: 'block', bg: join(OUT, 'ddog_workflow_block.png'), eyebrow: 'DATADOG · CONTAIN',
    caption: 'Workflow Automation blocks the non-MFA segment and reverts in 5 minutes',
    vo: 'The response is automatic: a Datadog workflow resolves the user, blocks the non-MFA segment through the bank API, waits five minutes and unblocks. End-to-end auto-remediation.',
  },
];

function frameHTML(cut) {
  const b64 = readFileSync(cut.bg).toString('base64');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;box-sizing:border-box}
    html,body{width:1920px;height:1080px;background:#0a0e14;
      font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
    .frame{position:absolute;top:34px;left:50%;transform:translateX(-50%);width:1520px;
      border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.10);box-shadow:0 24px 70px rgba(0,0,0,.6)}
    .frame img{display:block;width:1520px}
    .lower{position:absolute;left:50%;bottom:40px;transform:translateX(-50%);width:1560px}
    .card{background:linear-gradient(180deg,rgba(12,17,24,.92),rgba(8,11,16,.96));
      border:1px solid rgba(255,255,255,.08);border-left:6px solid ${ACCENT};border-radius:16px;
      padding:20px 32px 22px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
    .eyebrow{font-family:Menlo,monospace;font-size:18px;font-weight:800;letter-spacing:2.5px;
      text-transform:uppercase;color:#c9b3ee;display:flex;align-items:center;gap:11px;margin-bottom:8px}
    .tag{font-size:14px;font-weight:800;color:#fff;background:#632CA6;padding:5px 11px;border-radius:8px;
      box-shadow:0 0 16px rgba(99,44,166,.5)}
    .caption{font-size:38px;line-height:1.15;font-weight:800;color:#fff;letter-spacing:-.3px}
  </style></head><body>
    <div class="frame"><img src="data:image/png;base64,${b64}"></div>
    <div class="lower"><div class="card">
      <div class="eyebrow"><span class="tag">▸ DATADOG</span>${esc(cut.eyebrow.replace(/^DATADOG · /, ''))}</div>
      <div class="caption">${esc(cut.caption)}</div>
    </div></div>
  </body></html>`;
}

async function main() {
  if (!existsSync(NARRATED)) throw new Error('missing demo-narrated.mp4 — run narrate.mjs first');

  // 1) Render each framed Datadog cut → PNG, generate VO, build a clip.
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const c of CUTS) {
    log(`building cut: ${c.id}`);
    await page.setContent(frameHTML(c), { waitUntil: 'load' });
    c.png = join(OUT, `cut_${c.id}.png`);
    await page.screenshot({ path: c.png });
    c.aiff = join(OUT, `cut_${c.id}.aiff`);
    const txt = join(OUT, `cut_${c.id}.txt`);
    writeFileSync(txt, c.vo);
    execFileSync('say', ['-v', VOICE, '-r', RATE, '-f', txt, '-o', c.aiff]);
    c.dur = probeDur(c.aiff) + 1.6;
    c.mp4 = join(OUT, `cut_${c.id}.mp4`);
    execFileSync('ffmpeg', [
      '-y', '-loop', '1', '-t', c.dur.toFixed(3), '-i', c.png, '-i', c.aiff,
      '-filter_complex', '[1:a]apad,aformat=sample_rates=48000:channel_layouts=stereo[a]',
      '-map', '0:v', '-map', '[a]', '-t', c.dur.toFixed(3),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25',
      '-c:a', 'aac', '-b:a', '192k', c.mp4,
    ], { stdio: 'ignore' });
    log(`  ${c.id}: ${c.dur.toFixed(1)}s`);
  }
  await browser.close();

  // 2) Splice: [app 0→S1] + IDENTIFY + [app S1→S2] + BLOCK + [app S2→end].
  const [identify, block] = CUTS;
  const vf = (label, out) => `${label},setpts=PTS-STARTPTS,format=yuv420p,fps=25[${out}]`;
  const af = (label, out) => `${label},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[${out}]`;
  const filter = [
    vf(`[0:v]trim=0:${SPLIT1}`, 'v0'), af(`[0:a]atrim=0:${SPLIT1}`, 'a0'),
    vf('[1:v]copy', 'v1'), af('[1:a]anull', 'a1'),
    vf(`[0:v]trim=${SPLIT1}:${SPLIT2}`, 'v2'), af(`[0:a]atrim=${SPLIT1}:${SPLIT2}`, 'a2'),
    vf('[2:v]copy', 'v3'), af('[2:a]anull', 'a3'),
    vf(`[0:v]trim=${SPLIT2}`, 'v4'), af(`[0:a]atrim=${SPLIT2}`, 'a4'),
    '[v0][a0][v1][a1][v2][a2][v3][a3][v4][a4]concat=n=5:v=1:a=1[v][a]',
  ].join(';');

  log('splicing → demo-final.mp4');
  execFileSync('ffmpeg', [
    '-y', '-i', NARRATED, '-i', identify.mp4, '-i', block.mp4,
    '-filter_complex', filter, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', FINAL,
  ], { stdio: 'inherit' });
  log(`done → ${FINAL} (${probeDur(FINAL).toFixed(1)}s)`);
}

main().catch((e) => { console.error('\x1b[31m✖ stitch failed:\x1b[0m', e); process.exit(1); });
