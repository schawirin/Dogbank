# DogBank demo recorder (app-side)

Auto-records the **app side** of the EvilDog security masterclass with Playwright, then
encodes to `demo.mp4` with ffmpeg. Captures the full arc (English UI, no narration):

`login → dashboard → EvilDog → RUN PIPELINE (attack) → loot → segment block →
RUN PIPELINE (PIPELINE FAIL) → escalate 3 IPs → CONTAINED`

## Run

```bash
cd instrumented/video
npm install                 # first time only
npx playwright install chromium   # first time only
node record-demo.mjs        # ~2 min → demo.mp4 + out/cues.json (beat timestamps)
node narrate.mjs            # → demo-narrated.mp4 (captions + PT-BR voiceover) + SRTs
```

Outputs:
- `demo.mp4` — silent recording (1920×1080, ~2:12). Raw take → `out/*.webm` (git-ignored).
- `demo-narrated.mp4` — same video with on-screen caption cards + PT-BR narration (macOS `say`).
- `demo-final.mp4` — narrated video with the **live Datadog cuts** spliced in (see below).
- `demo.pt.srt` / `demo.en.srt` — editable subtitles (PT + EN).

## Datadog side (live capture over CDP)

`demo-final.mp4` splices two real Datadog screens into the narrated app video at the ▸DATADOG
beats: **IDENTIFY** (Security Signals) and **BLOCK** (the `Block Dogbank User no MFA` Workflow graph).

They're captured from the user's **own logged-in Datadog** by attaching Playwright to a Chrome
instance over CDP:
1. Copy the Chrome profile (cookies) to a temp `--user-data-dir` and launch a *second* Chrome with
   `--remote-debugging-port=9222` (a macOS Keychain "Chrome Safe Storage" prompt may appear → Allow).
   Modern Chrome blocks remote-debugging on the *default* profile, hence the copied profile.
2. `chromium.connectOverCDP('http://127.0.0.1:9222')`, drive `browser.contexts()[0]` (shares the login),
   navigate + `page.screenshot()` — see `cdp-datadog.mjs` / `cdp-signal.mjs`.
3. `stitch-datadog.mjs` frames each screenshot on a dark canvas with a caption card + PT-BR VO and
   splices them into `demo-narrated.mp4` via ffmpeg `trim`+`concat`.
4. **Clean up after**: kill the debug Chrome and delete the temp profile (it holds real cookies).

### Narration / captions
- Copy lives in [script.json](script.json) — one entry per beat: `title_pt` (eyebrow), `caption_pt`
  (on-screen line, works muted), `caption_en`, `vo_pt` (spoken), `datadog_note_pt` (on-screen "▸ DATADOG"
  note marking where to splice your Datadog footage). Edit it and re-run `narrate.mjs` to change wording.
- `narrate.mjs` renders each caption as a transparent PNG via Playwright (this ffmpeg build has no
  `drawtext`), composites them at the exact beat times from `out/cues.json`, and mixes a per-beat
  voiceover. VO is budgeted to fit each beat's on-screen window; the tail is freeze-framed if narration
  runs slightly long.

## Notes

- Logs in as **Pedro Silva** (CPF `98765432101`, PIN `123456`) — an **MFA** account, so the
  operator session survives the non-MFA segment block in the containment scene.
- Rotates to a **fresh source IP** before the baseline attack: a previously-blocked spoofed IP
  on the Datadog AAP denylist would otherwise fail the attack at RECON.
- Block/unblock use `POST /api/auth/admin/{block,unblock}-no-mfa` with the lab admin token.
- **Out of scope** (record separately in Datadog, then edit together): AAP signals, dashboards,
  Cloud SIEM rules, Workflow Automation UI.
