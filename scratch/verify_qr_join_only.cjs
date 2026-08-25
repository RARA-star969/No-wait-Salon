const puppeteer = require('puppeteer');

const TEST_URL = (process.env.VERIFY_URL || 'https://no-wait-salon-web-test.onrender.com').replace(/\/$/, '');
const allowedHost = new URL(TEST_URL).hostname;
if (!['no-wait-salon-web-test.onrender.com', 'localhost', '127.0.0.1'].includes(allowedHost)) {
  throw new Error(`Refusing to run QR diagnostic against non-test host: ${allowedHost}`);
}

const SALON_ID = 'salon-1';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(path, init = {}) {
  const response = await fetch(`${TEST_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init.method || 'GET'} ${path} -> ${response.status}: ${body.error || 'request failed'}`);
  return body;
}

async function text(page) {
  return (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
}

async function clickText(page, labels) {
  const wanted = Array.isArray(labels) ? labels : [labels];
  const ok = await page.evaluate((terms) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((button) => {
      const value = (button.textContent || '').trim().toLowerCase();
      return terms.some((term) => value.includes(term.toLowerCase()));
    });
    if (!target) return false;
    target.click();
    return true;
  }, wanted);
  if (!ok) throw new Error(`Button not found: ${wanted.join(' / ')}. Screen: ${(await text(page)).slice(0, 700)}`);
}

