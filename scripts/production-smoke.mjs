/**
 * Post-deploy smoke test, run against the REAL production service from CI
 * (the only place with network access to it).
 *
 * Read-only by default. Pass --with-booking to additionally run one full
 * booking round-trip through the live queue; the script cancels whatever it
 * creates, but it does leave a cancelled record in that salon's history, so it
 * is opt-in rather than automatic.
 *
 * Usage: node scripts/production-smoke.mjs <base-url> [expected-commit] [--with-booking]
 */

const [, , baseArg, expectedCommit, ...flags] = process.argv;
const base = (baseArg || '').replace(/\/$/, '');
const withBooking = flags.includes('--with-booking') || expectedCommit === '--with-booking';
const commitToMatch = expectedCommit && expectedCommit !== '--with-booking' ? expectedCommit : '';
if (!base) {
  console.error('usage: node scripts/production-smoke.mjs <base-url> [expected-commit] [--with-booking]');
  process.exit(2);
}

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
  return ok;
};

const get = async (path, init) => {
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
  return { status: response.status, body, text };
};

/* ------------------------------- health -------------------------------- */

const health = await get('/api/health');
check('production API answers /api/health', health.status === 200 && health.body.ok === true, `status ${health.status}`);
console.log(`      deployed commit: ${health.body.commit || 'not reported'} | datastore: ${health.body.database || 'unknown'}`);
if (commitToMatch) {
  const live = String(health.body.commit || '');
  check(
    'production is running the expected commit',
    Boolean(live) && (live.startsWith(commitToMatch.slice(0, 12)) || commitToMatch.startsWith(live.slice(0, 12))),
    `expected ${commitToMatch.slice(0, 12)}, live ${live.slice(0, 12) || 'unknown'}`,
  );
}

/* ------------------------------- pages --------------------------------- */

for (const [label, path] of [['customer / public web root', '/'], ['admin panel', '/admin']]) {
  const page = await get(path);
  const asset = /src="([^"]+\.js)"/.exec(page.text)?.[1];
  const assetResponse = asset ? await fetch(`${base}${asset}`) : null;
  const type = assetResponse?.headers.get('content-type') || '';
  check(
    `${label} serves HTML with a working script bundle`,
    page.status === 200 && Boolean(asset) && assetResponse?.status === 200 && type.includes('javascript'),
    `html ${page.status}, asset ${assetResponse?.status ?? 'none'} ${type}`,
  );
}

/* ------------------------- salons and live queue ------------------------ */

const directory = await get('/api/salons/directory');
const salons = directory.body.salons || [];
check('salon directory is served (Staff app salon picker)', directory.status === 200 && salons.length > 0, `${salons.length} salons`);

const salonId = salons[0]?.id;
if (salonId) {
  const profile = await get(`/api/salons/${salonId}/profile`);
  check('salon profile endpoint serves the shared app/web record', profile.status === 200 && Boolean(profile.body.salon?.name));

  const state = await get(`/api/salons/${salonId}/state`);
  check('live queue state is readable', state.status === 200 && Array.isArray(state.body.queue), `${state.body.queue?.length ?? '?'} in queue`);
}

/* ------------------------------- QR codes ------------------------------- */

const invalid = await get('/api/business-qr/definitely-not-a-real-token');
check('an invalid QR is rejected', invalid.status === 404 && invalid.body.code === 'INVALID_BUSINESS_QR');

/* ----------------------------- SSE stream ------------------------------- */

const sse = await (async () => {
  if (!salonId) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${base}/api/salons/${salonId}/events`, { signal: controller.signal });
    const reader = response.body.getReader();
    const { value } = await reader.read();
    controller.abort();
    const frame = new TextDecoder().decode(value || new Uint8Array());
    return frame.includes('event: state') || frame.includes('data:');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
})();
check('SSE stream opens and pushes an opening snapshot', sse);

/* --------------------- optional live booking round-trip ----------------- */

if (withBooking && salonId) {
  const sessionId = `smoke-${Date.now()}`;
  const post = (payload) =>
    fetch(`${base}/api/salons/${salonId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (response) => ({ status: response.status, body: await response.json().catch(() => ({})) }));

  const joined = await post({
    type: 'join',
    item: { name: 'Release smoke test', service: 'Haircut', status: 'Waiting', sessionId, source: 'customer_app' },
  });
  const entry = joined.body.queue?.find((item) => item.sessionId === sessionId);
  check('a booking can be created on production', joined.status === 200 && Boolean(entry));

  if (entry) {
    const called = await post({ type: 'queue_action', itemId: entry.id, action: 'Call' });
    const calledEntry = called.body.queue?.find((item) => item.sessionId === sessionId);
    check(
      'Call stamps a server-authoritative 7 minute arrival window',
      calledEntry?.status === 'Called' && calledEntry.graceExpiresAt - calledEntry.calledAt === 7 * 60_000,
    );

    const cancelled = await post({ type: 'cancel_customer', sessionId, reasonCode: 'other', reasonText: 'automated release smoke test' });
    const record = cancelled.body.completedList?.find((item) => item.sessionId === sessionId);
    check('the smoke booking is cancelled and cleaned up', cancelled.status === 200 && record?.outcome === 'cancelled_customer');
    check('it left the live queue', !cancelled.body.queue?.some((item) => item.sessionId === sessionId));
  }
}

console.log(`\n${failures === 0 ? 'ALL PRODUCTION SMOKE CHECKS PASSED' : `${failures} PRODUCTION SMOKE CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
