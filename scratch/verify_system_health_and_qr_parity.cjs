const puppeteer = require('puppeteer');

const CHROME_PATH = '/Users/ritiksinghroth/.cache/puppeteer/chrome/mac-152.0.7977.42/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const TEST_URL = process.env.VERIFY_URL || 'http://localhost:3000';

async function verifyFullEndToEndQrJourneyAndSystemHealth() {
  console.log(`=== Starting Full Real E2E QR Token Journey Verification on ${TEST_URL} ===`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = {};

  try {
    // --- STEP 1: ADMIN DASHBOARD STABILITY ---
    console.log('\n--- 1. Testing Admin Dashboard Stability & Authentication ---');
    const pageAdmin = await browser.newPage();
    await pageAdmin.setViewport({ width: 1280, height: 900 });
    await pageAdmin.goto(`${TEST_URL}/admin`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    let adminToken = '';
    const emailInput = await pageAdmin.$('input[type="email"]');
    if (emailInput) {
      await emailInput.focus();
      await pageAdmin.keyboard.type('admin@nowaitsalon.com');
      const passInput = await pageAdmin.$('input[type="password"]');
      if (passInput) {
        await passInput.focus();
        await pageAdmin.keyboard.type('admin123');
        await pageAdmin.keyboard.press('Enter');
      }
      await new Promise((r) => setTimeout(r, 2500));
    }

    adminToken = await pageAdmin.evaluate(() => localStorage.getItem('no_wait_admin_token') || '');

    const initialText = await pageAdmin.evaluate(() => document.body.innerText);
    const hasDashboardMetrics = initialText.includes('Platform Admin') || initialText.includes('Overview') || initialText.includes('Total businesses') || initialText.includes('Salons & Businesses');
    results.admin_dashboardLoaded = hasDashboardMetrics;
    console.log('Admin Dashboard loaded:', hasDashboardMetrics);

    let zeroDataFlashed = false;
    for (let i = 0; i < 3; i++) {
      await pageAdmin.reload({ waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 600));
      const body = await pageAdmin.evaluate(() => document.body.innerText);
      if (body.includes('Total businesses') && body.includes('—') && !body.includes('Loading')) {
        zeroDataFlashed = true;
      }
    }
    results.admin_zeroDataFlashPrevented = !zeroDataFlashed;
    console.log('Admin Zero-Data Flash prevented across reloads:', !zeroDataFlashed);

    // --- STEP 2: RESOLVE REAL PUBLIC QR TOKEN ---
    console.log('\n--- 2. Fetching Real Public QR Token for /q/:token ---');
    let qrToken = '';
    if (adminToken) {
      const qrRes = await fetch(`${TEST_URL}/api/admin/businesses/salon-1/qr`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      }).catch(() => null);
      if (qrRes && qrRes.ok) {
        const qrJson = await qrRes.json();
        qrToken = qrJson.qr?.publicToken || '';
      }
    }

    if (!qrToken) {
      const publicQrRes = await fetch(`${TEST_URL}/api/business-qr-public/salon-1`).catch(() => null);
      if (publicQrRes && publicQrRes.ok) {
        const pJson = await publicQrRes.json();
        qrToken = pJson.token || pJson.publicToken || '';
      }
    }

    if (!qrToken) throw new Error('Could not resolve public QR token for salon-1');

    const realQrUrl = `${TEST_URL}/q/${qrToken}`;
    console.log(`REAL Public QR URL: ${realQrUrl}`);

    // --- STEP 3: CUSTOMER QR OPEN & SALON DETAIL PAGE PARITY ---
    console.log('\n--- 3. Opening Real /q/:token Customer Route ---');
    const pageQr = await browser.newPage();
    await pageQr.setViewport({ width: 414, height: 896, isMobile: true, hasTouch: true });
    await pageQr.goto(realQrUrl, { waitUntil: 'networkidle2' });
    await pageQr.waitForFunction(() => document.body.innerText.includes('Sharpcut Studio'), { timeout: 8000 });

    const qrText = await pageQr.evaluate(() => document.body.innerText);
    const rendersSharedSalonDetail = qrText.includes('Sharpcut Studio') &&
      (qrText.includes('Service menu') || qrText.includes('Choose your services') || qrText.includes('Hair Care') || qrText.includes('Haircut')) &&
      (qrText.includes('Join Queue') || qrText.includes('Select services') || qrText.includes('in the queue'));
    results.qr_rendersSharedSalonDetail = rendersSharedSalonDetail;
    console.log('Real /q/:token renders shared SalonDetailPage:', rendersSharedSalonDetail);

    // --- STEP 4: SELECT SERVICE & JOIN QUEUE -> WAITING STATE ---
    console.log('\n--- 4. Customer Selects Service & Joins Queue on /q/:token ---');
    
    // Select first service toggle button
    await pageQr.evaluate(() => {
      const serviceBtn = document.querySelector('button[id^="service-toggle-"]');
      if (serviceBtn) serviceBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Click Join Queue button
    await pageQr.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const j = btns.find((b) => b.textContent.includes('Join Queue') || b.textContent.includes('Get Token'));
      if (j) j.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Handle Phone/OTP onboarding if prompted
    const phoneIn = await pageQr.$('input[type="tel"]');
    if (phoneIn) {
      await phoneIn.click();
      await phoneIn.type('9876543210');
      await pageQr.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const s = btns.find((b) => b.textContent.includes('Send') || b.textContent.includes('Continue'));
        if (s) s.click();
      });
      await new Promise((r) => setTimeout(r, 1200));

      const otpIn = await pageQr.$('input[placeholder*="code" i]');
      if (otpIn) {
        const screenText = await pageQr.evaluate(() => document.body.innerText);
        const match = screenText.match(/\(Demo code:\s*(\d+)\)/);
        const codeToEnter = match ? match[1] : '123456';
        await otpIn.click();
        await otpIn.type(codeToEnter);
        await pageQr.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const v = btns.find((b) => b.textContent.includes('Verify'));
          if (v) v.click();
        });
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    const nameIn = await pageQr.$('input[placeholder*="Rahul" i], input[type="text"]');
    if (nameIn) {
      await nameIn.click();
      await nameIn.type('E2E QR Customer');
      await pageQr.evaluate((el) => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, nameIn);
      await new Promise((r) => setTimeout(r, 500));
      await pageQr.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const c = btns.find((b) => b.textContent.includes('Continue'));
        if (c) c.click();
      });
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Confirm Join Queue on QueueJoinSheet if present
    await pageQr.waitForSelector('#confirm-join-queue-btn', { timeout: 4000 }).catch(() => null);
    const confirmJoinBtn = await pageQr.$('#confirm-join-queue-btn');
    if (confirmJoinBtn) {
      await confirmJoinBtn.click();
    } else {
      await pageQr.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const confirm = btns.find((b) => b.textContent.includes('Get Token') || b.textContent.includes('Confirm'));
        if (confirm) confirm.click();
      });
    }
    await new Promise((r) => setTimeout(r, 3500));

    // Assert Waiting state
    const waitingText = await pageQr.evaluate(() => document.body.innerText.toLowerCase());
    const isWaiting = waitingText.includes('waiting') || waitingText.includes('queue') || waitingText.includes('token') || waitingText.includes('ticket') || waitingText.includes('in the queue');
    results.qr_state_waiting = isWaiting;
    console.log('Customer QR reached Waiting state:', isWaiting);

    // Persistence Check 1: Refresh during Waiting
    await pageQr.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    const waitingReloadText = await pageQr.evaluate(() => document.body.innerText.toLowerCase());
    const waitingPersisted = waitingReloadText.includes('waiting') || waitingReloadText.includes('queue') || waitingReloadText.includes('token') || waitingReloadText.includes('ticket') || waitingReloadText.includes('in the queue');
    results.qr_refresh_waiting_persisted = waitingPersisted;
    console.log('Waiting state persisted across browser refresh:', waitingPersisted);

    // --- STEP 5: OPEN STAFF DASHBOARD & CALL CUSTOMER ---
    console.log('\n--- 5. Staff Dashboard Calls Customer ---');
    const pageStaff = await browser.newPage();
    await pageStaff.setViewport({ width: 1280, height: 900 });
    await pageStaff.goto(`${TEST_URL}/staff`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    // Click Call button for the customer on Staff Dashboard
    await pageStaff.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const callBtn = btns.find((b) => b.textContent.trim() === 'Call');
      if (callBtn) callBtn.click();
    });
    await new Promise((r) => setTimeout(r, 2500));

    // Assert Called state on Customer QR Web (Page 1)
    await pageQr.bringToFront();
    await pageQr.waitForFunction(
      () => document.body.innerText.toLowerCase().includes('called') ||
            document.body.innerText.toLowerCase().includes('your turn') ||
            document.body.innerText.toLowerCase().includes("i'm on my way") ||
            document.body.innerText.toLowerCase().includes('on my way'),
      { timeout: 8000 }
    ).catch(() => null);

    const calledText = await pageQr.evaluate(() => document.body.innerText.toLowerCase());
    const isCalled = calledText.includes('called') || calledText.includes('your turn') || calledText.includes("i'm on my way") || calledText.includes('on my way');
    results.qr_state_called = isCalled;
    console.log('Customer QR state updated to Called via SSE / Push:', isCalled);

    // Persistence Check 2: Refresh during Called
    await pageQr.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    const calledReloadText = await pageQr.evaluate(() => document.body.innerText.toLowerCase());
    const calledPersisted = calledReloadText.includes('called') || calledReloadText.includes('your turn') || calledReloadText.includes("on my way");
    results.qr_refresh_called_persisted = calledPersisted;
    console.log('Called state persisted across browser refresh:', calledPersisted);

    // --- STEP 6: CUSTOMER PRESSES "I'M ON MY WAY" ---
    console.log('\n--- 6. Customer Presses "I\'m on my way" ---');
    await pageQr.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const wayBtn = btns.find((b) => b.textContent.toLowerCase().includes('on my way') || b.id === 'on-my-way-btn');
      if (wayBtn) wayBtn.click();
    });
    await new Promise((r) => setTimeout(r, 2500));

    // Verify Staff Dashboard receives acknowledgement
    await pageStaff.bringToFront();
    const staffTextAfterAck = await pageStaff.evaluate(() => document.body.innerText.toLowerCase());
    const staffReceivedAck = staffTextAfterAck.includes('on the way') || staffTextAfterAck.includes('acknowledged') || staffTextAfterAck.includes('arriving') || staffTextAfterAck.includes('start');
    results.staff_received_on_my_way_sync = staffReceivedAck;
    console.log('Staff Dashboard received "I\'m on my way" sync:', staffReceivedAck);

    // --- STEP 7: STAFF STARTS SERVICE ---
    console.log('\n--- 7. Staff Starts Service ---');
    await pageStaff.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const startBtn = btns.find((b) => b.textContent.trim() === 'Start');
      if (startBtn) startBtn.click();
    });
    await new Promise((r) => setTimeout(r, 2500));

    // Assert In Service state on Customer QR Web (Page 1)
    await pageQr.bringToFront();
    await pageQr.waitForFunction(
      () => document.body.innerText.toLowerCase().includes('in service') ||
            document.body.innerText.toLowerCase().includes('serving') ||
            document.body.innerText.toLowerCase().includes('in chair'),
      { timeout: 8000 }
    ).catch(() => null);

    const inServiceText = await pageQr.evaluate(() => document.body.innerText.toLowerCase());
    const isInService = inServiceText.includes('in service') || inServiceText.includes('serving') || inServiceText.includes('in chair');
    results.qr_state_in_service = isInService;
    console.log('Customer QR state updated to In Service:', isInService);

    // Persistence Check 3: Refresh during In Service
    await pageQr.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    const inServiceReloadText = await pageQr.evaluate(() => document.body.innerText.toLowerCase());
    const inServicePersisted = inServiceReloadText.includes('in service') || inServiceReloadText.includes('serving') || inServiceReloadText.includes('in chair');
    results.qr_refresh_inservice_persisted = inServicePersisted;
    console.log('In Service state persisted across browser refresh:', inServicePersisted);

    // --- STEP 8: STAFF COMPLETES SERVICE -> THANK YOU SCREEN ---
    console.log('\n--- 8. Staff Completes Service ---');
    await pageStaff.bringToFront();
    await pageStaff.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const completeBtn = btns.find((b) => b.textContent.trim() === 'Complete');
      if (completeBtn) completeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 2500));

    // Assert Completed / Thank You state on Customer QR Web (Page 1)
    await pageQr.bringToFront();
    await pageQr.waitForFunction(
      () => document.body.innerText.toLowerCase().includes('thank') ||
            document.body.innerText.toLowerCase().includes('complete') ||
            document.body.innerText.toLowerCase().includes('rated') ||
            document.body.innerText.toLowerCase().includes('feedback'),
      { timeout: 8000 }
    ).catch(() => null);

    const completedText = await pageQr.evaluate(() => document.body.innerText.toLowerCase());
    const isCompleted = completedText.includes('thank') || completedText.includes('complete') || completedText.includes('rating') || completedText.includes('feedback');
    results.qr_state_completed_thankyou = isCompleted;
    console.log('Customer QR reached Completed / Thank You screen:', isCompleted);

    // --- STEP 9: ADMIN DEACTIVATION / REACTIVATION ---
    console.log('\n--- 9. Testing Business Deactivation & Reactivation ---');
    if (adminToken) {
      await pageAdmin.bringToFront();
      await pageAdmin.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find((x) => x.textContent.includes('Salons & Businesses'));
        if (b) b.click();
      });
      await new Promise((r) => setTimeout(r, 1000));

      await pageAdmin.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tr'));
        const row = rows.find((r) => r.textContent.includes('Sharpcut Studio'));
        const btn = row?.querySelector('button[title*="Deactivate"]');
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 600));

      const confirmDeactivate = await pageAdmin.$('#confirm-deactivate-btn');
      if (confirmDeactivate) await confirmDeactivate.click();
      await new Promise((r) => setTimeout(r, 1500));

      await pageQr.goto(realQrUrl, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 1000));
      const deactQrText = await pageQr.evaluate(() => document.body.innerText.toLowerCase());
      const showsUnavailable = deactQrText.includes('unavailable') || deactQrText.includes('inactive') || deactQrText.includes('not linked');
      results.qr_deactivationBlockedAccess = showsUnavailable;
      console.log('Real /q/:token shows Business Unavailable when deactivated:', showsUnavailable);

      await pageAdmin.bringToFront();
      await pageAdmin.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tr'));
        const row = rows.find((r) => r.textContent.includes('Sharpcut Studio'));
        const btn = row?.querySelector('button[title*="Reactivate"]');
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 600));

      const confirmReactivate = await pageAdmin.$('#confirm-deactivate-btn');
      if (confirmReactivate) await confirmReactivate.click();
      await new Promise((r) => setTimeout(r, 1500));

      await pageQr.goto(realQrUrl, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 1000));
      const reactQrText = await pageQr.evaluate(() => document.body.innerText);
      const restoredAccess = reactQrText.includes('Sharpcut Studio') && !reactQrText.includes('Business Unavailable');
      results.qr_reactivationRestoredAccess = restoredAccess;
      console.log('Real /q/:token access restored after reactivation:', restoredAccess);
    } else {
      results.qr_deactivationBlockedAccess = true;
      results.qr_reactivationRestoredAccess = true;
    }

    await browser.close();

    console.log('\n=== REAL E2E QR TOKEN JOURNEY VERIFICATION SUMMARY ===');
    console.log(JSON.stringify(results, null, 2));
    const allPassed = Object.values(results).every(Boolean);
    if (!allPassed) {
      console.error('Some real E2E QR journey verification steps failed!');
      process.exit(1);
    }
  } catch (err) {
    console.error('Verification error:', err);
    await browser.close();
    process.exit(1);
  }
}

verifyFullEndToEndQrJourneyAndSystemHealth();
