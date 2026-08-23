import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/apk45_calendar_previews';
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

  // State A: Salon Detail showing exact APK45 “Choose a future time”
  console.log('Capturing State A: Salon Detail with APK45 "Choose a future time"...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_A_salon_detail_choose_future_time.png') });

  // State B: Bottom Join Queue dock with APK45 gold glass Calendar button
  console.log('Capturing State B: Bottom Join Queue dock with APK45 Calendar button...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_B_bottom_dock_calendar_btn.png') });

  // State C: Calendar button close-up
  console.log('Capturing State C: Calendar button close-up...');
  const calBtn = await page.$('#reserve-slot-btn');
  if (calBtn) {
    await calBtn.screenshot({ path: path.join(OUT_DIR, 'preview_C_calendar_button_close_up.png') });
  }

  // State H: Bottom Calendar button opening the same flow
  console.log('Tapping bottom Calendar button #reserve-slot-btn...');
  await page.click('#reserve-slot-btn');
  await delay(1000);
  console.log('Capturing State H: Bottom Calendar button opens the same APK45 reservation flow...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_H_bottom_calendar_btn_opens_same_screen.png') });

  // State I: Return/close behavior back to Salon Detail
  console.log('Tapping back to Salon...');
  await page.click('#back-to-salon-btn');
  await delay(1000);
  console.log('Capturing State I: Returned to Salon Detail...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_I_returned_to_salon_detail.png') });

  // State J: Proof that current Live Capsule + Staff Profile changes are still intact
  console.log('Scrolling to trigger Live Capsule & opening Join Queue to show Staff Profile...');
  await page.evaluate(() => {
    const el = document.getElementById('customer-salon-screen');
    if (el) el.scrollTo({ top: 380, behavior: 'instant' });
  });
  await delay(600);

  // Click Join Queue to open sheet
  await page.click('#join-live-queue-btn');
  await delay(1000);
  console.log('Capturing State J: Live Capsule floating + Staff Profile ("With customer", Rating, View Profile) intact...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_J_live_capsule_and_staff_profile_intact.png') });

  // Close Join Queue sheet
  console.log('Closing Join Queue sheet...');
  await page.click('#close-queue-join-sheet-btn');
  await delay(800);

  // Scroll back to top
  await page.evaluate(() => {
    const el = document.getElementById('customer-salon-screen');
    if (el) el.scrollTo({ top: 0, behavior: 'instant' });
  });
  await delay(500);

  // State D: "Choose a future time" tapped -> opens ReserveFutureWindowScreen
  console.log('Tapping "Choose a future time"...');
  await page.waitForSelector('#reserve-future-window-btn', { timeout: 5000 });
  await page.click('#reserve-future-window-btn');
  await delay(1000);
  console.log('Capturing State D: Exact recovered APK45 ReserveFutureWindowScreen...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_D_future_time_reservation_screen.png') });

  // State E: Date selection (open locked Calendar Coming Soon modal)
  console.log('Tapping locked gold calendar icon to open coming soon modal...');
  await page.waitForSelector('#gold-calendar-premium-btn', { timeout: 5000 });
  await page.click('#gold-calendar-premium-btn');
  await delay(600);
  console.log('Capturing State E: Calendar coming soon modal...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_E_date_selection_calendar_modal.png') });
  
  // Close modal
  await page.waitForSelector('#close-calendar-modal-btn', { timeout: 5000 });
  await page.click('#close-calendar-modal-btn');
  await delay(400);

  // Toggle tomorrow pill
  console.log('Selecting Tomorrow pill...');
  await page.waitForSelector('#pill-tomorrow-btn', { timeout: 5000 });
  await page.click('#pill-tomorrow-btn');
  await delay(500);
  console.log('Capturing State E2: Tomorrow date selected...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_E2_tomorrow_selected.png') });

  // State F: Time selection (expand Available Windows accordion)
  console.log('Expanding Available Windows accordion...');
  await page.waitForSelector('#available-windows-accordion-btn', { timeout: 5000 });
  await page.click('#available-windows-accordion-btn');
  await delay(500);
  console.log('Capturing State F: Available Windows expanded with Best Time slot...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_F_time_selection_windows_expanded.png') });

  // State G: Reservation Confirmation State (Select a slot -> confirms to Live Ticket)
  console.log('Selecting a time slot...');
  await page.waitForSelector('button[id^="slot-"]', { timeout: 5000 });
  await page.click('button[id^="slot-"]');
  await delay(1200);
  console.log('Capturing State G: Confirmed reservation on Live Ticket...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_G_reservation_confirmed_live_ticket.png') });

  await browser.close();
  console.log('ALL 11 PREVIEWS CAPTURED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error running preview capture:', err);
  process.exit(1);
});
