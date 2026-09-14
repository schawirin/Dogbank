// Attach to the user's logged-in Chrome over CDP and capture a Datadog view.
// Usage: node cdp-datadog.mjs "<url>" "<out.png>"
import { chromium } from 'playwright';

const URL = process.argv[2];
const OUT = process.argv[3] || 'out/ddog.png';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => p.url().includes('datadoghq.com')) || await ctx.newPage();
try { await page.setViewportSize({ width: 1920, height: 1080 }); } catch { /* real window */ }
await page.bringToFront();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
const url = page.url();
console.log('FINAL URL:', url);
console.log('TITLE:', await page.title());
console.log('LOGGED_IN:', !/\/account\/login|\/login|auth0|okta|signin/i.test(url));
await page.screenshot({ path: OUT });
console.log('SHOT:', OUT);
await browser.close(); // CDP: disconnects, leaves Chrome running
