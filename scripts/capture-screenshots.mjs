import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const assets = join(root, 'assets');
const base = 'http://localhost:8765/';

await mkdir(assets, { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

await page.goto(base, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForSelector('#mainChart', { timeout: 15000 });
await page.waitForFunction(() => {
  const tbody = document.querySelector('#modelTable tbody');
  return tbody && !tbody.textContent.includes('Loading');
}, { timeout: 15000 });
await page.waitForFunction(() => {
  const canvas = document.getElementById('mainChart');
  return canvas && canvas.offsetHeight > 0 && window.Chart?.getChart?.('mainChart');
}, { timeout: 15000 });
await new Promise((r) => setTimeout(r, 500));

await page.screenshot({
  path: join(assets, 'screenshot-hero.png'),
  fullPage: false,
});

const dashboard = await page.$('.dashboard');
if (dashboard) {
  await dashboard.screenshot({ path: join(assets, 'screenshot-comparison.png') });
}

await page.evaluate(() => {
  document.getElementById('landing')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({
  path: join(assets, 'screenshot-landing.png'),
  fullPage: false,
});

await browser.close();
console.log('Screenshots saved to assets/');
