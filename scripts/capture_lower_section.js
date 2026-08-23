import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/post_get_token_baseline';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(800);

  // Authenticate session via real backend API
  await page.evaluate(async () => {
    localStorage.clear();
    const sessionId = 'session-user-' + Date.now();
    localStorage.setItem('no_wait_salon_customer_session', sessionId);
    localStorage.setItem('no_wait_salon_customer_onboarding_v1', 'complete');
    localStorage.setItem('no_wait_salon_customer_notification_prompt_v1', 'done');
    localStorage.setItem('no_wait_salon_customer_location_v1', JSON.stringify({
      setupCompleted: true,
      mode: 'gps',
      label: 'Indiranagar, Bengaluru',
      latitude: 12.9719,
      longitude: 77.6412
    }));

    const reqRes = await fetch('/api/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' })
    });
    const reqData = await reqRes.json();

    const verRes = await fetch('/api/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: reqData.challengeId, code: reqData.demoCode })
    });
    const verData = await verRes.json();

    await fetch('/api/me/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${verData.token}`
      },
      body: JSON.stringify({ name: 'Ritik', gender: 'Male' })
    });

    localStorage.setItem('no_wait_salon_customer_auth_v1', JSON.stringify({
      phoneNumber: '+919876543210',
      token: verData.token,
      registered: true
    }));
  });

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(1000);

  // Open Sharpcut Studio (salon-1)
  await page.waitForSelector('#salon-item-salon-1', { timeout: 5000 });
  await page.click('#salon-item-salon-1');
  await delay(1000);

  // Select Haircut
  await page.evaluate(() => {
    document.getElementById('service-toggle-salon-1-s1')?.click();
  });
  await delay(500);

  // Open Join Queue sheet
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Join Queue'));
    btn?.click();
  });
  await delay(800);

  // Tap "Get Token"
  await page.evaluate(() => {
    const btn = document.getElementById('confirm-join-queue-btn');
    btn?.click();
  });
  await delay(1500);

  // Dismiss notification toast so view is completely clean
  await page.evaluate(() => {
    const toastClose = document.querySelector('.fixed.top-3 button');
    toastClose?.click();
  });
  await delay(300);

  // Full clean tracking screen top
  await page.screenshot({ path: path.join(OUT_DIR, 'state_B_post_get_token_first_screen.png') });

  // Scroll down to the bottom
  await page.evaluate(() => {
    const el = document.getElementById('get-directions-link');
    el?.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await delay(500);

  // Lower section (Quick Actions & Notifications)
  await page.screenshot({ path: path.join(OUT_DIR, 'state_H_I_lower_actions_and_notifications.png') });

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
