import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/icon_unification_previews';
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

  // Preview A: Salon Detail page with the bottom-right reference calendar-with-lock icon
  console.log('Capturing Preview A: Salon Detail page with bottom-right reference calendar-with-lock icon...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_A_salon_detail_master_dock_icon.png') });

  // Preview B: “Choose a future time” button using the exact same icon
  console.log('Capturing Preview B: Choose a future time button with matching icon...');
  const chooseTimeBtn = await page.$('#reserve-future-window-btn');
  if (chooseTimeBtn) {
    await chooseTimeBtn.screenshot({ path: path.join(OUT_DIR, 'preview_B_choose_future_time_button_icon.png') });
  }

  // Close-up of both icons on Salon Detail page
  const liveQueueCardArea = await page.evaluateHandle(() => document.querySelector('#customer-salon-screen > section:nth-of-type(2)'));
  if (liveQueueCardArea) {
    await liveQueueCardArea.asElement()?.screenshot({ path: path.join(OUT_DIR, 'preview_B2_live_queue_and_choose_future_time.png') });
  }

  // Preview C: Navigate to Reserve Future Slot page
  console.log('Opening Reserve Future Slot page...');
  await page.evaluate(() => document.getElementById('reserve-future-window-btn')?.click());
  await delay(1000);
  console.log('Capturing Preview C: Reserve Future Slot page with matching calendar-with-lock icon...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_C_reserve_future_slot_screen.png') });

  // Open Calendar Coming Soon Modal to show header icon
  console.log('Opening Calendar Coming Soon modal...');
  await page.evaluate(() => document.getElementById('gold-calendar-premium-btn')?.click());
  await delay(800);
  console.log('Capturing Preview C2: Premium calendar modal header with matching icon...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_C2_calendar_modal_header_icon.png') });

  // Close modal
  await page.evaluate(() => document.getElementById('close-calendar-modal-btn')?.click());
  await delay(500);

  // Return to salon
  await page.evaluate(() => document.getElementById('back-to-salon-btn')?.click());
  await delay(1000);

  // Preview D: Close-up comparison of all instances
  console.log('Capturing Preview D: Comparison close-ups...');
  const dockCalendarBtn = await page.$('#reserve-slot-btn');
  if (dockCalendarBtn) {
    await dockCalendarBtn.screenshot({ path: path.join(OUT_DIR, 'proof_1_dock_calendar_master.png') });
  }

  await browser.close();
  console.log('ALL ICON UNIFICATION PREVIEWS CAPTURED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error running icon preview capture:', err);
  process.exit(1);
});
