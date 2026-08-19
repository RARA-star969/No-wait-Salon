import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Barber, CustomerAuthSession, CustomerProfile, QueueItem, Salon } from '../src/types.ts';
import { resolveJoinGate, hasVerifiedPhone, missingJoinFields } from '../src/shared/profileReadiness.ts';
import { buildJoinPreview, buildLiveTicket, peopleAheadOf, positionOf, waitMinutesFor } from '../src/shared/liveTicket.ts';
import { toSalonProfile, visibleSections } from '../src/shared/salonProfile.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relative: string) => readFileSync(path.join(projectRoot, relative), 'utf8');

const T0 = 1_700_000_000_000;
const GRACE = 7 * 60_000;

const auth = (overrides: Partial<CustomerAuthSession> = {}): CustomerAuthSession =>
  ({ token: 'tok', phoneNumber: '9876543210', expiresAt: T0 + 60_000, ...overrides }) as CustomerAuthSession;

const profile = (overrides: Partial<CustomerProfile> = {}): CustomerProfile =>
  ({
    customerId: 'c1', phoneNumber: '9876543210', name: 'Aman', email: '', dateOfBirth: '',
    gender: '', anniversary: '', city: '', profilePhotoUrl: '', createdAt: T0, updatedAt: T0,
    ...overrides,
  });

const item = (overrides: Partial<QueueItem> = {}): QueueItem => ({
  id: 'q1', name: 'Aman', service: 'Haircut', status: 'Waiting', createdAt: T0, ...overrides,
});

const barbers: Barber[] = [
  { id: 'b1', name: 'Arjun', status: 'available' },
  { id: 'b2', name: 'Sameer', status: 'busy' },
];

/* ============ 1. Verification is skipped when we already know them ========= */

test('a verified customer with a complete profile joins without being asked again', () => {
  const gate = resolveJoinGate(auth(), profile());
  assert.equal(gate.kind, 'ready');
  assert.equal(gate.kind === 'ready' && gate.name, 'Aman');
  assert.equal(gate.kind === 'ready' && gate.phone, '9876543210');
});

test('an unverified customer is sent through verification', () => {
  assert.equal(resolveJoinGate(null, null).kind, 'needs_verification');
  assert.equal(resolveJoinGate(auth({ token: '' }), profile()).kind, 'needs_verification');
  assert.equal(hasVerifiedPhone(auth({ phoneNumber: '123' })), false, 'a stub number is not a verified mobile');
  assert.equal(resolveJoinGate(auth({ phoneNumber: '123' }), profile()).kind, 'needs_verification');
});

test('a verified customer missing a required detail is asked only for that detail', () => {
  const gate = resolveJoinGate(auth(), profile({ name: '' }));
  assert.equal(gate.kind, 'needs_profile');
  assert.deepEqual(gate.kind === 'needs_profile' && gate.missing, ['name']);
  // Optional fields must never block a join.
  assert.deepEqual(missingJoinFields(profile({ email: '', city: '', dateOfBirth: '' })), []);
});

test('a signed-in customer whose profile is still loading is not pushed into a form', () => {
  assert.equal(resolveJoinGate(auth(), null, { profileLoading: true }).kind, 'loading');
});

test('verification returns to the queue-join sheet rather than joining silently', () => {
  const app = source('src/App.tsx');
  assert.match(app, /resumeJoinSheet: true/, 'the join detour is marked for resume');
  assert.match(app, /if \(action\.resumeJoinSheet\)[\s\S]{0,220}setJoinSheetOpen\(true\)/, 'and it reopens the sheet');
  // The old behaviour opened OTP for every join; it must be gated now.
  assert.match(app, /const gate = resolveJoinGate\(customerAuth, customerProfile, \{ profileLoading \}\)/);
});

/* ==================== 2. Queue position and live wait ===================== */

test('the join preview shows where the customer would land', () => {
  const queue = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c', status: 'Serving' })];
  const preview = buildJoinPreview(queue, barbers);
  assert.equal(preview.peopleAhead, 3);
  assert.equal(preview.projectedPosition, 4, 'joining now would make them fourth');
  assert.equal(preview.openChairs, 1);
  assert.equal(preview.workingChairs, 2);
});

test('position and people-ahead only count customers actually in the queue', () => {
  const mine = item({ id: 'mine', createdAt: T0 + 300 });
  const queue = [
    item({ id: 'first', createdAt: T0 }),
    item({ id: 'done', status: 'Completed', createdAt: T0 + 100 }),
    item({ id: 'gone', status: 'Cancelled', createdAt: T0 + 200 }),
    mine,
  ];
  assert.equal(peopleAheadOf(mine, queue), 1, 'completed and cancelled entries are not ahead of anyone');
  assert.equal(positionOf(mine, queue), 2);
});

