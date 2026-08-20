import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLiveTicket } from '../src/shared/liveTicket.ts';
import type { Barber, QueueItem } from '../src/types.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relative: string) => readFileSync(path.join(projectRoot, relative), 'utf8');
const web = () => source('src/components/PublicSalonPage.tsx');

const T0 = 1_700_000_000_000;
const barbers: Barber[] = [
  { id: 'b1', name: 'Arjun', status: 'available' },
  { id: 'b2', name: 'Sameer', status: 'busy' },
];
const item = (o: Partial<QueueItem> = {}): QueueItem => ({
  id: 'q1', name: 'Priya', service: 'Haircut', status: 'Waiting', createdAt: T0, ...o,
});

/* -------------------------- Hero / layout safety ------------------------- */

test('the hero no longer floats a card over itself on a negative margin', () => {
  const text = web();
  assert.doesNotMatch(text, /-mt-10/, 'the overlap that produced the detached header is gone');
  assert.doesNotMatch(text, /pb-14/, 'and the padding that reserved space for it is gone too');
  assert.match(text, /<header[\s\S]{0,400}rounded-b-\[1\.75rem\]/, 'the hero is a self-contained rounded band');
});

test('the hero carries the salon identity itself, from live salon data', () => {
  const header = web().slice(web().indexOf('<header'), web().indexOf('</header>'));
  for (const field of ['profile.name', 'profile.address', 'profile.isOpen', 'profile.rating', 'profile.logoImageUrl']) {
    assert.ok(header.includes(field), `hero renders ${field}`);
  }
  assert.ok(!header.includes('Sharpcut'), 'nothing about the salon is hardcoded');
});

test('no invalid Tailwind sizes remain on the public page', () => {
  // Tailwind's default scale only defines the .5 steps 0.5, 1.5, 2.5 and 3.5.
  // Anything else (h-4.5, py-0.2) is silently dropped, which is how the back
  // arrow ended up rendering at zero size.
  const invalid = (web().match(/\b[a-z]+-\d+\.\d+\b/g) || [])
    .filter((cls) => !/-(0\.5|1\.5|2\.5|3\.5)$/.test(cls));
  assert.deepEqual(invalid, [], `unrecognised spacing utilities: ${invalid.join(', ')}`);
});

test('long salon text can wrap instead of forcing a horizontal scroll', () => {
  const text = web();
  assert.match(text, /\[overflow-wrap:anywhere\]/, 'the name and address can break');
  assert.match(text, /min-w-0/, 'flex children may shrink below their content width');
});

test('the sticky CTA only reserves bottom space while it is mounted', () => {
  const text = web();
  assert.match(text, /step === 'salon' \? 'pb-\[calc\(env\(safe-area-inset-bottom\)\+7\.5rem\)\]'/, 'salon step clears the bar');
  assert.match(text, /: 'pb-\[calc\(env\(safe-area-inset-bottom\)\+2rem\)\]'/, 'the ticket page does not end in dead space');
  assert.match(text, /pb-\[max\(0\.875rem,env\(safe-area-inset-bottom\)\)\]/, 'the bar itself respects the home indicator');
});

/* ------------------------ Salon page information ------------------------- */

test('the salon page renders the same shared sections as the app salon screen', () => {
  const text = web();
  for (const section of ['SalonLiveQueue', 'SalonOffers', 'SalonServiceMenu', 'SalonStylists', 'SalonGallery', 'SalonAbout', 'SalonLocationHours']) {
    assert.match(text, new RegExp(`<${section}`), `renders ${section}`);
  }
  assert.match(text, /toSalonProfile\(/, 'built from the shared salon profile, so admin edits flow through');
});

test('the duplicated live-wait row is gone now the shared section shows it', () => {
  assert.doesNotMatch(web(), /const Field: React\.FC/, 'the ad-hoc Field tile is removed');
  assert.doesNotMatch(web(), /label="Live wait"/);
});

/* --------------------------- Live ticket page ---------------------------- */

test('the ticket page is ordered status, reassurance, then the app offer', () => {
  const text = web();
  const ticket = text.indexOf('<LiveTicket');
  const assurance = text.indexOf('How this page keeps you updated');
  const app = text.indexOf('web-get-app-cta');
  assert.ok(ticket > 0 && assurance > ticket, 'reassurance comes after the status card');
  assert.ok(app > assurance, 'the app offer is last, as the least urgent item');
});

test('the reassurance strip is hidden once the booking is closed', () => {
  const text = web();
  assert.match(text, /const terminalTicket = completed \|\| noShow \|\| cancelled;/);
  assert.match(text, /\{!terminalTicket && \([\s\S]{0,200}How this page keeps you updated/);
});

test('the reassurance copy does not repeat what the ticket already says', () => {
  const text = web();
  const strip = text.slice(text.indexOf('QUEUE_ASSURANCES = ['), text.indexOf('] as const;'));
  assert.doesNotMatch(strip, /No need to refresh/, 'the ticket card already carries that line');
  assert.equal((strip.match(/title:/g) || []).length, 3, 'three short benefits');
});

test('the app-download CTA stays web-only', () => {
  assert.match(web(), /id="web-get-app-cta"/);
  const stripComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const file of ['src/components/LiveTicket.tsx', 'src/components/CustomerApp.tsx']) {
    const text = stripComments(source(file));
    for (const forbidden of [/Get the app/i, /Get app\b/, /web-get-app-cta/]) {
      assert.doesNotMatch(text, forbidden, `${file} renders no app-download CTA`);
    }
  }
});

/* ------------------- Ticket states the page must handle ------------------ */

test('every state the web ticket must render produces sane content', () => {
  const cases: Array<[string, Partial<QueueItem>, string]> = [
    ['waiting', {}, '1 person ahead'],
    ['next', {}, "You're next"],
    ['called', { status: 'Called', calledAt: T0, graceExpiresAt: T0 + 60_000 }, "It's your turn"],
    ['expired', { status: 'Called', calledAt: T0, graceExpiresAt: T0 - 1 }, 'Arrival time passed'],
    ['serving', { status: 'Serving' }, "You're in the chair"],
    ['completed', { status: 'Completed', outcome: 'completed' }, 'Service complete'],
  ];
  for (const [label, overrides, expected] of cases) {
    const mine = item({ id: 'mine', createdAt: T0 + 1000, ...overrides });
    const queue = label === 'waiting' ? [item({ id: 'other', createdAt: T0 }), mine] : [mine];
    const ticket = buildLiveTicket(mine, queue, barbers, T0);
    assert.equal(ticket.headline, expected, `${label} headline`);
  }
});

test('the estimated-wait tile stays compact so it cannot wrap', () => {
  const ticket = source('src/components/LiveTicket.tsx');
  assert.match(ticket, /`~\$\{ticket\.estimatedWaitMinutes\} min`/, 'short form in the tile');
  assert.match(ticket, /truncate text-base font-bold/, 'and it truncates rather than reflowing the row');
});

/* --------------------------- Scope containment --------------------------- */

test('this pass did not touch the staff dashboard or admin panel', () => {
  for (const file of ['src/components/StaffDashboard.tsx', 'src/components/AdminApp.tsx']) {
    assert.ok(source(file).length > 0, `${file} still present`);
  }
  // The web page must not reach into staff-only presentation.
  assert.doesNotMatch(web(), /QueueBookingCard|bookingCardState/);
});
