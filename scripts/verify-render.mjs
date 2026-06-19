import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const url = process.argv[2] || 'http://127.0.0.1:5173/';
const outputDir = new URL('../verification/', import.meta.url);

const viewports = [
  { name: 'desktop', width: 1366, height: 768, isMobile: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const results = [];
const errors = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.isMobile,
      deviceScaleFactor: 1,
    });

    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('#gameCanvas');
    await page.waitForTimeout(1700);

    const canvasState = await page.evaluate(() => {
      const canvas = document.querySelector('#gameCanvas');
      return {
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        width: canvas.width,
        height: canvas.height,
      };
    });

    if (viewport.isMobile) {
      await page.getByLabel('Throw bomb').tap();
    } else {
      await page.mouse.click(viewport.width / 2, viewport.height / 2);
      await page.keyboard.press('Space');
    }

    await page.waitForTimeout(900);
    const screenshot = await page.screenshot();
    const screenshotPath = new URL(`${viewport.name}.png`, outputDir);
    await writeFile(screenshotPath, screenshot);

    const pixels = analyzeScreenshot(screenshot, viewport.width, viewport.height);
    const pass =
      canvasState.clientWidth === viewport.width &&
      canvasState.clientHeight === viewport.height &&
      canvasState.width > 0 &&
      canvasState.height > 0 &&
      pixels.uniqueBuckets >= 40 &&
      pixels.lumaRange >= 60 &&
      pixels.nonDarkRatio >= 0.12;

    results.push({
      name: viewport.name,
      canvasState,
      screenshot: screenshotPath.pathname,
      pixels,
      pass,
    });

    await page.close();
  }
} finally {
  await browser.close();
}

if (errors.length > 0) {
  console.error(JSON.stringify({ errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(results, null, 2));

if (results.some((result) => !result.pass)) {
  process.exit(1);
}

function analyzeScreenshot(buffer, width, height) {
  const png = PNG.sync.read(buffer);
  const buckets = new Set();
  let minLuma = 255;
  let maxLuma = 0;
  let nonDark = 0;
  let total = 0;

  const startX = Math.floor(width * 0.18);
  const endX = Math.floor(width * 0.82);
  const startY = Math.floor(height * 0.18);
  const endY = Math.floor(height * 0.82);

  for (let y = startY; y < endY; y += 6) {
    for (let x = startX; x < endX; x += 6) {
      const index = (png.width * y + x) * 4;
      const r = png.data[index];
      const g = png.data[index + 1];
      const b = png.data[index + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const bucket = `${r >> 4}-${g >> 4}-${b >> 4}`;
      buckets.add(bucket);
      minLuma = Math.min(minLuma, luma);
      maxLuma = Math.max(maxLuma, luma);
      if (luma > 34) nonDark += 1;
      total += 1;
    }
  }

  return {
    uniqueBuckets: buckets.size,
    lumaRange: Math.round(maxLuma - minLuma),
    nonDarkRatio: Number((nonDark / total).toFixed(3)),
  };
}