test('the wait estimate scales with the chairs actually working', () => {
  assert.equal(waitMinutesFor(4, barbers), 30);
  assert.equal(waitMinutesFor(4, [barbers[0]]), 60, 'one chair means twice the wait');
  assert.equal(waitMinutesFor(0, barbers), 0);
});

/* ================= 3. One shared live-ticket state model ================== */

test('the app and the web build the same ticket from the same snapshot', () => {
  const mine = item({ id: 'mine', status: 'Called', calledAt: T0, graceExpiresAt: T0 + GRACE, callAttempt: 1 });
  const queue = [mine];
  const fromApp = buildLiveTicket(mine, queue, barbers, T0 + 60_000);
  const fromWeb = buildLiveTicket(mine, queue, barbers, T0 + 60_000);
  assert.deepEqual(fromApp, fromWeb);
  assert.equal(fromApp.arrivalCountdown, '06:00');
  assert.equal(fromApp.arrivalWindowOpen, true);
});

test('every terminal state reads distinctly and offers the right actions', () => {
  const cases: Array<[Partial<QueueItem>, string, boolean]> = [
    [{ status: 'Completed', outcome: 'completed' }, 'Service complete', false],
    [{ status: 'NoShow', outcome: 'no_show' }, 'Marked as no show', false],
    [{ status: 'Cancelled', outcome: 'cancelled_customer' }, 'Booking cancelled', false],
    [{ status: 'Cancelled', outcome: 'cancelled_staff' }, 'Cancelled by the salon', false],
    [{ status: 'Serving' }, "You're in the chair", false],
  ];
  for (const [overrides, headline, cancellable] of cases) {
    const entry = item(overrides);
    const ticket = buildLiveTicket(entry, [entry], barbers, T0);
    assert.equal(ticket.headline, headline);
    assert.equal(ticket.availableActions.includes('cancel'), cancellable, `${headline} cancel affordance`);
    assert.equal(ticket.arrivalWindowOpen, false, `${headline} shows no live countdown`);
  }
});

test('an expired arrival window becomes Call Again, not a silent no-show', () => {
  const entry = item({ status: 'Called', calledAt: T0, graceExpiresAt: T0 + GRACE, callAttempt: 1 });
  const ticket = buildLiveTicket(entry, [entry], barbers, T0 + GRACE + 1000);
  assert.equal(ticket.needsCallAgain, true);
  assert.equal(ticket.isNoShow, false);
  assert.equal(ticket.arrivalWindowOpen, false, 'the countdown stops rather than going negative');
});

test('"I\'m on my way" is offered once and never extends the deadline', () => {
  const called = item({ status: 'Called', calledAt: T0, graceExpiresAt: T0 + GRACE });
  const before = buildLiveTicket(called, [called], barbers, T0 + 1000);
  assert.ok(before.availableActions.includes('acknowledge'));

  const acked = item({ ...called, acknowledgedAt: T0 + 2000 });
  const after = buildLiveTicket(acked, [acked], barbers, T0 + 3000);
  assert.equal(after.availableActions.includes('acknowledge'), false, 'not offered twice');
  assert.equal(after.acknowledged, true);
  assert.equal(acked.graceExpiresAt, called.graceExpiresAt, 'the deadline is untouched');
});

test('both surfaces render the one shared LiveTicket component', () => {
  for (const file of ['src/components/CustomerApp.tsx', 'src/components/PublicSalonPage.tsx']) {
    assert.match(source(file), /<LiveTicket/, `${file} uses the shared ticket`);
  }
});

/* ============ 4. The app-download CTA is web-only, always ================= */

/** Comments describe intent; only rendered code can put a CTA on screen. */
const withoutComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the app-download CTA never renders inside the installed Customer app', () => {
  const web = source('src/components/PublicSalonPage.tsx');
  assert.match(web, /web-get-app-cta/, 'the web page keeps the CTA');

  // It must live outside the shared component, or the app would inherit it.
  const shared = withoutComments(source('src/components/LiveTicket.tsx'));
  const app = withoutComments(source('src/components/CustomerApp.tsx'));
  for (const [label, text] of [['the shared ticket', shared], ['the Customer app', app]] as const) {
    for (const forbidden of [/Get app/i, /Get the app/i, /download/i, /web-get-app-cta/]) {
      assert.doesNotMatch(text, forbidden, `${label} renders no app-download CTA`);
    }
  }
});

