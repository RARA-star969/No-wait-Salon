/**
 * Responsive + Custom Entry browser verification.
 *  - Business dashboard at mobile width (390px): no horizontal page scroll.
 *  - TEST Dual View: the embedded Gym dashboard scrolls internally and stays
 *    contained inside its preview panel.
 *  - Add Visitor -> "Custom Entry — Free" creates a real visit with no payment,
 *    and the Live Floor card reads VISITOR / STAFF ENTRY / ACCESS: Custom
 *    Entry / PAYMENT: Not required.
 */
const puppeteer = require('puppeteer');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const dataDir = mkdtempSync(path.join(tmpdir(), 'noq-gym-resp-'));
const port = 47000 + Math.floor(Math.random() * 2000);
const base = `http://127.0.0.1:${port}`;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (p) => p.evaluate(() => document.body.innerText);
const api = async (method, endpoint, body, token) => {
  const res = await fetch(base + endpoint, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

async function signIntoBusiness(page) {
  await page.goto(`${base}/business`, { waitUntil: 'networkidle2' });
  await wait(2500);
  if (/Live Floor/i.test(await text(page))) return;
  await page.evaluate(() => {
    const i = document.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(i, 'IRONHOUSE01');
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /continue/i.test(x.innerText));
    if (b) b.click();
  });
  await wait(2500);
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const email = inputs.find((i) => i.type === 'email') || inputs[0];
    const pwd = inputs.find((i) => i.type === 'password');
    if (email) { setter.call(email, 'ironhouse-owner@nowaitsalon.test'); email.dispatchEvent(new Event('input', { bubbles: true })); }
    if (pwd) { setter.call(pwd, 'staff123'); pwd.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /sign in|log ?in|continue/i.test(x.innerText));
    if (b) b.click();
  });
  await wait(4000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /skip for now/i.test(x.innerText));
    if (b) b.click();
  });
  await wait(2500);
}

const openLiveFloor = async (page) => {
  await page.evaluate(() => {
    const menu = [...document.querySelectorAll('button')].find((b) => /menu/i.test(b.getAttribute('aria-label') || ''));
    if (menu && menu.offsetParent) menu.click();
  });
  await wait(600);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find((b) => /live floor/i.test(b.innerText || ''));
    if (el) el.click();
  });
  await wait(1800);
};

