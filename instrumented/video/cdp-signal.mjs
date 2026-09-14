// Drill into a Datadog signal (or any page) over CDP and screenshot.
// Usage: node cdp-signal.mjs "<url>" "<clickText|->" "<out.png>"
import { chromium } from 'playwright';

const URL = process.argv[2];
const CLICK = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : null;
const OUT = process.argv[4] || 'out/ddog.png';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => p.url().includes('datadoghq.com')) || await ctx.newPage();
try { await page.setViewportSize({ width: 1920, height: 1080 }); } catch { /* real window */ }
await page.bringToFront();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(7000);
if (CLICK) {
  try {
    await page.getByText(CLICK, { exact: false }).first().click({ timeout: 15000 });
    await page.waitForTimeout(6000);
    console.log('CLICKED:', CLICK);
  } catch (e) { console.log('CLICK FAILED:', e.message.split('\n')[0]); }
}
console.log('FINAL URL:', page.url());
await page.screenshot({ path: OUT });
console.log('SHOT:', OUT);
try {
  const txt = (await page.innerText('body')).replace(/\n{2,}/g, '\n').slice(0, 2200);
  console.log('--- PAGE TEXT ---\n' + txt + '\n--- END ---');
} catch (e) { console.log('text dump failed:', e.message.split('\n')[0]); }
await browser.close();
