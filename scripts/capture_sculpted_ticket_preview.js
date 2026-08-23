import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/depth_and_spin_previews';
fs.mkdirSync(OUT_DIR, { recursive: true });

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function run() {
  console.log('Launching browser for depth & entry spin previews...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(600);

  // Authenticate session via backend API
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

  // Capture Entry Spin mid-frame at ~400ms
  await delay(420);
  console.log('Capturing Entry Spin animation mid-frame...');
  const stageBox = await page.evaluate(() => {
    const stage = document.querySelector('.lt-stage');
    if (!stage) return null;
    const r = stage.getBoundingClientRect();
    return { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 10), width: r.width + 20, height: r.height + 30 };
  });

  if (stageBox) {
    await page.screenshot({ path: path.join(OUT_DIR, 'preview_entry_spin_midflight.png'), clip: stageBox });
  }

  // Wait for entry spin animation to settle (1.5s total)
  await delay(1200);

  // Dismiss notification toast for clean view
  await page.evaluate(() => {
    const toastClose = document.querySelector('.fixed.top-3 button');
    toastClose?.click();
  });
  await delay(300);

  // 1. Full Token Page Preview (with elevated shadow, clean helper line removed)
  console.log('Capturing Preview 1: Updated Token Page with depth & clean layout...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_1_token_page_depth.png') });

  // 2. Close-Up of the Elevated Token Card & Ground Glow Shadow
  console.log('Capturing Preview 2: Elevated Token Card & Soft Layered Shadow Close-Up...');
  if (stageBox) {
    await page.screenshot({ path: path.join(OUT_DIR, 'preview_2_token_card_depth_closeup.png'), clip: stageBox });
  }

  await browser.close();
  console.log('ALL DEPTH AND ENTRY SPIN PREVIEWS CAPTURED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error capturing depth & entry spin previews:', err);
  process.exit(1);
});
