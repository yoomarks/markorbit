import { expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applicationUrl } from '../applications.js';

export const urls = {
  lite: applicationUrl('lite'),
  markreg: applicationUrl('markreg'),
  operations: applicationUrl('operations')
} as const;

export function watchPage(page: Page, options: { expectedHttpErrors?: boolean } = {}) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !(options.expectedHttpErrors && message.text().startsWith('Failed to load resource:'))
    )
      problems.push(`console.error: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() === 404) problems.push(`404: ${response.url()}`);
  });
  return () => expect(problems, problems.join('\n')).toEqual([]);
}

export async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'page must not horizontally overflow'
  ).toBe(true);
}

export async function expectVisibleFocus(page: Page) {
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus-visible');
  await expect(focused).toBeVisible();
  expect(await focused.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    'none'
  );
}

export async function capture(page: Page, name: string) {
  const directory = resolve('playwright-screenshots');
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: resolve(directory, `${name}.png`),
    fullPage: true
  });
}