async function waitForAny(page, selectors, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    for (const selector of selectors) {
      if (await page.$(selector)) return selector;
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${selectors.join(' OR ')}. Screen: ${(await text(page)).slice(0, 900)}`);
}

async function viewportState(page, selector) {
  return page.$eval(selector, (element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
      visible: rect.bottom > 0 && rect.top < window.innerHeight && rect.height > 0,
    };
  });
}

async function main() {
  const qr = await fetchJson(`/api/public/qr-token/${SALON_ID}`);
  if (!qr.token) throw new Error('No active QR token returned for salon-1.');
  const qrUrl = `${TEST_URL}/q/${encodeURIComponent(qr.token)}`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const runtimeErrors = [];
  const badResponses = [];
  let onboardingViewport = null;
  let waitingViewport = null;
  let profileToJoinSheet = false;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 414, height: 896, isMobile: true, hasTouch: true });
    // Reproduce embedded QR browsers where crypto.randomUUID is missing.
    await page.evaluateOnNewDocument(() => {
      try {
        if (globalThis.Crypto?.prototype) Object.defineProperty(globalThis.Crypto.prototype, 'randomUUID', { configurable: true, value: undefined });
      } catch { /* compatibility simulation only */ }
    });
    page.on('pageerror', (error) => {
      runtimeErrors.push(`pageerror: ${error.message}`);
      console.error(`BROWSER PAGE ERROR: ${error.message}`);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        runtimeErrors.push(`console: ${message.text()}`);
        console.error(`BROWSER CONSOLE ERROR: ${message.text()}`);
      }
    });
    page.on('requestfailed', (request) => {
      const line = `${request.method()} ${request.url()} -> ${request.failure()?.errorText || 'failed'}`;
      runtimeErrors.push(`requestfailed: ${line}`);
      console.error(`BROWSER REQUEST FAILED: ${line}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().includes('/api/')) {
        const line = `${response.status()} ${response.request().method()} ${response.url()}`;
        badResponses.push(line);
        console.error(`BROWSER BAD API RESPONSE: ${line}`);
      }
    });

    await page.goto(qrUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('button[id^="service-toggle-"]', { timeout: 12000 });
    console.log('QR_DIAG salon_detail=PASS');

    await page.click('button[id^="service-toggle-"]');
    await sleep(350);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(150);
    await page.evaluate(() => document.querySelector('#join-live-queue-btn')?.click());
    await sleep(350);

    const firstStep = await waitForAny(page, ['#queue-join-sheet', 'input[type="tel"]'], 10000);
    console.log(`QR_DIAG join_click=${firstStep === '#queue-join-sheet' ? 'SHEET' : 'PHONE'}`);
    onboardingViewport = await viewportState(page, firstStep);
    console.log(`QR_DIAG onboarding_visible=${onboardingViewport.visible} scrollY=${onboardingViewport.scrollY}`);
    if (!onboardingViewport.visible || onboardingViewport.scrollY > 8) {
      throw new Error(`QR onboarding exists but is outside the mobile viewport after Join Queue: ${JSON.stringify(onboardingViewport)}`);
    }

    if (firstStep === '#queue-join-sheet') profileToJoinSheet = true;

    if (firstStep === 'input[type="tel"]') {
      const suffix = String(Date.now()).slice(-8);
      const phone = `98${suffix}`;
      const customerName = `QR Test ${suffix.slice(-5)}`;
      await page.type('input[type="tel"]', phone);
      await clickText(page, ['Send verification code', 'Send code']);
      await page.waitForSelector('input[placeholder*="code" i]', { timeout: 10000 });
      const otpScreen = await text(page);
      const otp = otpScreen.match(/Demo code:\s*(\d+)/i)?.[1];
      if (!otp) throw new Error(`OTP screen opened but no demo code was shown. Screen: ${otpScreen.slice(0, 700)}`);
      await page.type('input[placeholder*="code" i]', otp);
      await clickText(page, ['Verify & Continue', 'Verify']);

      const afterVerify = await waitForAny(page, ['#queue-join-sheet', '#qr-profile-gender', 'input[placeholder*="Rahul" i]'], 10000);
      if (afterVerify !== '#queue-join-sheet') {
        await page.waitForSelector('input[placeholder*="Rahul" i]', { timeout: 10000 });
        await page.type('input[placeholder*="Rahul" i]', customerName);
        await page.waitForSelector('#qr-profile-gender', { timeout: 10000 });
        await page.select('#qr-profile-gender', 'Man');
        await clickText(page, ['Continue to Queue']);
        await page.waitForSelector('#queue-join-sheet', { timeout: 10000 });
      }
      profileToJoinSheet = true;
    }

    const servicesInSheet = await page.$$eval('#queue-join-sheet #view-services-btn', (nodes) => nodes.length).catch(() => 0);
    console.log(`QR_DIAG join_sheet=PASS service_summary=${servicesInSheet}`);
    await page.waitForSelector('#confirm-join-queue-btn', { timeout: 10000 });
    await page.click('#confirm-join-queue-btn');

    const started = Date.now();
    let waitingSeen = false;
    while (Date.now() - started < 12000) {
      const body = await text(page);
      if (/You're in the queue!|Queue Status\s*Waiting/i.test(body)) {
        waitingSeen = true;
        break;
      }
      if (runtimeErrors.length) break;
      await sleep(250);
    }

    if (waitingSeen) {
      waitingViewport = await page.evaluate(() => ({
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        bodyHeight: document.documentElement.scrollHeight,
        visibleText: (document.body.innerText || '').includes("You're in the queue!"),
      }));
      if (waitingViewport.scrollY > 8 || !waitingViewport.visibleText) {
        throw new Error(`Waiting ticket rendered outside expected mobile viewport: ${JSON.stringify(waitingViewport)}`);
      }
    }

    const auth = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('no_wait_salon_customer_auth_v1') || 'null'); } catch { return null; }
    });
    let backendEntry = null;
    if (auth?.customerId) {
      const state = await fetchJson(`/api/salons/${SALON_ID}/state`);
      backendEntry = state.queue?.find((item) => item.customerId === auth.customerId) || null;
    }

    console.log(JSON.stringify({
      QR_JOIN_DIAGNOSTIC: {
        onboarding_visible_after_deep_scroll: Boolean(onboardingViewport?.visible),
        onboarding_scroll_y: onboardingViewport?.scrollY ?? null,
        profile_to_join_sheet: profileToJoinSheet,
        embedded_browser_without_random_uuid: true,
        waiting_ui: waitingSeen,
        waiting_scroll_y: waitingViewport?.scrollY ?? null,
        auth_customer: Boolean(auth?.customerId),
        dashboard_backend_entry: Boolean(backendEntry),
        entry_status: backendEntry?.status || null,
        runtime_errors: runtimeErrors,
        bad_api_responses: badResponses,
        final_screen: (await text(page)).slice(0, 1000),
      },
    }, null, 2));

    if (!profileToJoinSheet || !waitingSeen || !backendEntry || runtimeErrors.length) {
      throw new Error('Hosted QR profile/token handoff did not reach a healthy Waiting ticket/backend entry. See QR_JOIN_DIAGNOSTIC above.');
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`QR JOIN DIAGNOSTIC FAILED: ${error.message}`);
  process.exit(1);
});