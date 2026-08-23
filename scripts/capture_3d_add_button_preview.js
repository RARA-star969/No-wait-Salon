import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/3d_add_button_previews';
fs.mkdirSync(OUT_DIR, { recursive: true });

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

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

  // Scroll to services
  await page.evaluate(() => {
    const el = document.getElementById('customer-salon-screen');
    if (el) el.scrollTo({ top: 460, behavior: 'instant' });
  });
  await delay(600);

  // A. Before tap — Add state
  console.log('Capturing State A: Service card in Add state (unselected)...');
  const card1 = await page.$('#service-opt-salon-1-s1');
  if (card1) {
    await card1.screenshot({ path: path.join(OUT_DIR, 'preview_A_service_card_add_state.png') });
  }
  const btn1 = await page.$('#service-toggle-salon-1-s1');
  if (btn1) {
    await btn1.screenshot({ path: path.join(OUT_DIR, 'preview_A_button_add_closeup.png') });
  }

  // B. Tap interaction / 3D press state (simulate mousedown / active)
  console.log('Capturing State B: 3D press down response...');
  const btnBox = await btn1.boundingBox();
  await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2);
  await page.mouse.down();
  await delay(50);
  await btn1.screenshot({ path: path.join(OUT_DIR, 'preview_B_button_3d_pressed_state.png') });
  await card1.screenshot({ path: path.join(OUT_DIR, 'preview_B_card_during_press.png') });

  // C. Transition from Add -> Added
  await page.mouse.up();
  await delay(80); // mid-flight transition
  console.log('Capturing State C: Mid-flight transition Add -> Added...');
  await btn1.screenshot({ path: path.join(OUT_DIR, 'preview_C_transition_midflight.png') });

  // D. Final Added state
  await delay(350);
  console.log('Capturing State D: Final Added state...');
  await card1.screenshot({ path: path.join(OUT_DIR, 'preview_D_service_card_added_state.png') });
  await btn1.screenshot({ path: path.join(OUT_DIR, 'preview_D_button_added_closeup.png') });

  // E. Removing / unselecting service returning to Add
  console.log('Unselecting service to return to Add...');
  await page.click('#service-toggle-salon-1-s1');
  await delay(400);
  console.log('Capturing State E: Returned to Add state...');
  await card1.screenshot({ path: path.join(OUT_DIR, 'preview_E_service_card_returned_to_add.png') });

  // F. Multiple service cards consistent proof (select 2 cards)
  console.log('Selecting multiple services (Haircut + Beard Trim)...');
  await page.evaluate(() => {
    document.getElementById('service-toggle-salon-1-s1')?.click();
    document.getElementById('service-toggle-salon-1-s2')?.click();
  });
  await delay(500);
  console.log('Capturing State F: Multiple service cards showing Add & Added consistently...');
  const servicesContainer = await page.evaluateHandle(() => document.querySelector('#customer-salon-screen .space-y-2\\.5'));
  if (servicesContainer) {
    await servicesContainer.asElement()?.screenshot({ path: path.join(OUT_DIR, 'preview_F_multiple_services_consistency.png') });
  }

  // G. Narrow mobile width proof (360px)
  console.log('Capturing State G: Narrow mobile width (360px)...');
  await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 2 });
  await delay(400);
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_G_narrow_mobile_screen.png') });

  await browser.close();
  console.log('ALL 3D ADD BUTTON PREVIEWS CAPTURED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error running 3D add button capture:', err);
  process.exit(1);
});
