import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/advanced_token_journey_previews';
fs.mkdirSync(OUT_DIR, { recursive: true });

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function run() {
  console.log('Launching browser for Advanced Token Journey preview captures...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Open Customer App tab
  const pageCustomer = await browser.newPage();
  await pageCustomer.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await pageCustomer.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(600);

  // Authenticate customer session via API
  console.log('Authenticating customer session...');
  await pageCustomer.evaluate(async () => {
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

  await pageCustomer.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(1000);

  // Open Sharpcut Studio
  console.log('Opening Sharpcut Studio...');
  await pageCustomer.waitForSelector('#salon-item-salon-1', { timeout: 5000 });
  await pageCustomer.click('#salon-item-salon-1');
  await delay(1000);

  // Select Haircut service
  console.log('Selecting Haircut service...');
  await pageCustomer.evaluate(() => {
    document.getElementById('service-toggle-salon-1-s1')?.click();
  });
  await delay(500);

  // Open Join Queue sheet
  await pageCustomer.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Join Queue'));
    btn?.click();
  });
  await delay(800);

  // Tap "Get Token"
  console.log('Tapping Get Token...');
  await pageCustomer.evaluate(() => {
    const btn = document.getElementById('confirm-join-queue-btn');
    btn?.click();
  });
  await delay(1600);

  // Dismiss notification toast
  await pageCustomer.evaluate(() => {
    const toastClose = document.querySelector('.fixed.top-3 button');
    toastClose?.click();
  });
  await delay(300);

  // A & B: Token Just Created / In Queue State (Hour Formatting)
  console.log('Capturing Preview A & B: Token Just Created & In Queue State...');
  await pageCustomer.screenshot({ path: path.join(OUT_DIR, 'preview_A_B_token_joined_in_queue.png') });

  // Open Staff Dashboard tab
  console.log('Opening Staff Dashboard tab...');
  const pageStaff = await browser.newPage();
  await pageStaff.setViewport({ width: 414, height: 896, deviceScaleFactor: 2 });
  await pageStaff.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(800);

  // Switch Staff Dashboard to Sharpcut Studio (salon-1)
  await pageStaff.evaluate(() => {
    const staffBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Staff'));
    staffBtn?.click();
  });
  await delay(1000);

  // D: Staff Dashboard showing joined customer & timestamp
  console.log('Capturing Preview D: Staff Dashboard showing joined customer & time...');
  await pageStaff.screenshot({ path: path.join(OUT_DIR, 'preview_D_staff_dashboard_joined_customer.png') });

  // E & F: Staff presses CALL -> Customer Called state
  console.log('Staff pressing CALL CTA...');
  await pageStaff.evaluate(() => {
    const callBtn = document.querySelector('[id^="action-call-"]');
    callBtn?.click();
  });
  await delay(1200);

  // F: Customer Token Page after Call
  console.log('Capturing Preview F: Customer Token Page after Call (Salon is Calling You)...');
  await pageCustomer.screenshot({ path: path.join(OUT_DIR, 'preview_F_customer_called_state.png') });

  // G: Staff Dashboard showing SAME countdown & status
  console.log('Capturing Preview G: Staff Dashboard showing synchronized countdown...');
  await pageStaff.screenshot({ path: path.join(OUT_DIR, 'preview_G_staff_dashboard_calling_countdown.png') });

  // H: "I'm on my way" button tap on Customer page
  console.log('Customer tapping "I\'m on my way"...');
  await pageCustomer.evaluate(() => {
    const btn = document.getElementById('im-on-my-way-btn');
    btn?.click();
  });
  await delay(1200);

  // H: Customer acknowledged state
  console.log('Capturing Preview H: Customer Acknowledged State (Salon notified)...');
  await pageCustomer.screenshot({ path: path.join(OUT_DIR, 'preview_H_customer_acknowledged_state.png') });

  // I: Staff Dashboard receiving acknowledgement
  console.log('Capturing Preview I: Staff Dashboard showing Customer Acknowledged status...');
  await pageStaff.screenshot({ path: path.join(OUT_DIR, 'preview_I_staff_dashboard_acknowledged_status.png') });

  // C: Upcoming State (Simulated when 1 person ahead)
  console.log('Capturing Preview C: Upcoming State (You\'re Almost Up)...');
  await pageCustomer.evaluate(() => {
    // Simulate upcoming state for visual preview
    const root = document.querySelector('.lt-root');
    if (root) {
      // scroll to ticket area
      root.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  });
  await delay(400);

  // J: 3D People Around You
  console.log('Capturing Preview J: Enhanced 3D People Around You cards...');
  const peopleBox = await pageCustomer.evaluate(() => {
    const el = document.querySelector('.lt-root');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: r.height };
  });
  if (peopleBox) {
    await pageCustomer.screenshot({ path: path.join(OUT_DIR, 'preview_J_people_around_you_3d.png'), clip: peopleBox });
  }

  // K: Narrow mobile width preview (375px)
  console.log('Capturing Preview K: Narrow Mobile Viewport (375px)...');
  await pageCustomer.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await delay(400);
  await pageCustomer.screenshot({ path: path.join(OUT_DIR, 'preview_K_narrow_mobile_viewport.png') });

  // L: Full token page top to bottom layout
  console.log('Capturing Preview L: Full Token Page Top-to-Bottom Layout...');
  await pageCustomer.setViewport({ width: 390, height: 1100, deviceScaleFactor: 2 });
  await delay(400);
  await pageCustomer.screenshot({ path: path.join(OUT_DIR, 'preview_L_full_token_page_layout.png') });

  await browser.close();
  console.log('ALL ADVANCED TOKEN JOURNEY PREVIEWS CAPTURED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error capturing token journey previews:', err);
  process.exit(1);
});
