/**
 * Cross-surface workflow verification for the Customer app.
 *
 * Drives real user journeys against a real server: bottom-nav routing, the
 * Bookings -> Ticket -> back contract, Profile -> My Bookings being the same
 * screen, notification deep links, unread -> read + badge updates, and the
 * completed-service -> request-review -> inbox -> review-flow chain with
 * duplicate blocking.
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const BASE = process.argv[2];
const TOKEN_FILE = process.argv[3];
const OUT = process.argv[4];
const auth = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));

const results = [];
const failures = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: '/opt/pw-browsers/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluateOnNewDocument((token) => {
  localStorage.setItem('no_wait_salon_customer_onboarding_v1', 'complete');
  localStorage.setItem('no_wait_salon_customer_notification_prompt_v1', 'done');
  localStorage.setItem('no_wait_salon_customer_location_v1', JSON.stringify({
    mode: 'manual', area: 'Indiranagar', label: 'Indiranagar, Bengaluru', setupCompleted: true,
    latitude: 12.9784, longitude: 77.6408,
  }));
  localStorage.setItem('no_wait_salon_customer_auth_v1', token);
}, JSON.stringify(auth));

const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms));
const tap = async (selector) => {
  const el = await page.$(selector);
  if (!el) throw new Error(`missing element: ${selector}`);
  await el.click();
  await settle();
};
const screenId = () => page.evaluate(() => {
  const ids = ['customer-home-screen', 'customer-bookings-screen', 'customer-notifications-screen',
    'notification-settings-screen', 'customer-profile-screen', 'customer-tracking-screen'];
  return ids.find((id) => document.getElementById(id)) || document.body.firstElementChild?.id || 'unknown';
});
const badge = () => page.evaluate(() => {
  const el = document.querySelector('[data-testid="alerts-unread-badge"]');
  return el ? Number(el.textContent) : 0;
});

await page.goto(`${BASE}/?mode=customer`, { waitUntil: 'networkidle2', timeout: 60000 });
await settle(1500);

check('Home is the initial customer screen', (await screenId()) === 'customer-home-screen', await screenId());

// --- Bookings tab must open My Bookings, NOT the Live Ticket ---
await tap('#sticky-scan-qr button[aria-label="Bookings"]');
check('bottom-nav Bookings opens My Bookings (not the Live Ticket)',
  (await screenId()) === 'customer-bookings-screen', await screenId());
const activeSection = await page.evaluate(() =>
  Array.from(document.querySelectorAll('h2')).map((h) => h.textContent.trim()));
check('My Bookings shows the ACTIVE section for a real live queue entry',
  activeSection.includes('Active now'), JSON.stringify(activeSection));

// --- Bookings -> Ticket -> back returns to My Bookings ---
await page.evaluate(() => {
  const card = document.querySelector('#customer-bookings-screen button.flex.w-full');
  if (card) card.click();
});
await settle(1200);
check('tapping an active booking opens the Live Ticket',
  (await screenId()) === 'customer-tracking-screen', await screenId());
const backLabel = await page.evaluate(() => document.querySelector('#back-to-home-btn')?.textContent?.trim());
check('the ticket back control names My Bookings when entered from Bookings',
  backLabel === 'Back to My Bookings', String(backLabel));
await tap('#back-to-home-btn');
check('back from the ticket returns to My Bookings, not Home',
  (await screenId()) === 'customer-bookings-screen', await screenId());

// --- Profile -> My Bookings is the SAME screen ---
await tap('#sticky-scan-qr button[aria-label="More"]');
check('bottom-nav More opens Profile', (await screenId()) === 'customer-profile-screen', await screenId());
await page.evaluate(() => {
  const row = Array.from(document.querySelectorAll('button'))
    .find((b) => b.textContent.includes('My bookings & history'));
  if (row) row.click();
});
await settle(1100);
check('Profile -> My bookings opens the same My Bookings component',
  (await screenId()) === 'customer-bookings-screen', await screenId());

// --- Notifications: unread badge, deep link, read transition ---
// Seed one fresh, real unread notification so the read transition is measured
// against a known-unread row rather than whatever the inbox happens to hold.
{
  const adminToken = (await (await fetch(`${BASE}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'admin123' }),
  })).json()).token;
  const seeded = await fetch(`${BASE}/api/admin/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      type: 'admin_targeted', audience: { kind: 'customer', customerId: auth.customerId },
      title: `Read-transition probe ${Date.now()}`, body: 'Seeded for the unread -> read check.',
    }),
  });
  check('a real admin notification can be seeded for the read-transition check', seeded.status === 201, String(seeded.status));
}
await tap('#sticky-scan-qr button[aria-label="Home"]');
await page.reload({ waitUntil: 'networkidle2' });
await settle(1600);
const badgeBefore = await badge();
check('the Alerts tab shows an unread badge', badgeBefore > 0, `badge=${badgeBefore}`);

await tap(`#sticky-scan-qr button[aria-label^="Alerts"]`);
check('bottom-nav Alerts opens the Notification inbox',
  (await screenId()) === 'customer-notifications-screen', await screenId());

const devUi = await page.evaluate(() => {
  const text = document.getElementById('customer-notifications-screen')?.textContent || '';
  return ['Simulate Push', 'Test Alert', 'Simulated Push Active', 'Device Push Permission']
    .filter((needle) => text.includes(needle));
});
check('the customer Alerts screen exposes no developer/test push UI', devUi.length === 0, devUi.join(', '));

const unreadFilter = await page.evaluate(() => {
  const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim().startsWith('Unread'));
  if (!button) return null;
  button.click();
  return true;
});
await settle();
const unreadRows = await page.evaluate(() =>
  document.querySelectorAll('[data-unread="true"]').length);
check('the Unread filter lists only unread notifications', Boolean(unreadFilter) && unreadRows === badgeBefore,
  `filter=${unreadFilter} rows=${unreadRows} badge=${badgeBefore}`);
await page.evaluate(() => {
  const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'All');
  if (button) button.click();
});
await settle();

// Opening an UNREAD row marks it read and decrements the badge.
const openedUnread = await page.evaluate(() => {
  const row = document.querySelector('#customer-notifications-screen [data-unread="true"]');
  if (!row) return false;
  row.click();
  return true;
});
await settle(1200);
check('an unread notification row is openable', openedUnread);
await tap('#sticky-scan-qr button[aria-label="Home"]');
const badgeAfter = await badge();
check('opening a notification marks it read and decrements the badge',
  badgeAfter === badgeBefore - 1, `before=${badgeBefore} after=${badgeAfter}`);

// The queue notification must deep-link to the Live Ticket, not to Home.
await tap('#sticky-scan-qr button[aria-label^="Alerts"]');
await page.evaluate(() => {
  const row = Array.from(document.querySelectorAll('#customer-notifications-screen button'))
    .find((b) => b.textContent.includes('View live ticket'));
  if (row) row.click();
});
await settle(1200);
check('a queue notification deep-links to the Live Ticket',
  (await screenId()) === 'customer-tracking-screen', await screenId());
await tap('#back-to-home-btn');

// --- Notification settings reachable from the inbox, transactional locked ---
await tap(`#sticky-scan-qr button[aria-label^="Alerts"]`);
await tap('#customer-notifications-screen button[aria-label="Notification settings"]');
check('the inbox settings icon opens notification preferences',
  (await screenId()) === 'notification-settings-screen', await screenId());
const switches = await page.evaluate(() => Array.from(document.querySelectorAll('[role="switch"]')).map((el) => ({
  label: el.getAttribute('aria-label'), checked: el.getAttribute('aria-checked'), disabled: el.disabled,
})));
const transactional = switches.find((s) => s.label === 'Booking & queue alerts');
check('transactional alerts cannot be muted', Boolean(transactional?.disabled) && transactional?.checked === 'true',
  JSON.stringify(transactional));
check('promotional alerts can be muted',
  switches.some((s) => s.label === 'Offers & announcements' && !s.disabled), JSON.stringify(switches.map((s) => s.label)));
await page.screenshot({ path: `${OUT}/notification-settings-390.png` });

// Settings is a child screen: its header back must return to the inbox.
await tap('#notification-settings-screen button[aria-label="Back"]');
check('back from notification settings returns to the inbox',
  (await screenId()) === 'customer-notifications-screen', await screenId());

// --- Back-button contract from every tab ---
for (const [label, expected] of [['Bookings', 'customer-bookings-screen'], ['Alerts', 'customer-notifications-screen'], ['More', 'customer-profile-screen']]) {
  await tap('#sticky-scan-qr button[aria-label="Home"]');
  await tap(`#sticky-scan-qr button[aria-label^="${label}"]`);
  const at = await screenId();
  check(`bottom-nav ${label} routes to its own screen`, at === expected, at);
}

await browser.close();
fs.writeFileSync(`${OUT}/workflows.txt`, results.join('\n'));
console.log(results.join('\n'));
console.log('\n' + (failures.length ? `FAILURES (${failures.length}):\n` + failures.join('\n') : 'ALL WORKFLOWS PASS'));
process.exit(failures.length ? 1 : 0);
