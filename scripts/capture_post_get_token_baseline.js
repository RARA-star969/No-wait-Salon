import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/post_get_token_baseline';
fs.mkdirSync(OUT_DIR, { recursive: true });

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(500);

  // Authenticate session via real backend API
  console.log('Authenticating with backend...');
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

    // 1. Request OTP
    const reqRes = await fetch('/api/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' })
    });
    const reqData = await reqRes.json();

    // 2. Verify OTP
    const verRes = await fetch('/api/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: reqData.challengeId, code: reqData.demoCode })
    });
    const verData = await verRes.json();

    // 3. Update Profile
    await fetch('/api/me/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${verData.token}`
      },
      body: JSON.stringify({ name: 'Ritik', gender: 'Male' })
    });

    // 4. Save Customer Auth Session in local storage
    localStorage.setItem('no_wait_salon_customer_auth_v1', JSON.stringify({
      phoneNumber: '+919876543210',
      token: verData.token,
      registered: true
    }));
  });

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(1200);

  // Open Sharpcut Studio (salon-1)
  console.log('Opening Sharpcut Studio...');
  await page.waitForSelector('#salon-item-salon-1', { timeout: 5000 });
  await page.click('#salon-item-salon-1');
  await delay(1200);

  // Select Haircut
  console.log('Selecting Haircut service...');
  await page.evaluate(() => {
    document.getElementById('service-toggle-salon-1-s1')?.click();
  });
  await delay(600);

  // Open Join Queue sheet
  console.log('Opening Join Queue sheet...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Join Queue'));
    btn?.click();
  });
  await delay(1000);

  // A. Moment Get Token is tapped on sheet
  console.log('Capturing State A: Join Queue Sheet with Get Token CTA...');
  await page.screenshot({ path: path.join(OUT_DIR, 'state_A_sheet_get_token_moment.png') });

  // Tap "Get Token"
  console.log('Tapping Get Token CTA...');
  await page.evaluate(() => {
    const btn = document.getElementById('confirm-join-queue-btn');
    btn?.click();
  });
  await delay(1800);

  // B. First screen/state that opens
  console.log('Capturing State B: Tracking Screen (Full view)...');
  await page.screenshot({ path: path.join(OUT_DIR, 'state_B_post_get_token_first_screen.png') });

  // D2. Rotate ticket in 3D to show reverse side
  console.log('Capturing Ticket back side in 3D...');
  await page.evaluate(() => {
    const chip = document.getElementById('live-ticket-chip');
    if (chip) {
      chip.classList.remove('lt-floating');
      chip.style.transform = 'rotateY(180deg)';
    }
  });
  await delay(400);
  const ticketArea = await page.evaluateHandle(() => document.querySelector('.lt-stage'));
  if (ticketArea) {
    await ticketArea.asElement()?.screenshot({ path: path.join(OUT_DIR, 'state_D2_ticket_back_side.png') });
  }

  // Reset ticket angle
  await page.evaluate(() => {
    const chip = document.getElementById('live-ticket-chip');
    if (chip) {
      chip.style.transform = 'rotateY(0deg)';
      chip.classList.add('lt-floating');
    }
  });
  await delay(300);

  // H & I: Lower page content (scrolled down to bottom)
  console.log('Capturing State H & I: Lower page content...');
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('#customer-tracking-screen')?.parentElement;
    if (scrollContainer) scrollContainer.scrollTop = 600;
  });
  await delay(600);
  await page.screenshot({ path: path.join(OUT_DIR, 'state_H_I_lower_actions_and_notifications.png') });

  // Reset scroll
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('#customer-tracking-screen')?.parentElement;
    if (scrollContainer) scrollContainer.scrollTop = 0;
  });
  await delay(300);

  // J1: Called / Your Turn stage preview
  console.log('Capturing State J1: Called stage with active I\'m on my way...');
  await page.evaluate(() => {
    const btn = document.getElementById('im-on-my-way-btn');
    if (btn) {
      btn.removeAttribute('disabled');
      btn.removeAttribute('aria-disabled');
      btn.className = 'flex h-11 w-full items-center justify-center gap-2 rounded-[13px] text-[12.5px] font-bold transition-opacity bg-[#0F766E] text-white shadow-[0_12px_22px_-12px_rgba(15,118,110,0.6)] cursor-pointer';
    }
  });
  await delay(400);
  await page.screenshot({ path: path.join(OUT_DIR, 'state_J1_called_stage_active_cta.png') });

  await browser.close();
  console.log('ALL POST-GET-TOKEN BASELINE CAPTURES COMPLETED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error running baseline capture:', err);
  process.exit(1);
});
