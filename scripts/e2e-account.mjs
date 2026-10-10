/**
 * End-to-end check of sign-in and account sync against the real Supabase project (run by
 * .github/workflows/e2e-account.yml). Creates a throwaway confirmed user, signs in on one "phone",
 * renames the golfer, checks it reached the account, signs in on a second "phone" and checks the data
 * came down, then deletes the account from the app. The throwaway user is always removed at the end.
 */
import { createClient } from '@supabase/supabase-js';
import { chromium, devices } from 'playwright-core';

const URL = 'https://jcqvzumkfmbksduzdrbx.supabase.co';
const SITE = process.env.SITE ?? 'http://localhost:4173/';
const admin = createClient(URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const email = `e2e-${Date.now()}@example.com`;
const password = `E2e-${Math.random().toString(36).slice(2)}!`;

const step = (s) => console.log(`• ${s}`);
const fail = (s) => {
  throw new Error(s);
};

const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) fail(`create user: ${error.message}`);
const uid = created.user.id;
step(`created test user ${email}`);

const browser = await chromium.launch();
try {
  const phone = async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept());
    page.on('pageerror', (e) => console.log(`  page error: ${e.message}`));
    await page.goto(SITE);
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForSelector('nav.tabbar', { timeout: 20000 });
    return page;
  };

  const a = await phone();
  step('phone 1 signed in');
  const { data: acct } = await admin.from('accounts').select('plan').eq('id', uid).single();
  if (acct?.plan !== 'free') fail(`expected an accounts row with plan free, got ${JSON.stringify(acct)}`);
  step('accounts row created (free plan)');

  await a.goto(`${SITE}#/more`);
  const name = a.locator('.card', { has: a.locator('h2', { hasText: 'My Golfer' }) }).locator('input').first();
  await name.fill('E2E Kid');
  // Changes upload a few seconds after the last edit.
  let uploaded = false;
  for (let i = 0; i < 20 && !uploaded; i++) {
    await a.waitForTimeout(1000);
    const { data: row } = await admin.from('family_data').select('data').eq('user_id', uid).maybeSingle();
    uploaded = JSON.stringify(row?.data ?? '').includes('E2E Kid');
  }
  if (!uploaded) fail('renamed golfer did not reach the account within 20 seconds');
  step('change uploaded to the account');

  const b = await phone();
  await b.waitForSelector('h1:text("E2E Kid")', { timeout: 20000 });
  step('phone 2 signed in and downloaded the data');

  // Another account must not see this family's data.
  const other = createClient(URL, 'sb_publishable_0S7Qy9PdxNCZl7EwpoUs-Q_UvoSJiFu', { auth: { persistSession: false } });
  const { data: peek } = await other.from('family_data').select('user_id');
  if (peek?.length) fail('signed-out visitor could read family data');
  step('signed-out visitors can’t read family data');

  await b.goto(`${SITE}#/more`);
  await b.click('text=Delete my account');
  await b.waitForSelector('text=Create an account', { timeout: 20000 });
  const { data: gone } = await admin.auth.admin.getUserById(uid);
  if (gone?.user) fail('account still exists after deleting it in the app');
  const { data: leftover } = await admin.from('family_data').select('user_id').eq('user_id', uid);
  if (leftover?.length) fail('family data left behind after deleting the account');
  step('account and its data deleted from the app');
  console.log('PASS');
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(uid).catch(() => undefined);
}
