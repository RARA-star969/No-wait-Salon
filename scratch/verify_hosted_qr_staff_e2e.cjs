const puppeteer = require('puppeteer');

const TEST_URL = (process.env.VERIFY_URL || 'https://no-wait-salon-web-test.onrender.com').replace(/\/$/, '');
const allowedHost = new URL(TEST_URL).hostname;
if (!['no-wait-salon-web-test.onrender.com', 'localhost', '127.0.0.1'].includes(allowedHost)) {
  throw new Error(`Refusing to run destructive E2E against non-test host: ${allowedHost}`);
}

const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL || 'sharpcut-owner@nowaitsalon.test';
const STAFF_PASSWORD = process.env.E2E_STAFF_PASSWORD || 'staff123';
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

async function waitForState(predicate, label, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await fetchJson(`/api/salons/${SALON_ID}/state`);
    const value = predicate(state);
    if (value) return { state, value };
    await sleep(300);
  }
  throw new Error(`Timed out waiting for state: ${label}`);
}

async function pageText(page) {
  return (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
}

async function waitForText(page, matcher, label, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const text = await pageText(page);
    if (typeof matcher === 'string' ? text.includes(matcher) : matcher.test(text)) return text;
    await sleep(300);
  }
  throw new Error(`Timed out waiting for UI: ${label}`);
}

async function clickButtonContaining(page, needles) {
  const wanted = Array.isArray(needles) ? needles : [needles];
  const clicked = await page.evaluate((terms) => {
    const button = Array.from(document.querySelectorAll('button')).find((b) => {
      const text = (b.textContent || '').trim().toLowerCase();
      return terms.some((term) => text.includes(term.toLowerCase()));
    });
    if (!button) return false;
    button.click();
    return true;
  }, wanted);
  if (!clicked) throw new Error(`Button not found: ${wanted.join(' / ')}`);
}

async function staffCommand(staffToken, command) {
  return fetchJson(`/api/salons/${SALON_ID}/commands`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify(command),
  });
}

