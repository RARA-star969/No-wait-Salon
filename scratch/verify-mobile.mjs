/**
 * Mobile-width verification for the Customer app.
 *
 * Drives the real built Customer bundle against a real server with real data
 * (a verified customer, a real queue join, a real notification) at every
 * target device width, and asserts on measured geometry — not screenshots
 * alone: nothing interactive may sit under the status bar/notch, and no page
 * content may be covered by the fixed bottom nav.
 */
import puppeteer from 'puppeteer';
import fs from 'node:fs';

const BASE = process.argv[2];
const OUT = process.argv[3];
const TOKEN = fs.readFileSync(process.argv[4], 'utf8').trim();
const WIDTHS = [320, 360, 375, 390, 412, 430];
// Simulated Android insets: status bar / display cutout on top, gesture nav
// at the bottom. Injected as the env(safe-area-inset-*) fallbacks would be.
const INSET_TOP = 44;
const INSET_BOTTOM = 24;

const failures = [];
const notes = [];

const browser = await puppeteer.launch({
  executablePath: '/opt/pw-browsers/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

const scrollTo = async (page, where) => {
  await page.evaluate((position) => {
    // Every real scroll container, found by measured overflow rather than by
    // class name, so a screen that scrolls through some other wrapper is still
    // driven to its true end.
    const all = [document.scrollingElement, ...document.querySelectorAll('*')];
    for (const el of all) {
      if (!el) continue;
      const style = getComputedStyle(el);
      const scrollable = el === document.scrollingElement || /(auto|scroll)/.test(style.overflowY);
      if (!scrollable || el.scrollHeight <= el.clientHeight + 1) continue;
      el.scrollTop = position === 'bottom' ? el.scrollHeight : 0;
    }
  }, where);
  await new Promise((r) => setTimeout(r, 450));
};

/**
 * Two passes, because the two rules apply at different scroll positions:
 *  - top controls must clear the status bar/notch AT REST (scrollTop 0). A
 *    fixed bottom nav legitimately passes over mid-page content, and content
 *    legitimately scrolls up under a header, so neither is measured mid-scroll.
 *  - the final page content must clear the bottom nav AT THE END of the scroll.
 */
async function measure(page) {
  await scrollTo(page, 'top');
  const top = await measureAt(page);
  await scrollTo(page, 'bottom');
  const bottom = await measureAt(page);
  return {
    clipped: top.clipped,
    covered: bottom.covered,
    horizontalOverflow: top.horizontalOverflow || bottom.horizontalOverflow,
    nestedScrollers: top.nestedScrollers,
  };
}

async function measureAt(page) {
  return page.evaluate((insetTop) => {
    const results = { clipped: [], covered: [], horizontalOverflow: false, nestedScrollers: 0 };
    const doc = document.documentElement;
    results.horizontalOverflow = doc.scrollWidth > doc.clientWidth + 1;

    const nav = document.getElementById('sticky-scan-qr');
    const navTop = nav ? nav.getBoundingClientRect().top : Infinity;

    const interactive = Array.from(document.querySelectorAll('button, a, input, h1, h2, [role="switch"]'));
    for (const el of interactive) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.opacity === '0' || style.pointerEvents === 'none') continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      // Anything paintable and interactive must start below the status bar.
      if (rect.top < insetTop) {
        results.clipped.push({ tag: el.tagName, text: (el.textContent || '').trim().slice(0, 40), top: Math.round(rect.top) });
      }
      // …and must not be hidden behind the fixed bottom nav.
      if (nav && !nav.contains(el) && rect.top < navTop && rect.bottom > navTop + 4) {
        results.covered.push({ tag: el.tagName, text: (el.textContent || '').trim().slice(0, 40), bottom: Math.round(rect.bottom) });
      }
    }

    // Competing scroll containers: a scrollable element nested inside another
    // scrollable element is what makes a screen "eat" the wrong gesture.
    const scrollers = Array.from(document.querySelectorAll('*')).filter((el) => {
      const style = getComputedStyle(el);
      return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 4;
    });
    results.nestedScrollers = scrollers.filter((el) => scrollers.some((other) => other !== el && other.contains(el))).length;
    return results;
  }, INSET_TOP);
}

