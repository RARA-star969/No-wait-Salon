import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/calendar_icon_previews';
fs.mkdirSync(OUT_DIR, { recursive: true });

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function createVerifiedUser() {
  const phone = '9876543210';
  const reqRes = await fetch('http://localhost:8787/api/otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const reqData = await reqRes.json();

  const verifyRes = await fetch('http://localhost:8787/api/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId: reqData.challengeId, code: reqData.demoCode }),
  });
  const auth = await verifyRes.json();

  await fetch('http://localhost:8787/api/me/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.token}`
    },
    body: JSON.stringify({ name: 'Ritik', gender: 'male', city: 'Bengaluru' }),
  });

  return { auth };
}

async function run() {
  const { auth } = await createVerifiedUser();

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(500);

  // Authenticate session
  await page.evaluate((authData) => {
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
    localStorage.setItem('no_wait_salon_customer_auth_v1', JSON.stringify({
      token: authData.token,
      customerId: authData.customerId,
      phoneNumber: authData.phone
    }));
  }, auth);

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(1200);

  // Switch to Customer View if needed
  const custTab = await page.$('button::-p-text(Customer)');
  if (custTab) await custTab.click();
  await delay(800);

  // Open Sharpcut Studio (salon-1)
  console.log('Opening Sharpcut Studio...');
  await page.waitForSelector('#salon-item-salon-1', { timeout: 5000 });
  await page.click('#salon-item-salon-1');
  await delay(1200);

  // 1. Full Salon Detail screen showing both (1) bottom dock calendar button and (2) "Choose a future time" button
  console.log('Capturing State A: Salon Detail showing bottom-right dock calendar button and Choose a future time button...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_A_salon_detail_overview.png') });

  // 1b. Close-up of bottom-right calendar button in dock
  console.log('Capturing Close-up 1: Bottom-right calendar button in dock...');
  const bottomBtn = await page.$('#reserve-slot-btn');
  if (bottomBtn) {
    await bottomBtn.screenshot({ path: path.join(OUT_DIR, 'preview_1_bottom_right_calendar_button_closeup.png') });
  }

  // 2. Close-up of "Choose a future time" button
  console.log('Capturing Close-up 2: Choose a future time button...');
  const chooseBtn = await page.$('#reserve-future-window-btn');
  if (chooseBtn) {
    await chooseBtn.screenshot({ path: path.join(OUT_DIR, 'preview_2_choose_future_time_button_closeup.png') });
  }

  // 3. Open Reserve Future Slot flow/page
  console.log('Opening Reserve Future Window screen...');
  await page.evaluate(() => document.getElementById('reserve-future-window-btn')?.click());
  await delay(1000);

  console.log('Capturing State C: Reserve Future Window screen showing the unified calendar icon button...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_C_reserve_future_window_screen.png') });

  // 3b. Close-up of calendar icon button in Reserve Future Window screen
  console.log('Capturing Close-up 3: Calendar button inside Reserve Future Window screen...');
  const futureCalendarBtn = await page.$('#gold-calendar-premium-btn');
  if (futureCalendarBtn) {
    await futureCalendarBtn.screenshot({ path: path.join(OUT_DIR, 'preview_3_future_screen_calendar_button_closeup.png') });
  }

  // 4. Tap the calendar button to open the Premium Calendar Coming Soon modal
  console.log('Opening Premium calendar booking modal...');
  await page.evaluate(() => document.getElementById('gold-calendar-premium-btn')?.click());
  await delay(800);

  console.log('Capturing State C2: Premium calendar booking modal showing unified calendar icon in header badge...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_C2_premium_calendar_modal.png') });

  await browser.close();
  console.log('ALL CALENDAR ICON PREVIEWS CAPTURED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error running calendar preview capture:', err);
  process.exit(1);
});
