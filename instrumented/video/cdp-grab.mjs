// Grab the current Datadog tab over CDP without navigating/resizing (non-disruptive).
// Usage: node cdp-grab.mjs "<url-substring|->" "<out.png>"
import { chromium } from 'playwright';

const FILTER = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : '';
const OUT = process.argv[3] || 'out/grab.png';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const pages = ctx.pages().filter(
  (p) => /^https:\/\/app\.datadoghq\.com/.test(p.url()) && (!FILTER || p.url().includes(FILTER)),
);
const page = pages[pages.length - 1];
if (!page) { console.log('no matching datadog page'); process.exit(1); }
await page.screenshot({ path: OUT });
console.log('URL:', page.url());
console.log('SHOT:', OUT);
try {
  console.log('--- TEXT ---\n' + (await page.innerText('body')).replace(/\n{2,}/g, '\n').slice(0, 1400));
} catch (e) { console.log('text failed:', e.message.split('\n')[0]); }
await browser.close();
