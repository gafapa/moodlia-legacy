import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const siteUrl = pathToFileURL(path.resolve('dist/index.html')).toString();

test.beforeEach(async ({ page }) => {
  await page.goto(siteUrl);
});

test('project overview presents capabilities, installation, architecture, and functionality', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Control Moodle with AI.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What can your AI do in Moodle?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Install only the parts you need.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'One bridge between AI and Moodle.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A few things MoodlIA can handle.' })).toBeVisible();
  await expect(page.getByText('The project currently exposes 240 Moodle operations.', { exact: false })).toBeVisible();
});

test('application identity exposes browser, installable, and touch icons', async ({ page }) => {
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute('href', './assets/moodlia-icon.svg');
  await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toHaveAttribute('href', './icons/favicon-32.png');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', './icons/apple-touch-icon.png');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './site.webmanifest');
  await expect(page.locator('.brand-mark img').first()).toHaveAttribute('src', './assets/moodlia-icon.svg');

  for (const iconPath of [
    'assets/moodlia-icon.svg',
    'icons/favicon-32.png',
    'icons/apple-touch-icon.png',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'site.webmanifest'
  ]) {
    expect(fs.existsSync(path.resolve('dist', iconPath))).toBe(true);
  }
});

test('short installation guidance remains copyable', async ({ page }) => {
  await page.getByRole('button', { name: 'Copy code example 1', exact: true }).click();
  await expect(page.locator('.copy-status')).toContainText(/Code copied|Clipboard access is not available/);
  await expect(page.getByText('npm install -g moodlia', { exact: false })).toBeVisible();
});

test('ecosystem links point to the repository, Moodle plugin listing, and npm package', async ({ page }) => {
  const ecosystemLinks = page.getByRole('navigation', { name: 'MoodlIA ecosystem links' });
  await expect(ecosystemLinks.getByRole('link', { name: /GitHub repository/ })).toHaveAttribute('href', 'https://github.com/gafapa/moodlia');
  await expect(ecosystemLinks.getByRole('link', { name: /Moodle plugin directory/ })).toHaveAttribute('href', 'https://moodle.org/plugins/local_moodlia');
  await expect(ecosystemLinks.getByRole('link', { name: /moodlia on npm/ })).toHaveAttribute('href', 'https://www.npmjs.com/package/moodlia');
});

test('skills are explained and downloadable', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Two skills extend the authoring experience.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Portable Moodle content' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Moodle with MoodlIA' })).toBeVisible();

  const downloadLinks = page.getByRole('link', { name: 'Download skill' });
  await expect(downloadLinks).toHaveCount(2);
  await expect(downloadLinks.nth(0)).toHaveAttribute('href', './downloads/design-portable-moodle-content.zip');
  await expect(downloadLinks.nth(1)).toHaveAttribute('href', './downloads/operate-moodle-with-moodlia.zip');

  for (const archiveName of ['design-portable-moodle-content.zip', 'operate-moodle-with-moodlia.zip']) {
    const archivePath = path.resolve('dist', 'downloads', archiveName);
    expect(fs.existsSync(archivePath)).toBe(true);
    expect(fs.readFileSync(archivePath).subarray(0, 2).toString('ascii')).toBe('PK');
  }
});

test('skip link appears only when keyboard users focus it', async ({ page }) => {
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  const initialBox = await skipLink.boundingBox();
  expect(initialBox.y + initialBox.height).toBeLessThanOrEqual(0);

  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();
});

test('mobile navigation and content remain keyboard and touch accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const navigationButton = page.getByRole('button', { name: 'Open navigation' });
  await expect(navigationButton).toBeVisible();
  const navigationButtonBox = await navigationButton.boundingBox();
  expect(navigationButtonBox.width).toBeGreaterThanOrEqual(44);
  expect(navigationButtonBox.height).toBeGreaterThanOrEqual(44);

  const githubLinkBox = await page.getByRole('link', { name: /View on GitHub/ }).boundingBox();
  expect(githubLinkBox.width).toBeGreaterThanOrEqual(44);
  expect(githubLinkBox.height).toBeGreaterThanOrEqual(44);

  await navigationButton.click();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('decorative motion respects the reduced motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();

  const motionStyles = await page.locator('.hero-instrument').evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      animationIterationCount: styles.animationIterationCount,
      transitionDuration: styles.transitionDuration
    };
  });

  expect(motionStyles.animationIterationCount).toBe('1');
  expect(motionStyles.transitionDuration).not.toContain('0.7s');
});

test('essential project overview remains visible without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(siteUrl);

  await expect(page.getByRole('heading', { name: 'Control Moodle with AI.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What can your AI do in Moodle?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Install only the parts you need.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'One bridge between AI and Moodle.' })).toBeVisible();
  await context.close();
});