(async () => {
  let child, browser;
  try {
    child = await (async () => {
      const c = spawn(process.execPath, ['--import', 'tsx', 'server/testStart.ts'], {
        env: { ...process.env, DATABASE_URL: '', DATA_DIR: dataDir, PORT: String(port), NODE_ENV: 'production', NO_WAIT_TEST_DEPLOYMENT: 'true', ADMIN_EMAIL: 'r@e.test', ADMIN_PASSWORD: 'x-local-only' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      await new Promise((res, rej) => {
        let l = '';
        const t = setTimeout(() => rej(new Error(l)), 30000);
        c.stdout.on('data', (b) => { l += b; if (l.includes('server listening')) { clearTimeout(t); setTimeout(res, 1500); } });
        c.stderr.on('data', (b) => { l += b; });
      });
      return c;
    })();
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'], protocolTimeout: 180000 });

    const owner = (await api('POST', '/api/staff/login', {
      businessCode: 'IRONHOUSE01', email: 'ironhouse-owner@nowaitsalon.test', password: 'staff123',
    })).data.token;

    // --- business dashboard at mobile width -----------------------------
    const biz = await browser.newPage();
    await biz.setViewport({ width: 390, height: 844 });
    await signIntoBusiness(biz);
    await openLiveFloor(biz);
    check('business dashboard reaches Live Floor at 390px', /Live Floor/i.test(await text(biz)));
    const mobileOverflow = await biz.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    check('business dashboard does not scroll horizontally at 390px', !mobileOverflow);

    // --- Custom Entry through the real Add Visitor form ------------------
    const before = (await api('GET', '/api/gym/gym-1/overview', undefined, owner)).data;
    await biz.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /add visitor/i.test(x.innerText));
      if (b) b.click();
    });
    await wait(1200);
    const formText = await text(biz);
    check('Add Visitor offers "Custom Entry — Free" alongside real plans',
      /Custom Entry\s*—\s*Free/.test(formText),
      (formText.match(/ACCESS[\s\S]{0,120}/) || [''])[0].replace(/\n/g, ' | '));
    check('Add Visitor asks for full name and mobile', /Full name/i.test(formText) && /Mobile number/i.test(formText));

    const submitted = await biz.evaluate(() => {
      const dialog = document.querySelector('dialog[open]') || document.querySelector('dialog');
      if (!dialog) return 'no dialog';
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const inputs = [...dialog.querySelectorAll('input')];
      const name = inputs.find((i) => i.name === 'name');
      const mobile = inputs.find((i) => i.name === 'mobile');
      if (name) { setter.call(name, 'Guest Trial'); name.dispatchEvent(new Event('input', { bubbles: true })); }
      if (mobile) { setter.call(mobile, '9812312312'); mobile.dispatchEvent(new Event('input', { bubbles: true })); }
      const access = dialog.querySelector('select[name="offeringId"]');
      const accessValue = access ? access.value : 'missing';
      const b = [...dialog.querySelectorAll('button')].find((x) => /save changes/i.test(x.innerText));
      if (b) b.click();
      return `access=${accessValue} submitted=${Boolean(b)}`;
    });
    console.log('  form:', submitted);
    check('Access defaults to Custom Entry in the Add Visitor form',
      /access=custom_entry/.test(submitted), submitted);
    await wait(3000);

    const after = (await api('GET', '/api/gym/gym-1/overview', undefined, owner)).data;
    const visit = after.visits.find((v) => v.name === 'Guest Trial');
    check('Custom Entry created a real visit immediately', Boolean(visit && !visit.checkedOutAt));
    check('Custom Entry created NO payment record',
      after.payments.length === before.payments.length,
      `${before.payments.length} -> ${after.payments.length}`);
    check('Custom Entry increments Inside Now',
      after.currentOccupancy === before.currentOccupancy + 1);

    await wait(6000);
    const floor = await text(biz);
    check('Live Floor card reads VISITOR / STAFF ENTRY / ACCESS Custom Entry / PAYMENT Not required',
      /Guest Trial/.test(floor) && /Visitor/i.test(floor) && /Staff entry/i.test(floor) &&
      /Custom Entry/.test(floor) && /Not required/i.test(floor),
      (floor.match(/Guest Trial[\s\S]{0,240}/) || [''])[0].replace(/\n/g, ' | '));

    // --- TEST Dual View containment --------------------------------------
    const dual = await browser.newPage();
    await dual.setViewport({ width: 1440, height: 900 });
    await dual.goto(`${base}/?view=split`, { waitUntil: 'networkidle2' });
    await wait(2500);
    await dual.evaluate(() => {
      const sel = document.querySelector('#test-business-switcher');
      if (sel) {
        sel.value = 'gym-1:owner';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await wait(4000);
    const dualOverflow = await dual.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    check('TEST Dual View does not scroll horizontally', !dualOverflow);
    const embedded = await dual.evaluate(() => {
      const app = document.querySelector('.gym-app');
      if (!app) return null;
      const r = app.getBoundingClientRect();
      return { width: Math.round(r.width), viewport: window.innerWidth, contained: r.right <= window.innerWidth + 2 };
    });
    check('embedded Gym dashboard stays contained inside the preview panel',
      Boolean(embedded && embedded.contained), embedded ? JSON.stringify(embedded) : 'gym-app not rendered');
  } catch (e) {
    check('harness completed without throwing', false, e.message);
  } finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) child.kill('SIGTERM');
    rmSync(dataDir, { recursive: true, force: true });
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
  for (const f of failed) console.log(` - ${f.name} :: ${f.detail}`);
  process.exit(failed.length ? 1 : 0);
})();