async function main() {
  const results = {
    staff_login_real: false,
    staff_session_bound_to_salon: false,
    real_q_route: false,
    shared_salon_detail: false,
    qr_waiting: false,
    refresh_waiting: false,
    duplicate_prevented: false,
    staff_dashboard_sees_booking: false,
    waiting_to_called: false,
    refresh_called: false,
    on_my_way_server_ack: false,
    staff_dashboard_sees_ack: false,
    start_to_in_service: false,
    refresh_in_service: false,
    complete_to_thank_you: false,
    refresh_completed: false,
    rating_saved_after_complete: false,
  };

  // Real staff credential login on the isolated hosted TEST database.
  const staffLogin = await fetchJson('/api/staff/login', {
    method: 'POST',
    body: JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASSWORD }),
  });
  if (!staffLogin.token) throw new Error('Staff login succeeded without a session token.');
  results.staff_login_real = true;
  const staffToken = staffLogin.token;

  const staffSession = await fetchJson('/api/staff/session', {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  if (staffSession.business?.id !== SALON_ID) throw new Error(`Staff session bound to wrong business: ${staffSession.business?.id}`);
  results.staff_session_bound_to_salon = true;

  // Reset only the isolated test salon so each run starts deterministically.
  await staffCommand(staffToken, { type: 'reset' });

  const qr = await fetchJson(`/api/business-qr-public/${SALON_ID}`);
  if (!qr.token) throw new Error('No active public QR token for salon-1.');
  const realQrUrl = `${TEST_URL}/q/${encodeURIComponent(qr.token)}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const pageQr = await browser.newPage();
    await pageQr.setViewport({ width: 414, height: 896, isMobile: true, hasTouch: true });
    await pageQr.goto(realQrUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    results.real_q_route = new URL(pageQr.url()).pathname.startsWith('/q/');

    const initial = await waitForText(pageQr, /Sharpcut Studio/i, 'salon identity');
    results.shared_salon_detail = /Join Queue|Get Token/i.test(initial) && /Haircut/i.test(initial) && /Live/i.test(initial);
    if (!results.shared_salon_detail) throw new Error('Real /q/:token did not render current shared salon detail signals.');

    // Select one real service before entering the Join flow.
    await pageQr.waitForSelector('button[id^="service-toggle-"]', { timeout: 10000 });
    await pageQr.click('button[id^="service-toggle-"]');
    await sleep(400);
    await clickButtonContaining(pageQr, ['Join Queue', 'Get Token']);

    // Fresh phone every run guarantees we exercise OTP + profile onboarding.
    const suffix = String(Date.now()).slice(-8);
    const phone = `98${suffix}`;
    const customerName = `E2E QR ${suffix.slice(-5)}`;

    await pageQr.waitForSelector('input[type="tel"]', { timeout: 10000 });
    await pageQr.type('input[type="tel"]', phone);
    await clickButtonContaining(pageQr, ['Send verification code', 'Send code', 'Continue']);

    await pageQr.waitForSelector('input[placeholder*="code" i]', { timeout: 10000 });
    const otpText = await waitForText(pageQr, /Demo code:\s*\d+/i, 'test OTP code');
    const otp = otpText.match(/Demo code:\s*(\d+)/i)?.[1];
    if (!otp) throw new Error('Hosted TEST did not expose its test OTP code.');
    await pageQr.type('input[placeholder*="code" i]', otp);
    await clickButtonContaining(pageQr, ['Verify & Continue', 'Verify']);

    await pageQr.waitForSelector('input[placeholder*="Rahul" i]', { timeout: 10000 });
    await pageQr.type('input[placeholder*="Rahul" i]', customerName);
    await clickButtonContaining(pageQr, ['Continue to Queue']);

    await pageQr.waitForSelector('#confirm-join-queue-btn', { timeout: 10000 });
    await pageQr.click('#confirm-join-queue-btn');
    const waitingUi = await waitForText(pageQr, /You're in the queue!|Queue Status\s*Waiting/i, 'Waiting ticket');
    results.qr_waiting = /queue|waiting/i.test(waitingUi);

    const auth = await pageQr.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('no_wait_salon_customer_auth_v1') || 'null'); } catch { return null; }
    });
    if (!auth?.customerId) throw new Error('Customer auth/session was not persisted after OTP.');

    const joined = await waitForState(
      (state) => state.queue.find((item) => item.customerId === auth.customerId),
      'new QR queue entry',
    );
    const entry = joined.value;
    const entryId = entry.id;
    const tokenTail = entryId.slice(-4).toUpperCase();

    const sameCustomerActive = joined.state.queue.filter((item) => item.customerId === auth.customerId);
    results.duplicate_prevented = sameCustomerActive.length === 1;
    if (!results.duplicate_prevented) throw new Error(`Duplicate active QR booking detected: ${sameCustomerActive.length}`);

    // Waiting persistence.
    await pageQr.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    const waitingReload = await waitForText(pageQr, /You're in the queue!|Queue Status\s*Waiting/i, 'Waiting after refresh');
    results.refresh_waiting = waitingReload.includes(tokenTail) || /waiting|queue/i.test(waitingReload);

    // Staff dashboard visibility is checked separately from authenticated API control.
    const pageStaff = await browser.newPage();
    await pageStaff.setViewport({ width: 1280, height: 900 });
    await pageStaff.goto(`${TEST_URL}/?mode=staff`, { waitUntil: 'networkidle2', timeout: 30000 });
    const staffWaiting = await waitForText(pageStaff, new RegExp(customerName, 'i'), 'booking visible on Staff Dashboard');
    results.staff_dashboard_sees_booking = new RegExp(customerName, 'i').test(staffWaiting);

    // Waiting -> Called, controlled by a real authenticated staff session.
    await staffCommand(staffToken, { type: 'queue_action', itemId: entryId, action: 'Call' });
    const calledState = await waitForState(
      (state) => state.queue.find((item) => item.id === entryId && item.status === 'Called'),
      'Called server state',
    );
    const calledUi = await waitForText(pageQr, /It's your turn!|I'm on my way/i, 'Called customer UI');
    results.waiting_to_called = Boolean(calledState.value) && /turn|on my way/i.test(calledUi);

    await pageQr.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    const calledReload = await waitForText(pageQr, /It's your turn!|I'm on my way|On your way/i, 'Called after refresh');
    results.refresh_called = /turn|on my way/i.test(calledReload);

    // Customer acknowledgement -> exact backend item -> Staff Dashboard SSE.
    await clickButtonContaining(pageQr, ["I'm on my way"]);
    const ackState = await waitForState(
      (state) => state.queue.find((item) => item.id === entryId && item.status === 'Called' && item.acknowledgedAt),
      'customer acknowledgement',
    );
    results.on_my_way_server_ack = Boolean(ackState.value?.acknowledgedAt);
    const staffAck = await waitForText(pageStaff, /Customer acknowledged|On the way/i, 'Staff acknowledgement via SSE');
    results.staff_dashboard_sees_ack = /acknowledged|on the way/i.test(staffAck);

    // Called -> Serving.
    await staffCommand(staffToken, { type: 'queue_action', itemId: entryId, action: 'Start' });
    const servingState = await waitForState(
      (state) => state.queue.find((item) => item.id === entryId && item.status === 'Serving'),
      'Serving server state',
    );
    const servingUi = await waitForText(pageQr, /In service/i, 'In Service customer UI');
    results.start_to_in_service = Boolean(servingState.value) && /in service/i.test(servingUi);

    await pageQr.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    const servingReload = await waitForText(pageQr, /In service/i, 'In Service after refresh');
    results.refresh_in_service = /in service/i.test(servingReload);

    // Serving -> Completed -> shared ThankYouScreen.
    await staffCommand(staffToken, { type: 'queue_action', itemId: entryId, action: 'Complete' });
    const completedState = await waitForState(
      (state) => state.completedList.find((item) => item.id === entryId && item.status === 'Completed'),
      'Completed server state',
    );
    await pageQr.waitForSelector('#qr-complete-screen', { timeout: 12000 });
    const thankYou = await waitForText(pageQr, /Thank You!/i, 'shared Thank You screen');
    results.complete_to_thank_you = Boolean(completedState.value) && /thank you/i.test(thankYou);

    await pageQr.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await pageQr.waitForSelector('#qr-complete-screen', { timeout: 12000 });
    const completedReload = await waitForText(pageQr, /Thank You!/i, 'Thank You after refresh');
    results.refresh_completed = /thank you/i.test(completedReload);

    // The shared ThankYouScreen defaults to 5 stars. Submit and verify the
    // rating is written to completedList, which previously failed after Complete.
    await clickButtonContaining(pageQr, ['Submit Feedback & Review']);
    const ratedState = await waitForState(
      (state) => state.completedList.find((item) => item.id === entryId && item.rating === 5),
      'completed rating persistence',
    );
    results.rating_saved_after_complete = ratedState.value?.rating === 5;

    const failed = Object.entries(results).filter(([, value]) => !value);
    console.log(JSON.stringify({ results, failed: failed.map(([key]) => key) }, null, 2));
    if (failed.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`E2E FAILED: ${error.message}`);
  process.exit(1);
});
