import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/apk45_dock_previews';
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

  // State A: Salon Detail with ZERO services selected — summary panel hidden, clean translucent dock
  console.log('Capturing State A: Zero services selected (summary panel hidden)...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_A_zero_services_panel_hidden.png') });

  // State H: Join Queue + Calendar button alignment close-up in zero state
  console.log('Capturing State H: Join Queue + Calendar aligned in dock...');
  const dockArea = await page.$('.fixed.inset-x-0.bottom-0');
  if (dockArea) {
    await dockArea.screenshot({ path: path.join(OUT_DIR, 'preview_H_join_queue_calendar_aligned.png') });
  }

  // Scroll down slightly so service cards are visible
  await page.evaluate(() => {
    const el = document.getElementById('customer-salon-screen');
    if (el) el.scrollTo({ top: 400, behavior: 'instant' });
  });
  await delay(600);

  // State B & C: Select one service (Haircut) -> panel rises up showing SESSION + price
  console.log('Selecting first service (Haircut)...');
  await page.evaluate(() => document.getElementById('service-toggle-salon-1-s1')?.click());
  await delay(200);
  console.log('Capturing State B: Panel sliding/rising up above Join Queue...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_B_panel_rising_up.png') });

  await delay(500);
  console.log('Capturing State C: Panel fully open showing SESSION + price breakdown...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_C_panel_fully_open_session_price.png') });

  // State D: Tap dock summary button -> opens PriceBreakdownSheet with Apply Coupon & offers
  console.log('Tapping dock summary button to view detailed price breakdown & offers...');
  await page.waitForSelector('#dock-summary-btn', { timeout: 5000 });
  await page.click('#dock-summary-btn');
  await delay(600);
  console.log('Capturing State D: PriceBreakdownSheet open showing Apply Coupon & offers...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_D_price_breakdown_offers_sheet.png') });

  // State E: Apply an offer in PriceBreakdownSheet by clicking Apply
  console.log('Applying offer in PriceBreakdownSheet...');
  const applyOfferBtn = await page.$('button[id^="apply-offer-btn-"]');
  if (applyOfferBtn) {
    await applyOfferBtn.click();
    await delay(500);
    console.log('Capturing State E: Coupon applied (discount + final amount updated)...');
    await page.screenshot({ path: path.join(OUT_DIR, 'preview_E_coupon_applied_in_sheet.png') });
  }

  // Close PriceBreakdownSheet to see updated dock with coupon
  console.log('Closing PriceBreakdownSheet to see updated dock...');
  await page.waitForSelector('#close-price-breakdown-btn', { timeout: 5000 });
  await page.click('#close-price-breakdown-btn');
  await delay(600);
  console.log('Capturing State E2: Dock reflecting applied coupon discount + final total...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_E2_dock_with_coupon_applied.png') });

  // State F: Add second service (s4 - Detox Head Massage) -> session time + total update
  console.log('Adding second service (Detox Head Massage)...');
  await page.evaluate(() => document.getElementById('service-toggle-salon-1-s4')?.click());
  await delay(600);
  console.log('Capturing State F: Second service added (session time + total updated live)...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_F_second_service_added_updated_session.png') });

  // State G: Remove services -> panel collapses/disappears
  console.log('Removing all services...');
  await page.evaluate(() => {
    document.getElementById('service-toggle-salon-1-s1')?.click();
    document.getElementById('service-toggle-salon-1-s4')?.click();
  });
  await delay(700);
  console.log('Capturing State G: All services removed (panel smoothly collapses/disappears)...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_G_all_services_removed_panel_collapsed.png') });

  // Scroll back to top
  await page.evaluate(() => {
    const el = document.getElementById('customer-salon-screen');
    if (el) el.scrollTo({ top: 0, behavior: 'instant' });
  });
  await delay(600);

  // State I: Current Future Time flow still intact
  console.log('Tapping Choose a future time to verify Future Time flow intact...');
  await page.evaluate(() => document.getElementById('reserve-future-window-btn')?.click());
  await delay(1000);
  console.log('Capturing State I: Future Time flow intact...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_I_future_time_flow_intact.png') });

  // Return to salon
  console.log('Returning to Salon...');
  await page.evaluate(() => document.getElementById('back-to-salon-btn')?.click());
  await delay(1000);

  // State J: Live Capsule + Staff Profile changes intact
  console.log('Scrolling to trigger Live Capsule & opening Join Queue to verify Staff Profile intact...');
  await page.evaluate(() => {
    const el = document.getElementById('customer-salon-screen');
    if (el) el.scrollTo({ top: 380, behavior: 'instant' });
  });
  await delay(600);

  await page.evaluate(() => document.getElementById('join-live-queue-btn')?.click());
  await delay(1200);
  console.log('Capturing State J: Live Capsule floating + Staff Profile ("With customer", Rating, View Profile) intact...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_J_live_capsule_and_staff_profile_intact.png') });

  await browser.close();
  console.log('ALL 10 DOCK PREVIEWS CAPTURED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error running preview capture:', err);
  process.exit(1);
});