async function shot(page, name) {
  // Always captured at rest (scrollTop 0) so the screenshot shows the state
  // the top-inset rule is asserted against, not a mid-scroll frame.
  await scrollTo(page, 'top');
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

for (const width of WIDTHS) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // Seed the app the way a real returning, verified customer would be: past
  // landing, location configured, notification prompt answered, and holding a
  // real server session token.
  await page.evaluateOnNewDocument((token, insetTop, insetBottom) => {
    localStorage.setItem('no_wait_salon_customer_onboarding_v1', 'complete');
    localStorage.setItem('no_wait_salon_customer_notification_prompt_v1', 'done');
    localStorage.setItem('no_wait_salon_customer_location_v1', JSON.stringify({
      mode: 'manual', area: 'Indiranagar', label: 'Indiranagar, Bengaluru', setupCompleted: true,
      latitude: 12.9784, longitude: 77.6408,
    }));
    if (token) localStorage.setItem('no_wait_salon_customer_auth_v1', token);
    // Headless Chromium always reports env(safe-area-inset-*) as 0, so a
    // notch/gesture-nav regression would be invisible. This re-applies the
    // app's OWN formulas with the env() term replaced by a real device inset,
    // via !important so it also overrides the inline styles the shell sets.
    // Anything the app failed to inset at all stays un-inset and is caught.
    const style = document.createElement('style');
    style.textContent = `
      #customer-home-header { padding-top: max(1rem, ${insetTop}px) !important; }
      .safe-area-header { padding-top: max(0.75rem, ${insetTop}px) !important; }
      #customer-profile-screen, #customer-edit-profile-screen { padding-top: max(1rem, ${insetTop}px) !important; }
      #customer-profile-screen > div:first-child { padding-top: max(1rem, ${insetTop}px) !important; }
      .safe-area-scroll { padding-bottom: calc(${insetBottom}px + 6.25rem) !important; }
      #sticky-scan-qr { padding-bottom: max(0.5rem, ${insetBottom}px) !important; }
    `;
    const attach = () => document.head.appendChild(style);
    if (document.head) attach(); else document.addEventListener('DOMContentLoaded', attach);
  }, TOKEN, INSET_TOP, INSET_BOTTOM);

  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  const screens = [
    ['home', null],
    ['bookings', '#sticky-scan-qr button[aria-label="Bookings"]'],
    ['notifications', '#sticky-scan-qr button[aria-label^="Alerts"]'],
    ['profile', '#sticky-scan-qr button[aria-label="More"]'],
  ];

  await page.goto(`${BASE}/?mode=customer`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));

  for (const [name, selector] of screens) {
    if (selector) {
      const target = await page.$(selector);
      if (!target) { failures.push(`${width}px ${name}: nav control ${selector} not found`); continue; }
      await target.click();
      await new Promise((r) => setTimeout(r, 900));
    }
    const measured = await measure(page);
    await shot(page, `${name}-${width}`);
    if (measured.horizontalOverflow) failures.push(`${width}px ${name}: page scrolls horizontally`);
    for (const item of measured.clipped) {
      failures.push(`${width}px ${name}: "${item.text}" (${item.tag}) sits at y=${item.top}, under the ${INSET_TOP}px status bar/notch`);
    }
    for (const item of measured.covered) {
      failures.push(`${width}px ${name}: "${item.text}" (${item.tag}) is covered by the bottom nav`);
    }
    if (measured.nestedScrollers > 0) {
      failures.push(`${width}px ${name}: ${measured.nestedScrollers} nested competing scroll container(s)`);
    }
    notes.push(`${width}px ${name}: ok (no clipped top controls, no bottom overlap, ${measured.nestedScrollers} nested scrollers)`);
  }

  // Deck: measure the real painted geometry of the active card and both
  // neighbours, to confirm side cards stay separated and tappable.
  await page.goto(`${BASE}/?mode=customer`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  const deck = await page.evaluate(async () => {
    let cards = Array.from(document.querySelectorAll('.floating-glass-card'));
    if (!cards.length) return null;
    // Bring a middle card to the front so BOTH neighbours are measurable —
    // the first card has nothing to its left.
    if (cards[2]) { cards[2].click(); await new Promise((r) => setTimeout(r, 900)); }
    cards = Array.from(document.querySelectorAll('.floating-glass-card'));
    const activeIndex = cards.findIndex((card) => card.classList.contains('is-active'));
    const rect = (i) => (cards[i] ? cards[i].getBoundingClientRect() : null);
    const active = rect(activeIndex);
    const left = rect(activeIndex - 1);
    const right = rect(activeIndex + 1);
    return {
      count: cards.length,
      activeIndex,
      activeLabel: (cards[activeIndex].textContent || '').trim().slice(0, 20),
      activeWidth: active && Math.round(active.width),
      leftExposed: left && active ? Math.round(active.left - left.left) : null,
      rightExposed: right && active ? Math.round(right.right - active.right) : null,
    };
  });
  if (!deck) failures.push(`${width}px deck: no cards rendered`);
  else {
    if (deck.rightExposed !== null && deck.rightExposed < 40) {
      failures.push(`${width}px deck: right neighbour only exposes ${deck.rightExposed}px`);
    }
    if (deck.leftExposed !== null && deck.leftExposed < 40) {
      failures.push(`${width}px deck: left neighbour only exposes ${deck.leftExposed}px`);
    }
    notes.push(`${width}px deck: ${deck.count} cards, active "${deck.activeLabel}" w=${deck.activeWidth}, exposed L=${deck.leftExposed} R=${deck.rightExposed}`);
  }
  await shot(page, `deck-${width}`);

  // Tap-to-select on the right-hand side card must change the active category
  // AND resynchronise the banner/listing heading — the single-state rule.
  const tapResult = await page.evaluate(async () => {
    const heading = () => document.querySelector('#customer-home-screen h2')?.textContent?.trim() || '';
    const activeLabel = () => (document.querySelector('.floating-glass-card.is-active')?.textContent || '').trim().slice(0, 20);
    const before = { active: activeLabel(), heading: heading() };
    const cards = Array.from(document.querySelectorAll('.floating-glass-card'));
    const activeIndex = cards.findIndex((card) => card.classList.contains('is-active'));
    const neighbour = cards[activeIndex + 1] || cards[activeIndex - 1];
    if (!neighbour) return { skipped: true };
    neighbour.click();
    await new Promise((r) => setTimeout(r, 900));
    return { before, after: { active: activeLabel(), heading: heading() } };
  });
  if (tapResult.skipped) {
    notes.push(`${width}px deck tap: only one category available, skipped`);
  } else if (tapResult.after.active === tapResult.before.active) {
    failures.push(`${width}px deck tap: tapping a side card did not change the active category`);
  } else if (tapResult.after.heading === tapResult.before.heading) {
    failures.push(`${width}px deck tap: active card changed but the listings heading did not resync`);
  } else {
    notes.push(`${width}px deck tap: "${tapResult.before.active}" -> "${tapResult.after.active}", heading "${tapResult.before.heading}" -> "${tapResult.after.heading}"`);
  }
  await shot(page, `deck-tapped-${width}`);

  if (consoleErrors.length) failures.push(`${width}px: runtime errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
  await page.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/report.txt`, [...notes, '', ...(failures.length ? ['FAILURES:', ...failures] : ['NO FAILURES'])].join('\n'));
console.log(notes.join('\n'));
console.log('\n' + (failures.length ? `FAILURES (${failures.length}):\n` + failures.join('\n') : 'NO FAILURES'));
process.exit(failures.length ? 1 : 0);
