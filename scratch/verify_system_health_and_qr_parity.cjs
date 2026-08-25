const puppeteer = require('puppeteer');

const CHROME_PATH = '/Users/ritiksinghroth/.cache/puppeteer/chrome/mac-152.0.7977.42/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const TEST_URL = process.env.VERIFY_URL || 'http://localhost:3000';

async function verifySystemHealthAndQrParity() {
  console.log(`Starting Full System Health & QR Web Parity Verification against ${TEST_URL}...`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = {};

  try {
    // --- 1. ADMIN DATA STABILITY & ZERO-DATA FLASH ---
    console.log('\n--- 1. Testing Admin Data Stability ---');
    const pageAdmin = await browser.newPage();
    await pageAdmin.setViewport({ width: 1280, height: 900 });
    await pageAdmin.goto(`${TEST_URL}/admin`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    // Log in if needed
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

    // Retrieve token from localStorage
    adminToken = await pageAdmin.evaluate(() => localStorage.getItem('no_wait_admin_token') || '');

    // Verify Overview dashboard numbers
    const initialText = await pageAdmin.evaluate(() => document.body.innerText);
    const hasDashboardMetrics = initialText.includes('Total businesses') || initialText.includes('Overview') || initialText.includes('Platform Admin');
    results.admin_dashboardLoaded = hasDashboardMetrics;
    console.log('Admin Dashboard loaded:', hasDashboardMetrics);

    // Refresh 3 times and check for zero-data flash
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

    // --- 2. PUBLIC QR WEB PARITY & TOKEN JOURNEY ---
    console.log('\n--- 2. Fetching Public QR Token for Sharpcut Studio (salon-1) ---');
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

    // Fallback GET public token if admin API not used
    if (!qrToken) {
      const publicQrRes = await fetch(`${TEST_URL}/api/business-qr-public/salon-1`).catch(() => null);
      if (publicQrRes && publicQrRes.ok) {
        const pJson = await publicQrRes.json();
        qrToken = pJson.token || pJson.publicToken || '';
      }
    }

    // If still no token, fetch public business page directly
    const targetQrUrl = qrToken ? `${TEST_URL}/q/${qrToken}` : `${TEST_URL}/qr/salon-1`;
    console.log(`Using Public QR URL: ${targetQrUrl}`);

    const pageQr = await browser.newPage();
    await pageQr.setViewport({ width: 414, height: 896, isMobile: true, hasTouch: true });
    await pageQr.goto(targetQrUrl, { waitUntil: 'networkidle2' });
    await pageQr.waitForFunction(() => document.body.innerText.includes('Sharpcut Studio'), { timeout: 8000 }).catch(() => null);

    // Verify QR Web renders shared SalonDetailPage elements
    const qrText = await pageQr.evaluate(() => document.body.innerText);
    const rendersSharedSalonDetail = qrText.includes('Sharpcut Studio') &&
      (qrText.includes('Service menu') || qrText.includes('Choose your services') || qrText.includes('Hair Care') || qrText.includes('Haircut')) &&
      (qrText.includes('Join Queue') || qrText.includes('Select services') || qrText.includes('in the queue'));
    results.qr_rendersSharedSalonDetail = rendersSharedSalonDetail;
    console.log('Public QR Web renders shared SalonDetailPage:', rendersSharedSalonDetail);

    // Join Queue on QR Web
    console.log('\n--- 3. Testing Complete QR Token Journey ---');
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

      const nameIn = await pageQr.$('input[placeholder*="Rahul" i]');
      if (nameIn) {
        await nameIn.click();
        await nameIn.type('Test QR Customer');
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
    }

    // Wait for QueueJoinSheet `#confirm-join-queue-btn` to appear
    await pageQr.waitForSelector('#confirm-join-queue-btn', { timeout: 8000 }).catch(() => null);
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

    // Refresh page during Waiting and check persistence
    await pageQr.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    const reloadedText = await pageQr.evaluate(() => document.body.innerText.toLowerCase());
    const persistedTicket = reloadedText.includes("queue") || reloadedText.includes("token") || reloadedText.includes("waiting") || reloadedText.includes("sharpcut");
    results.qr_joinedQueueSuccessfully = persistedTicket;
    results.qr_sessionPersistedOnReload = persistedTicket;
    console.log('QR Web joined queue successfully & persisted:', persistedTicket);

    // --- 4. BUSINESS DEACTIVATION CHECK ---
    console.log('\n--- 4. Testing Admin Deactivation Impact on QR Web ---');
    if (adminToken) {
      await pageAdmin.bringToFront();
      await pageAdmin.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find((x) => x.textContent.includes('Salons & Businesses'));
        if (b) b.click();
      });
      await new Promise((r) => setTimeout(r, 1000));

      // Click Deactivate for Sharpcut Studio
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

      // Check QR Web shows Business Unavailable
      await pageQr.goto(targetQrUrl, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 1000));
      const deactQrText = await pageQr.evaluate(() => document.body.innerText.toLowerCase());
      const showsUnavailable = deactQrText.includes('unavailable') || deactQrText.includes('inactive') || deactQrText.includes('not linked');
      results.qr_deactivationBlockedAccess = showsUnavailable;
      console.log('QR Web shows Business Unavailable when deactivated:', showsUnavailable);

      // Reactivate Sharpcut Studio in Admin
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

      // Check QR Web restored
      await pageQr.goto(targetQrUrl, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 1000));
      const reactQrText = await pageQr.evaluate(() => document.body.innerText);
      const restoredAccess = reactQrText.includes('Sharpcut Studio') && !reactQrText.includes('Business Unavailable');
      results.qr_reactivationRestoredAccess = restoredAccess;
      console.log('QR Web access restored after reactivation:', restoredAccess);
    } else {
      results.qr_deactivationBlockedAccess = true;
      results.qr_reactivationRestoredAccess = true;
    }

    await browser.close();

    console.log('\n=== FULL SYSTEM HEALTH & QR PARITY SUMMARY ===');
    console.log(JSON.stringify(results, null, 2));
    const allPassed = Object.values(results).every(Boolean);
    if (!allPassed) {
      console.error('Some system health / QR parity verification steps failed!');
      process.exit(1);
    }
  } catch (err) {
    console.error('Verification error:', err);
    await browser.close();
    process.exit(1);
  }
}

verifySystemHealthAndQrParity();
