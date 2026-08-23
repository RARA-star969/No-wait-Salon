import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/3d_add_button_previews';
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await delay(500);

  await page.evaluate(() => {
    localStorage.clear();
    const sessionId = 'session-user-' + Date.now();
    localStorage.setItem('no_wait_salon_customer_session', sessionId);
    localStorage.setItem('no_wait_salon_customer_onboarding_v1', 'complete');
    localStorage.setItem('no_wait_salon_customer_notification_prompt_v1', 'done');
    localStorage.setItem('no_wait_salon_customer_location_v1', JSON.stringify({
      setupCompleted: true,
      mode: 'gps',
      label: 'Indiranagar, Bengaluru',
      latitude: 12.9719,
      longitude: 77.6412
    }));
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await delay(1000);
  await page.click('#salon-item-salon-1');
  await delay(1200);

  await page.evaluate(() => {
    const el = document.getElementById('customer-salon-screen');
    if (el) el.scrollTo({ top: 460, behavior: 'instant' });
  });
  await delay(500);

  const btn = await page.$('#service-toggle-salon-1-s1');
  const box = await btn.boundingBox();

  // Frame 1: Resting Add
  await btn.screenshot({ path: path.join(OUT_DIR, 'step_1_resting_add.png') });

  // Frame 2: Pressed Down (Active)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await delay(40);
  await btn.screenshot({ path: path.join(OUT_DIR, 'step_2_tactile_press.png') });

  // Release and capture sequence
  await page.mouse.up();
  await delay(60);
  await btn.screenshot({ path: path.join(OUT_DIR, 'step_3_morph_start.png') });

  await delay(90);
  await btn.screenshot({ path: path.join(OUT_DIR, 'step_4_text_flip_mid.png') });

  await delay(120);
  await btn.screenshot({ path: path.join(OUT_DIR, 'step_5_settle_added.png') });

  await browser.close();
  console.log('Animation step frames captured!');
}

run().catch(console.error);
