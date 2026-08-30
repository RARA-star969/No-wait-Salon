/**
 * Review-request chain verification: a real completed Salon visit -> owner
 * "Request Review" -> the customer's persisted inbox notification -> its deep
 * link into the existing review flow on that business, with duplicate-request
 * blocking proven against the live server.
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const BASE = process.argv[2];
const auth = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const OUT = process.argv[4];
const results = [];
const failures = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

const api = async (method, url, body, headers = {}) => {
  const response = await fetch(`${BASE}${url}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, data: text && !text.startsWith('<') ? JSON.parse(text) : null };
};
const customer = { Authorization: `Bearer ${auth.token}` };
const staff = { 'x-test-business-id': 'salon-1', 'x-test-staff-role': 'owner' };

// A brand-new real visit, taken all the way to a genuine completion.
const sessionId = `review-session-${Date.now()}`;
const joined = await api('POST', '/api/salons/salon-1/commands', {
  type: 'join',
  item: { id: 'ignored', name: 'Review Customer', service: 'Haircut', status: 'Waiting', createdAt: Date.now(), sessionId },
}, customer);
const entryId = joined.data.queue.find((item) => item.sessionId === sessionId).id;
check('a real customer booking was created', Boolean(entryId), entryId);

const premature = await api('POST', '/api/staff/business/review-requests', { queueEntryId: entryId }, staff);
check('an uncompleted booking cannot be asked for a review', premature.status === 409, `${premature.status} ${premature.data?.code}`);

await api('POST', '/api/salons/salon-1/commands', { type: 'queue_action', itemId: entryId, action: 'Call' }, staff);
await api('POST', '/api/salons/salon-1/commands', { type: 'queue_action', itemId: entryId, action: 'Start' }, staff);
await api('POST', '/api/salons/salon-1/commands', { type: 'queue_action', itemId: entryId, action: 'Complete' }, staff);

const requested = await api('POST', '/api/staff/business/review-requests', { queueEntryId: entryId }, staff);
check('a completed visit can be asked for a review', requested.status === 201, String(requested.status));
check('the request wording is neutral and platform-authored',
  /How was your visit\?/.test(requested.data?.notification?.title || '')
  && /Rate your experience/.test(requested.data?.notification?.body || '')
  && !/star|good review|positive/i.test(`${requested.data?.notification?.title} ${requested.data?.notification?.body}`),
  `${requested.data?.notification?.title} / ${requested.data?.notification?.body}`);

const duplicate = await api('POST', '/api/staff/business/review-requests', { queueEntryId: entryId }, staff);
check('a duplicate review request is blocked', duplicate.status === 409 && duplicate.data?.code === 'ALREADY_REQUESTED',
  `${duplicate.status} ${duplicate.data?.code}`);

const inbox = await api('GET', '/api/me/notifications', undefined, customer);
const stored = inbox.data.notifications.filter((n) => n.type === 'review_request');
check('exactly one review-request notification is stored', stored.length === 1, `count=${stored.length}`);
check('the stored notification deep-links to the review flow for that business',
  stored[0]?.deepLink?.kind === 'review' && stored[0]?.deepLink?.businessId === 'salon-1',
  JSON.stringify(stored[0]?.deepLink));

// Now drive the customer app: the inbox row must carry the review CTA and
// route into the existing business review surface.
const browser = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluateOnNewDocument((token) => {
  localStorage.setItem('no_wait_salon_customer_onboarding_v1', 'complete');
  localStorage.setItem('no_wait_salon_customer_notification_prompt_v1', 'done');
  localStorage.setItem('no_wait_salon_customer_location_v1', JSON.stringify({ mode: 'manual', area: 'Indiranagar', label: 'Indiranagar, Bengaluru', setupCompleted: true, latitude: 12.9784, longitude: 77.6408 }));
  localStorage.setItem('no_wait_salon_customer_auth_v1', token);
}, JSON.stringify(auth));
await page.goto(`${BASE}/?mode=customer`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 1600));
await (await page.$('#sticky-scan-qr button[aria-label^="Alerts"]')).click();
await new Promise((r) => setTimeout(r, 1200));

const row = await page.evaluate(() => {
  const button = Array.from(document.querySelectorAll('#customer-notifications-screen button'))
    .find((b) => b.textContent.includes('How was your visit?'));
  return button ? { text: button.textContent.replace(/\s+/g, ' ').trim().slice(0, 140), hasCta: button.textContent.includes('Rate your experience') } : null;
});
check('the review request appears in the customer inbox', Boolean(row), row?.text || 'not found');
check('its CTA is the review action, not a generic one', Boolean(row?.hasCta));
await page.screenshot({ path: `${OUT}/review-request-inbox-390.png` });

await page.evaluate(() => {
  const button = Array.from(document.querySelectorAll('#customer-notifications-screen button'))
    .find((b) => b.textContent.includes('How was your visit?'));
  if (button) button.click();
});
await new Promise((r) => setTimeout(r, 2200));
const landed = await page.evaluate(() => {
  const text = document.body.textContent || '';
  return {
    onBusinessPage: !document.getElementById('customer-home-screen') && !document.getElementById('customer-notifications-screen'),
    mentionsSalon: text.includes('Sharpcut Studio'),
    hasReviewSurface: /review/i.test(text),
  };
});
check('tapping the review request leaves the inbox for the business surface', landed.onBusinessPage, JSON.stringify(landed));
check('it lands on the requesting business, with its review surface present',
  landed.mentionsSalon && landed.hasReviewSurface, JSON.stringify(landed));
await page.screenshot({ path: `${OUT}/review-request-landing-390.png` });

await browser.close();
fs.writeFileSync(`${OUT}/review-chain.txt`, results.join('\n'));
console.log(results.join('\n'));
console.log('\n' + (failures.length ? `FAILURES (${failures.length}):\n` + failures.join('\n') : 'REVIEW CHAIN VERIFIED'));
process.exit(failures.length ? 1 : 0);
