import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function verifyMainE2E() {
  console.log('--- STARTING E2E FULL MAIN VERIFICATION ---');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const pageCust = await browser.newPage();
  const pageStaff = await browser.newPage();

  const custErrors = [];
  pageCust.on('pageerror', (err) => custErrors.push(err.message));

  const staffErrors = [];
  pageStaff.on('pageerror', (err) => staffErrors.push(err.message));

  await pageCust.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await pageStaff.setViewport({ width: 414, height: 896, deviceScaleFactor: 2 });

  // 1. Open Customer App & Authenticate
  await pageCust.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(500);

  await pageCust.evaluate(async () => {
    localStorage.clear();
    const sessionId = 'e2e-main-user-' + Date.now();
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
  await pageCust.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(1000);

  // Open Sharpcut Studio
  console.log('[1/7] Testing Salon Detail & Service Selection...');
  await pageCust.waitForSelector('#salon-item-salon-1', { timeout: 5000 });
  await pageCust.click('#salon-item-salon-1');
  await delay(800);

  // Select Service
  await pageCust.evaluate(() => {
    document.getElementById('service-toggle-salon-1-s1')?.click();
  });
  await delay(400);

  // Open Join Queue sheet
  console.log('[2/7] Testing Join Queue & Get Token...');
  await pageCust.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Join Queue'));
    btn?.click();
  });
  await delay(600);

  // Tap Get Token
  await pageCust.evaluate(() => {
    document.getElementById('confirm-join-queue-btn')?.click();
  });
  await delay(1400);

  // Verify Token Page elements
  const tokenVal = await pageCust.evaluate(() => {
    return document.getElementById('live-ticket-token')?.textContent;
  });
  console.log('✓ Token Minted:', tokenVal);

  // 3. Open Staff Dashboard
  console.log('[3/7] Testing Staff Dashboard Realtime Sync...');
  await pageStaff.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(1000);

  await pageStaff.evaluate(() => {
    const staffBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Staff'));
    staffBtn?.click();
  });
  await delay(1000);

  // Staff calls customer
  console.log('[4/7] Testing Call & Acknowledgement Sync...');
  await pageStaff.evaluate(() => {
    const callBtn = document.querySelector('[id^="action-call-"]');
    callBtn?.click();
  });
  await delay(1000);

  // Customer taps "I'm on my way"
  await pageCust.evaluate(() => {
    const onWayBtn = document.getElementById('im-on-my-way-btn');
    onWayBtn?.click();
  });
  await delay(1000);

  // Verify Staff Dashboard displays acknowledged state
  const ackText = await pageStaff.evaluate(() => {
    return document.body.innerText.includes('Customer acknowledged') || document.body.innerText.includes('On the way');
  });
  console.log('✓ Staff Dashboard Acknowledgement Sync:', ackText);

  // 5. Staff starts service
  console.log('[5/7] Testing Start Service & Billing Module...');
  await pageStaff.evaluate(() => {
    const startBtn = document.querySelector('[id^="action-start-"]');
    startBtn?.click();
  });
  await delay(1200);

  // Customer reports Paid Cash
  console.log('[6/7] Testing Paid Cash & Staff Confirmation...');
  await pageCust.evaluate(() => {
    const payCashBtn = document.getElementById('pay-cash-btn');
    payCashBtn?.click();
  });
  await delay(1000);

  // Staff confirms cash
  await pageStaff.evaluate(() => {
    const confirmCashBtn = document.querySelector('[id^="confirm-cash-btn-"]');
    confirmCashBtn?.click();
  });
  await delay(1000);

  // Staff completes service
  console.log('[7/7] Testing Service Completion & Thank You Screen...');
  await pageStaff.evaluate(() => {
    const completeBtn = document.querySelector('[id^="action-complete-"]');
    completeBtn?.click();
  });
  await delay(1500);

  // Verify Thank You Screen
  const thankYouText = await pageCust.evaluate(() => {
    return document.getElementById('customer-complete-screen')?.innerText;
  });
  console.log('✓ Thank You Screen Rendered:', thankYouText?.includes('Thank You!'));

  // Check errors
  console.log('Customer Page Errors:', custErrors);
  console.log('Staff Page Errors:', staffErrors);

  await browser.close();

  if (custErrors.length === 0 && staffErrors.length === 0 && Boolean(tokenVal) && ackText && thankYouText?.includes('Thank You!')) {
    console.log('SUCCESS: E2E FULL MAIN VERIFICATION PASSED PERFECTLY!');
  } else {
    console.error('FAILED: E2E verification encountered errors');
    process.exit(1);
  }
}

verifyMainE2E().catch((err) => {
  console.error('E2E Verification Error:', err);
  process.exit(1);
});
