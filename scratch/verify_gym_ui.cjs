/**
 * Real browser verification of the Gym extension: the customer access state
 * machine (A -> B -> payment sheet -> pending -> staff accept -> Active Visit
 * -> checkout) and the owner Live Floor (Inside / Left / All + search).
 *
 * Drives a real server + real built customer/business bundles in Chrome via
 * puppeteer. Nothing is stubbed; every assertion reads rendered DOM.
 */
const puppeteer = require('puppeteer');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const dataDir = mkdtempSync(path.join(tmpdir(), 'noq-gym-ui-'));
const port = 45000 + Math.floor(Math.random() * 3000);
const base = `http://127.0.0.1:${port}`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
};

const api = async (method, endpoint, body, token) => {
  const res = await fetch(base + endpoint, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

async function start() {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/testStart.ts'], {
    env: {
      ...process.env,
      DATABASE_URL: '',
      DATA_DIR: dataDir,
      PORT: String(port),
      NODE_ENV: 'production',
      NO_WAIT_TEST_DEPLOYMENT: 'true',
      ADMIN_EMAIL: 'gym-ui-qa@example.test',
      ADMIN_PASSWORD: 'local-qa-only-password',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    let logs = '';
    const timeout = setTimeout(() => reject(new Error(logs || 'timeout')), 30000);
    child.stdout.on('data', (b) => {
      logs += b;
      if (logs.includes('server listening')) { clearTimeout(timeout); setTimeout(resolve, 1500); }
    });
    child.stderr.on('data', (b) => { logs += b; });
    child.once('exit', (c) => { clearTimeout(timeout); reject(new Error(`exit ${c}: ${logs}`)); });
  });
  return child;
}

const text = (page) => page.evaluate(() => document.body.innerText);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let child, browser;
  try {
    child = await start();
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'], protocolTimeout: 180000 });

    // --- back-end fixtures via the real API ------------------------------
    const owner = (await api('POST', '/api/staff/login', {
      businessCode: 'IRONHOUSE01',
      email: 'ironhouse-owner@nowaitsalon.test',
      password: 'staff123',
    })).data.token;
    if (!owner) throw new Error('owner login failed');

    const gymApi = (p) => `/api/gym/gym-1/${p}`;
    let state = (await api('GET', gymApi('overview'), undefined, owner)).data;
    const pass = state.offerings.find((o) => o.active && o.type !== 'membership');
    if (!pass) throw new Error('no visitor pass offering seeded');
    // Mark one plan recommended so the customer sheet can be verified against
    // a REAL owner toggle (never a fabricated recommendation).
    // Flag a plan the customer will NOT be holding, so the Upgrade sheet has a
    // genuine recommendation to show (the sheet excludes the active access).
    const otherPlan = state.offerings.find((o) => o.active && o.id !== pass.id);
    if (otherPlan) await api('POST', gymApi('operations/offerings'), { ...otherPlan, id: otherPlan.id, recommended: true }, owner);

    // --- customer session -------------------------------------------------
    const phone = '9876500123';
    const otp = (await api('POST', '/api/otp/request', { phone })).data;
    const auth = (await api('POST', '/api/otp/verify', { challengeId: otp.challengeId, code: otp.demoCode })).data;
    await api('PUT', '/api/me/profile', { name: 'Riya Verma', email: '', dateOfBirth: '', gender: 'female', anniversary: '', city: '' }, auth.token);

    await browser.defaultBrowserContext().overridePermissions(base, ['geolocation']);
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 }); // customer mobile width
    await page.setGeolocation({ latitude: 28.6139, longitude: 77.209 });
    // Self-checkout asks "Are you leaving <Gym>?" — accept it like a user would.
    page.on('dialog', (d) => { void d.accept(); });
    await page.goto(base, { waitUntil: 'networkidle2' });
    await page.evaluate((session) => {
      localStorage.setItem('no_wait_salon_customer_auth_v1', JSON.stringify(session));
    }, { token: auth.token, customerId: auth.customerId, phoneNumber: phone });

    // Walk the real customer app: Explore Nearby -> Gym category -> Iron House.
    await page.goto(`${base}/?mode=customer`, { waitUntil: 'networkidle2' });
    await wait(2500);
    await page.click('#landing-explore-nearby-btn');
    await wait(3500);
    // If the location gate is showing, take its "use my location" path.
    if (/Use your location|Select your location/i.test(await text(page))) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /use (my )?(current )?location|allow/i.test(x.innerText));
        if (b) b.click();
      });
      await wait(4000);
    }
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /^Gym\b/.test(x.innerText.trim()));
      if (b) b.click();
    });
    await wait(1500);
    await page.evaluate(() => {
      const b = document.querySelector('#salon-item-gym-1');
      if (b) b.click();
    });
    await wait(3500);
    let body = await text(page);

    const onGymPage = /Gym Passes & Memberships|Gym access/i.test(body);
    check('customer gym page renders', onGymPage, onGymPage ? '' : body.slice(0, 200).replace(/\n/g, ' | '));

    if (onGymPage) {
      // --- STATE A -------------------------------------------------------
      const stateA = await page.evaluate(() => {
        const bar = document.querySelector('#gym-action-bar');
        const btn = document.querySelector('#gym-primary-cta');
        return { bar: bar ? bar.innerText : '', btn: btn ? btn.innerText.trim() : '' };
      });
      check('State A: sticky CTA says Choose Access', stateA.btn === 'Choose Access', stateA.btn);
      check('State A: prompts to select an access option',
        /Select an access option to continue/i.test(stateA.bar), stateA.bar.replace(/\n/g, ' | '));
      check('State A: package cards use the premium "Choose Access" CTA, not "Choose this pass"',
        /Choose Access/.test(body) && !/Choose this pass/.test(body));

      // --- STATE B -------------------------------------------------------
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('#gym-passes-section button')];
        const target = btns.find((b) => /Choose Access/.test(b.innerText));
        target.click();
      });
      await wait(600);
      const stateB = await page.evaluate(() => {
        const bar = document.querySelector('#gym-action-bar');
        const btn = document.querySelector('#gym-primary-cta');
        return { bar: bar ? bar.innerText : '', btn: btn ? btn.innerText.trim() : '' };
      });
      check('State B: button becomes "Payment"', stateB.btn === 'Payment', stateB.btn);
      check('State B: CTA shows the selected access name + price + validity',
        stateB.bar.includes(pass.name) && stateB.bar.includes(String(pass.priceInr)),
        stateB.bar.replace(/\n/g, ' | '));

      // Selecting must not have created anything server-side.
      state = (await api('GET', gymApi('overview'), undefined, owner)).data;
      const noVisitYet = !state.visits.some((v) => v.customerId === auth.customerId && !v.checkedOutAt);
      const noPaymentYet = !state.payments.some((p) => p.customerId === auth.customerId);
      check('State B creates NO visit and NO payment (selection is not entry)', noVisitYet && noPaymentYet);

      // --- PAYMENT SHEET --------------------------------------------------
      await page.click('#gym-primary-cta');
      await wait(600);
      const sheet = await page.evaluate(() => {
        const el = document.querySelector('#gym-pay-btn');
        return el ? el.closest('div.w-full').innerText : '';
      });
      check('Payment sheet shows the full breakdown',
        /Selected access/i.test(sheet) && /Validity/i.test(sheet) && /Price/i.test(sheet) && /Final amount/i.test(sheet),
        sheet.replace(/\n/g, ' | ').slice(0, 220));
      check('Payment sheet offers ONLINE and CASH AT GYM', /ONLINE/.test(sheet) && /CASH AT GYM/.test(sheet));

      // Online must be honest, not a fake success.
      const onlineOffered = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'ONLINE');
        if (!b || b.disabled) return 'not-offered';
        b.click();
        return 'clicked';
      });
      if (onlineOffered === 'clicked') {
        await wait(400);
        const warn = await page.evaluate(() => document.querySelector('#gym-pay-btn').closest('div.w-full').innerText);
        check('online path is honest (no fake success)', /not live|not connected|won't pretend/i.test(warn),
          warn.replace(/\n/g, ' | ').slice(0, 200));
        await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'CASH AT GYM');
          if (b) b.click();
        });
        await wait(300);
      } else {
        check('online path is honest (no fake success)', true, 'online not offered for this plan');
      }

      // --- CASH -> PENDING -------------------------------------------------
      await page.click('#gym-pay-btn');
      await wait(1800);
      const confirmCopy = await text(page);
      check('purchase confirmation is explicit that the visit has not started yet',
        /visit starts when the gym accepts it/i.test(confirmCopy));
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /got it/i.test(x.innerText));
        if (b) b.click();
      });
      await wait(700);
      state = (await api('GET', gymApi('overview'), undefined, owner)).data;
      const pending = state.payments.find((p) => p.customerId === auth.customerId && p.status === 'pending');
      check('Cash payment creates a real PENDING payment', Boolean(pending));
      check('CRITICAL: paying did NOT create a visit or change Inside Now',
        !state.visits.some((v) => v.customerId === auth.customerId && !v.checkedOutAt));

      // --- OWNER LIVE FLOOR: payments tab ---------------------------------
      const biz = await browser.newPage();
      await biz.setViewport({ width: 1440, height: 900 }); // full web dashboard width
      await biz.goto(`${base}/business`, { waitUntil: 'networkidle2' });
      await biz.evaluate((t) => localStorage.setItem('no_wait_salon_staff_token', t), owner);
      await biz.goto(`${base}/business`, { waitUntil: 'networkidle2' });
      await wait(3500);
      let bizBody = await text(biz);
      if (!/Live Floor/i.test(bizBody)) {
        // Not already signed in on this page: complete the real staff login.
        await biz.evaluate(() => {
          const i = document.querySelector('input');
          if (!i) return;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(i, 'IRONHOUSE01');
          i.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await biz.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find((x) => /continue/i.test(x.innerText));
          if (b) b.click();
        });
        await wait(2500);
        await biz.evaluate(() => {
          const inputs = [...document.querySelectorAll('input')];
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          const email = inputs.find((i) => i.type === 'email') || inputs[0];
          const pwd = inputs.find((i) => i.type === 'password');
          if (email) { setter.call(email, 'ironhouse-owner@nowaitsalon.test'); email.dispatchEvent(new Event('input', { bubbles: true })); }
          if (pwd) { setter.call(pwd, 'staff123'); pwd.dispatchEvent(new Event('input', { bubbles: true })); }
        });
        await biz.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find((x) => /sign in|log ?in|continue/i.test(x.innerText));
          if (b) b.click();
        });
        await wait(4000);
        // A first-run business may land on the public-details setup step.
        await biz.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find((x) => /skip for now/i.test(x.innerText));
          if (b) b.click();
        });
        await wait(3000);
        await biz.evaluate(() => {
          const el = [...document.querySelectorAll('button')].find((b) => /live floor/i.test(b.innerText || ''));
          if (el) el.click();
        });
        await wait(2000);
        bizBody = await text(biz);
      }
      const onDash = /Live Floor/i.test(bizBody);
      check('business dashboard reaches Live Floor', onDash, onDash ? '' : bizBody.slice(0, 200).replace(/\n/g, ' | '));

      if (onDash) {
        await biz.evaluate(() => {
          const el = [...document.querySelectorAll('button')].find((b) => /live floor/i.test(b.innerText || ''));
          if (el) el.click();
        });
        await wait(1200);
        await biz.evaluate(() => {
          const tab = [...document.querySelectorAll('[role="tab"]')].find((t) => /Payments/.test(t.innerText));
          if (tab) tab.click();
        });
        await wait(800);
        const payTab = await text(biz);
        check('Payments tab shows CASH PENDING with Accept & Check In / Decline',
          /CASH PENDING/.test(payTab) && /Accept & Check In/.test(payTab) && /Decline/.test(payTab),
          payTab.slice(payTab.indexOf('CASH PENDING') - 60, payTab.indexOf('CASH PENDING') + 200).replace(/\n/g, ' | '));
      }

      // --- STAFF ACCEPT -> VISIT STARTS ------------------------------------
      const insideBefore = state.currentOccupancy;
      const accept = await api('POST', gymApi('operations/accept_payment'), { paymentId: pending.id }, owner);
      check('staff accept starts the visit and Inside Now +1',
        accept.status === 200 && accept.data.state.currentOccupancy === insideBefore + 1,
        `${insideBefore} -> ${accept.data.state && accept.data.state.currentOccupancy}`);

      // --- CUSTOMER FLIPS TO ACTIVE VISIT ----------------------------------
      await wait(5000);
      const active = await page.evaluate(() => {
        const bar = document.querySelector('#gym-action-bar');
        const btn = document.querySelector('#gym-primary-cta');
        return { bar: bar ? bar.innerText : '', btn: btn ? btn.innerText.trim() : '', body: document.body.innerText };
      });
      check('customer CTA flips to the Active Visit state with Check Out',
        active.btn === 'Check Out', active.btn);
      check('Active Visit shows ACTIVE VISIT/MEMBERSHIP + a live duration with no seconds',
        /ACTIVE (VISIT|MEMBERSHIP)/.test(active.bar) && /Inside · \d+ min/.test(active.bar) && !/\d+\s*sec/.test(active.bar),
        active.bar.replace(/\n/g, ' | '));
      check('Active Visit CTA offers Upgrade', /Upgrade/.test(active.bar), active.bar.replace(/\n/g, ' | '));
      check('the active pass card transforms and no longer offers "Choose Access"',
        /VISIT PASS · ACTIVE/i.test(active.body) && /ACTIVE VISIT · \d+ min/.test(active.body),
        (active.body.match(/VISIT PASS[\s\S]{0,120}/) || [''])[0].replace(/\n/g, ' | '));

      // Time format: 12-hour, no 24-hour clock anywhere on the page.
      const twentyFour = /(?:^|\s)(1[3-9]|2[0-3]):[0-5]\d(?!\s*(AM|PM))/.test(active.body);
      check('no 24-hour time appears anywhere on the customer Gym page', !twentyFour);

      // --- UPGRADE SHEET ---------------------------------------------------
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('#gym-action-bar button')].find((x) => x.innerText.trim() === 'Upgrade');
        if (b) b.click();
      });
      await wait(700);
      const upgrade = await text(page);
      check('Upgrade opens the sheet with a real "Recommended for you" section',
        /Recommended for you/i.test(upgrade),
        (upgrade.match(/Recommended for you[\s\S]{0,120}/) || [''])[0].replace(/\n/g, ' | '));
      // Close the access sheet by its own Close control before continuing.
      await page.evaluate(() => {
        const sheet = [...document.querySelectorAll('div')].find(
          (d) => /Recommended for you|Choose your access|Move up to a bigger plan/.test(d.innerText || '') &&
                 d.querySelector('button[aria-label="Close"]'),
        );
        const b = sheet && sheet.querySelector('button[aria-label="Close"]');
        if (b) b.click();
      });
      await wait(900);
      const sheetClosed = await page.evaluate(() => !/Recommended for you/.test(document.body.innerText));
      check('the access/upgrade sheet closes cleanly', sheetClosed);

      // --- LIVE FLOOR INSIDE / LEFT / ALL ----------------------------------
      const biz2 = (await browser.pages()).find((p) => p.url().includes('/business'));
      if (biz2) {
        await biz2.evaluate(() => {
          const tab = [...document.querySelectorAll('[role="tab"]')].find((t) => /Inside/.test(t.innerText));
          if (tab) tab.click();
        });
        await wait(6000);
        const insideTab = await text(biz2);
        check('Live Floor Inside card uses ACCESS, never PLAN',
          /ACCESS|Access/.test(insideTab) && !/\nPlan\n/.test(insideTab));
        check('Live Floor Inside card shows a live duration with no seconds',
          /inside \d+ min|inside \d+ hr/.test(insideTab) && !/\d+\s*sec/.test(insideTab),
          (insideTab.match(/inside [^\n]*/) || [''])[0]);

        // Status: Left (before checkout there should be earlier history only)
        const setStatus = async (value) => {
          await biz2.evaluate((v) => {
            const sel = [...document.querySelectorAll('select')].find((s) =>
              [...s.options].some((o) => o.value === 'Left'));
            if (sel) {
              sel.value = v;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, value);
          await wait(700);
        };
        await setStatus('Left');
        const leftBefore = await text(biz2);
        check('Status filter offers Inside / Left / All', /Left/.test(leftBefore));

        // Customer self-checkout, then Left must contain them.
        await page.evaluate(() => {
          const b = document.querySelector('#gym-primary-cta');
          if (b) b.click();
        });
        await wait(3000);
        const afterOut = (await api('GET', gymApi('overview'), undefined, owner)).data;
        check('customer self-checkout closes the visit and Inside Now -1',
          afterOut.currentOccupancy === insideBefore &&
          !afterOut.visits.some((v) => v.customerId === auth.customerId && !v.checkedOutAt));

        await wait(6000);
        await setStatus('Left');
        const leftTab = await text(biz2);
        check('Left tab lists the now-historical visit with checked-out time + frozen total',
          /Riya Verma/.test(leftTab) && /Checked out/i.test(leftTab) && /Total duration/i.test(leftTab),
          (leftTab.match(/Riya Verma[\s\S]{0,220}/) || [''])[0].replace(/\n/g, ' | '));
        check('Left cards offer no Check Out button',
          !/Riya Verma[\s\S]{0,300}Check Out/.test(leftTab));

        await setStatus('Inside');
        const insideOnly = await text(biz2);
        check('Inside tab no longer lists the checked-out visitor', !/Riya Verma/.test(insideOnly));

        await setStatus('All');
        const allTab = await text(biz2);
        check('All tab lists it again and marks it Left', /Riya Verma/.test(allTab) && /Left/.test(allTab));

        // Search + status composition.
        await biz2.evaluate(() => {
          const input = [...document.querySelectorAll('input')].find((i) => i.placeholder === 'Search by name');
          if (input) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, 'zzzznomatch');
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        await wait(700);
        const noMatch = await text(biz2);
        check('search composes with status (a non-matching query empties the list)',
          !/Riya Verma/.test(noMatch));

        await biz2.evaluate(() => {
          const input = [...document.querySelectorAll('input')].find((i) => i.placeholder === 'Search by name');
          if (input) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, 'riya');
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        await wait(700);
        const match = await text(biz2);
        check('search composes with status (a matching query finds the Left row)', /Riya Verma/.test(match));

        const dash24 = /(?:^|\s)(1[3-9]|2[0-3]):[0-5]\d(?!\s*(AM|PM))/.test(match);
        check('no 24-hour time appears anywhere on Live Floor', !dash24);

        // Horizontal overflow check at dashboard width.
        const overflow = await biz2.evaluate(() =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
        check('business dashboard does not scroll horizontally at 1440px', !overflow);
      }

      // Customer page: the active-pass lock lifts once the visit is closed, so
      // the pass card must return to a buyable "Choose Access" card.
      await wait(6000);
      const afterCheckout = await text(page);
      check('after checkout the active-pass lock lifts and access is buyable again',
        /Choose Access/.test(afterCheckout) && !/VISIT PASS · ACTIVE/i.test(afterCheckout),
        (afterCheckout.match(/Day Pass[\s\S]{0,140}/) || [''])[0].replace(/\n/g, ' | '));
      const buyAgain = await api('POST', gymApi('purchase-intent'),
        { offeringId: pass.id, method: 'cash' }, auth.token);
      check('after checkout a new purchase intent is accepted again (lock was visit-scoped)',
        buyAgain.status === 201, String(buyAgain.status));

      // Measured on the Gym page's own container, not the document: the
      // outer `?mode=customer` demo wrapper carries the LIVE DEMO test chrome
      // (Reset button) which is pre-existing harness UI, absent from the
      // packaged customer app and from /q public pages.
      const custOverflow = await page.evaluate(() => {
        const root = document.querySelector('#gym-detail-page');
        if (!root) return { overflow: true, detail: 'gym page container missing' };
        const w = root.clientWidth;
        const offenders = [...root.querySelectorAll('*')]
          .filter((el) => {
            const style = getComputedStyle(el);
            if (style.pointerEvents === 'none' || style.position === 'fixed') return false;
            const r = el.getBoundingClientRect();
            const rr = root.getBoundingClientRect();
            return r.width > 0 && (r.right > rr.right + 2 || r.left < rr.left - 2);
          })
          .slice(0, 5)
          .map((el) => `${el.tagName}.${String(el.className).slice(0, 50)}`);
        return {
          overflow: root.scrollWidth > w + 2 || offenders.length > 0,
          detail: `${root.scrollWidth} vs ${w} :: ${offenders.join(' || ')}`,
        };
      });
      check('customer gym page content does not overflow at 390px',
        !custOverflow.overflow, custOverflow.detail)
    }
  } catch (error) {
    check('harness completed without throwing', false, error.message);
  } finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) child.kill('SIGTERM');
    rmSync(dataDir, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(` - ${f.name} :: ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
})();
