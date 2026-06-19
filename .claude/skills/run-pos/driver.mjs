#!/usr/bin/env node
/**
 * Driver for icase-pos (Next.js POS/ERP app)
 * Usage: node driver.mjs <command> [args...]
 *
 * Commands:
 *   screenshot <url> <output>   - navigate and screenshot
 *   login <email> <password> <output> - sign in and screenshot dashboard
 *   navigate <url> <output>     - login as admin, then go to <url>, screenshot
 *   smoke                       - run full smoke test
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || __dirname;

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin@123';

async function withBrowser(fn) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    return await fn(page, ctx);
  } finally {
    await browser.close();
  }
}

async function screenshot(url, output) {
  return withBrowser(async (page) => {
    await page.goto(BASE_URL + url, { waitUntil: 'networkidle' });
    const dest = path.resolve(SCREENSHOT_DIR, output);
    await page.screenshot({ path: dest, fullPage: true });
    console.log('screenshot saved:', dest);
  });
}

async function login(email, password, output) {
  return withBrowser(async (page) => {
    await page.goto(BASE_URL + '/signin', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');
    // Wait for redirect away from signin, then wait for sidebar to appear
    await page.waitForURL((url) => !url.pathname.includes('/signin'), { timeout: 15000 });
    await page.waitForSelector('[class*="sidebar"], nav, aside', { timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
    const dest = path.resolve(SCREENSHOT_DIR, output);
    await page.screenshot({ path: dest, fullPage: false });
    console.log('screenshot saved:', dest);
    console.log('current url:', page.url());
  });
}

async function navigate(url, output) {
  return withBrowser(async (page) => {
    // Login first
    await page.goto(BASE_URL + '/signin', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.includes('/signin'), { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    // Navigate to target
    await page.goto(BASE_URL + url, { waitUntil: 'networkidle' });
    const dest = path.resolve(SCREENSHOT_DIR, output);
    await page.screenshot({ path: dest, fullPage: true });
    console.log('screenshot saved:', dest);
    console.log('current url:', page.url());
  });
}

async function smoke() {
  console.log('--- smoke: signin page ---');
  await screenshot('/signin', 'smoke-signin.png');

  console.log('--- smoke: login as admin ---');
  await login(ADMIN_EMAIL, ADMIN_PASSWORD, 'smoke-dashboard.png');

  console.log('--- smoke: setting/module ---');
  await navigate('/setting/module', 'smoke-modules.png');

  console.log('--- smoke: setting/role ---');
  await navigate('/setting/role', 'smoke-roles.png');

  console.log('smoke complete');
}

const [,, cmd, ...args] = process.argv;
switch (cmd) {
  case 'screenshot': await screenshot(args[0] || '/signin', args[1] || 'out.png'); break;
  case 'login':      await login(args[0], args[1], args[2] || 'out.png'); break;
  case 'navigate':   await navigate(args[0], args[1] || 'out.png'); break;
  case 'smoke':      await smoke(); break;
  default:
    console.log('Usage: node driver.mjs <screenshot|login|navigate|smoke> [args...]');
    process.exit(1);
}
