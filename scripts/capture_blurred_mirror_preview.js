import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/blurred_mirror_previews';
fs.mkdirSync(OUT_DIR, { recursive: true });

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function setScroll(page, top) {
  await page.evaluate((scrollPos) => {
    const el1 = document.getElementById('customer-salon-screen');
    if (el1) el1.scrollTop = scrollPos;
    const el2 = el1 ? el1.parentElement?.closest('.overflow-y-auto') : null;
    if (el2) el2.scrollTop = scrollPos;
    const allScrollable = document.querySelectorAll('.overflow-y-auto');
    allScrollable.forEach((s) => { s.scrollTop = scrollPos; });
    window.scrollTo(0, scrollPos);
  }, top);
  await delay(600);
}

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(500);

  // Authenticate session
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

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await delay(1000);

  // Open Sharpcut Studio (salon-1)
  console.log('Opening Sharpcut Studio...');
  await page.waitForSelector('#salon-item-salon-1', { timeout: 5000 });
  await page.click('#salon-item-salon-1');
  await delay(1200);

  // Preview A: zero-service state (panel hidden)
  console.log('Capturing Preview A: Zero-service state (panel hidden)...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_A_zero_service_dock.png') });

  // Scroll to services
  await setScroll(page, 350);

  // Preview B: one service selected -> panel visible with new blurred mirror texture
  console.log('Selecting one service (Haircut)...');
  await page.evaluate(() => {
    document.getElementById('service-toggle-salon-1-s1')?.click();
  });
  await delay(600);
  console.log('Capturing Preview B: One service selected (frosted mirror panel)...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_B_one_service_blurred_mirror.png') });

  // Preview C: multiple services selected -> same panel texture
  console.log('Selecting second service (Haircut + Beard)...');
  await page.evaluate(() => {
    document.getElementById('service-toggle-salon-1-s2')?.click();
  });
  await delay(600);
  console.log('Capturing Preview C: Multiple services selected...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_C_multiple_services_blurred_mirror.png') });

  // Preview E: Close-up of the panel material
  console.log('Capturing Preview E: Panel material close-up...');
  const dockEl = await page.evaluateHandle(() => document.querySelector('.fixed.inset-x-0.bottom-0 > div'));
  if (dockEl) {
    await dockEl.asElement()?.screenshot({ path: path.join(OUT_DIR, 'preview_E_dock_material_closeup.png') });
  }

  // Preview D: Scroll interaction proving the panel gives blurred/glowing reflected feel from content beneath
  console.log('Scrolling page to different positions behind the blurred mirror panel...');
  // Position D1: Scrolled over green hero / cards
  await setScroll(page, 180);
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_D1_scroll_behind_mirror_services.png') });

  // Position D2: Scrolled further down near reviews/about with different background elements
  await setScroll(page, 650);
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_D2_scroll_behind_mirror_bottom.png') });

  // Position D3: Close-up of the dock showing the blurred content underneath
  if (dockEl) {
    await dockEl.asElement()?.screenshot({ path: path.join(OUT_DIR, 'preview_D3_dock_blurred_reflection_closeup.png') });
  }

  // Preview F: Full Salon Detail context for visual hierarchy
  await setScroll(page, 300);
  console.log('Capturing Preview F: Full Salon Detail hierarchy context...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_F_full_hierarchy_context.png') });

  await browser.close();
  console.log('ALL BLURRED MIRROR PREVIEWS CAPTURED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error running blurred mirror capture:', err);
  process.exit(1);
});