/* =============== 5. Admin-driven salon content feeds both ================= */

const salon = (overrides: Partial<Salon> = {}): Salon => ({
  id: 'salon-1', name: 'Sharpcut Studio', address: '742, 12th Main Road, Bengaluru',
  distanceKm: 0.8, rating: 4.8, reviewCount: 320, isOpen: true,
  services: [{ id: 's1', name: 'Haircut', durationMin: 30, priceInr: 250, description: 'Precision cut' }],
  defaultBarberCount: 2, latitude: 12.97, longitude: 77.64, openingHours: 'Mon-Sun 9-9',
  description: 'A modern grooming studio.', amenities: ['Wi-Fi'],
  offers: [{ id: 'o1', title: 'Weekday 10% off', discount: '10% OFF' }],
  gallery: [{ id: 'g1', imageUrl: 'https://example.test/1.jpg' }],
  ...overrides,
});

test('an admin edit reaches the app and the web page identically', () => {
  const edited = salon({
    name: 'Sharpcut Studio — Indiranagar',
    services: [{ id: 's1', name: 'Fade', durationMin: 40, priceInr: 400, description: 'Skin fade' }],
    amenities: ['Air conditioned', 'Wi-Fi'],
    openingHours: 'Mon-Sat 10-8',
  });
  const appView = toSalonProfile(edited, { liveWaitMinutes: 12, waitingCustomers: 3 });
  const webView = toSalonProfile({ ...edited, liveWaitMinutes: 12, waitingCustomers: 3 } as never);
  assert.deepEqual(appView, webView);
  assert.equal(appView.services[0].name, 'Fade');
  assert.equal(appView.openingHours, 'Mon-Sat 10-8');
  assert.deepEqual(visibleSections(appView), visibleSections(webView));
});

test('both salon pages are built from the same shared sections', () => {
  const shared = ['SalonServiceMenu', 'SalonAbout', 'SalonLocationHours', 'SalonGallery', 'SalonOffers', 'SalonStylists'];
  for (const file of ['src/components/SalonDetailPage.tsx', 'src/components/PublicSalonPage.tsx']) {
    const text = source(file);
    for (const section of shared) {
      assert.match(text, new RegExp(`<${section}`), `${file} renders ${section}`);
    }
  }
});

test('no salon content is hardcoded into the public web page', () => {
  const web = source('src/components/PublicSalonPage.tsx');
  for (const hardcoded of ['Sharpcut', 'Royal Man', 'Indiranagar']) {
    assert.ok(!web.includes(hardcoded), `the web page does not hardcode "${hardcoded}"`);
  }
});

/* ================ 6. Both scanner entry points are identical ============== */

test('both scanner buttons go through the one opener', () => {
  const app = source('src/components/CustomerApp.tsx');
  const opens = app.match(/onScan=\{openScanner\}|onClick=\{openScanner\}/g) || [];
  assert.equal(opens.length, 2, 'the header icon and the sticky CTA, and nothing else');
  assert.match(app, /const openScanner = useCallback\(\(\) => \{\s*beginScannerSurface\(\);/, 'the opener hides Home first');
});

test('Home is hidden synchronously at tap time, not in a deferred effect', () => {
  const modal = source('src/components/QrScannerModal.tsx');
  assert.match(modal, /useLayoutEffect\(\(\) => \{[\s\S]{0,400}beginScannerSurface\(\)/, 'the modal claims the surface before paint');
  assert.doesNotMatch(modal, /classList\.add\('scanner-open'\)/, 'no ad-hoc class juggling remains');

  // A transition on the way IN is what allowed a translucent first frame.
  const shell = modal.slice(modal.indexOf('id="qr-scanner-modal"'), modal.indexOf('id="qr-scanner-scrim"'));
  const inbound = shell.match(/transition-opacity/g) || [];
  assert.equal(inbound.length, 2, 'both surfaces transition only in the closing branch');
  assert.match(shell, /'opacity-0 transition-opacity[^']*' : 'opacity-100'/, 'the shell fades out, never in');
  assert.match(shell, /'opacity-100' : 'opacity-0 transition-opacity/, 'the cover is opaque from frame one');
});

test('the camera starts only after the covering surface is committed', () => {
  const modal = source('src/components/QrScannerModal.tsx');
  const surfaceAt = modal.indexOf('beginScannerSurface()');
  const cameraAt = modal.indexOf('void startRef.current()');
  assert.ok(surfaceAt > 0 && cameraAt > surfaceAt, 'surface first, camera second');
});
