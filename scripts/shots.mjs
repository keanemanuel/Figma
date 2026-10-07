/**
 * Visual check: screenshots a page at several scroll positions with the
 * installed Chrome (headless, WebGL on) and prints console errors.
 *
 *   npm run dev            (in another terminal)
 *   node scripts/shots.mjs /events/product-thon 0,0.3,0.6,1 [width] [height]
 *
 * Positions are fractions of the page's scroll height. Images go to .shots/.
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const [path = '/', stops = '0,0.5,1', width = '1440', height = '900'] = process.argv.slice(2);
const base = process.env.BASE_URL || 'http://localhost:4321';
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = '.shots';
fs.mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: Number(width), height: Number(height), deviceScaleFactor: 1, hasTouch: Number(width) < 900, isMobile: Number(width) < 900 });
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && console.log(`[${m.type()}]`, m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)));
await page.goto(base + path, { waitUntil: 'load' });
await page.waitForFunction(() => !document.documentElement.dataset.loading, { timeout: 12000 }).catch(() => console.log('loader never left'));
await new Promise((r) => setTimeout(r, 2200));
const name = path.replace(/\W+/g, '_') || 'home';
for (const s of stops.split(',')) {
  await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), Number(s));
  await new Promise((r) => setTimeout(r, 1600));
  const file = `${out}/${name}-${width}-${s}.png`;
  await page.screenshot({ path: file });
  console.log(file, await page.evaluate(() => `${Math.round(scrollY)}/${document.documentElement.scrollHeight} classes: ${[...document.querySelectorAll('[data-gl]')].map((e) => e.className).join('|')}`));
}
await browser.close();
