import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(projectRoot, 'dist', 'assets', 'moodlia-icon.svg');
const outputRoot = path.join(projectRoot, 'dist', 'icons');
const checkOnly = process.argv.includes('--check');
const iconSpecs = [
  { name: 'favicon-32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 }
];

const sourceSvg = await fs.readFile(sourcePath, 'utf8').catch((error) => {
  if (error?.code === 'ENOENT') {
    throw new Error(
      `Application icon source not found at ${path.relative(projectRoot, sourcePath)}. ` +
      'Restore the versioned website source before running npm run site:icons.',
      { cause: error }
    );
  }
  throw error;
});
const browser = await chromium.launch({ headless: true });
let hasStaleIcons = false;

try {
  if (!checkOnly) {
    await fs.mkdir(outputRoot, { recursive: true });
  }

  for (const iconSpec of iconSpecs) {
    const generatedIcon = await renderIcon(browser, sourceSvg, iconSpec.size);
    const outputPath = path.join(outputRoot, iconSpec.name);

    if (checkOnly) {
      const currentIcon = await fs.readFile(outputPath).catch(() => null);
      if (!currentIcon?.equals(generatedIcon)) {
        hasStaleIcons = true;
        console.error(`Stale application icon: ${path.relative(projectRoot, outputPath)}`);
      }
      continue;
    }

    await fs.writeFile(outputPath, generatedIcon);
    console.log(`Generated ${path.relative(projectRoot, outputPath)} (${iconSpec.size}x${iconSpec.size}).`);
  }
} finally {
  await browser.close();
}

if (hasStaleIcons) {
  console.error('Run npm run site:icons to refresh the application icons.');
  process.exitCode = 1;
} else if (checkOnly) {
  console.log(`Application icons are current (${iconSpecs.length} sizes).`);
}

async function renderIcon(browserInstance, svgMarkup, size) {
  const page = await browserInstance.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1
  });

  try {
    await page.setContent(`<!doctype html>
      <html>
        <head><style>html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #07464a; } svg { display: block; width: 100%; height: 100%; }</style></head>
        <body>${svgMarkup}</body>
      </html>`);
    return await page.screenshot({ type: 'png', animations: 'disabled' });
  } finally {
    await page.close();
  }
}
