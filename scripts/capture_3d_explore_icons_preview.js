import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(path.resolve('package.json'));
const puppeteer = require('puppeteer');

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/explore_3d_icons_previews';
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

  // Scroll to Explore Services section
  await page.evaluate(() => {
    const el = document.getElementById('customer-salon-screen');
    const exploreHeader = Array.from(document.querySelectorAll('h2, h3, div')).find(e => e.textContent === 'Services');
    if (exploreHeader) exploreHeader.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await delay(600);

  // Preview A: Explore Services section overview
  console.log('Capturing Preview A: Explore Services section with 3D icons...');
  const exploreSection = await page.evaluateHandle(() => {
    const allSec = Array.from(document.querySelectorAll('#customer-salon-screen section'));
    return allSec.find(s => s.textContent.includes('Explore') && s.textContent.includes('Services'));
  });
  if (exploreSection) {
    await exploreSection.asElement()?.screenshot({ path: path.join(OUT_DIR, 'preview_A_explore_services_section.png') });
  }

  // Preview B: All 3 updated 3D cards
  console.log('Capturing Preview B: 3D Category cards row...');
  const cardsRow = await page.evaluateHandle(() => {
    const allSec = Array.from(document.querySelectorAll('#customer-salon-screen section'));
    const sec = allSec.find(s => s.textContent.includes('Explore') && s.textContent.includes('Services'));
    return sec ? sec.querySelector('div.flex') : null;
  });
  if (cardsRow) {
    await cardsRow.asElement()?.screenshot({ path: path.join(OUT_DIR, 'preview_B_all_three_3d_cards_row.png') });
  }

  // Preview D: Close-ups of each individual 3D icon
  console.log('Capturing Preview D: Close-up of each 3D icon...');
  const cards = await page.$$('a[href="#service-menu"]');
  if (cards.length >= 1) {
    await cards[0].screenshot({ path: path.join(OUT_DIR, 'preview_D1_hair_care_3d_icon_card.png') });
  }
  if (cards.length >= 2) {
    await cards[1].screenshot({ path: path.join(OUT_DIR, 'preview_D2_beard_3d_icon_card.png') });
  }
  if (cards.length >= 3) {
    await cards[2].screenshot({ path: path.join(OUT_DIR, 'preview_D3_massage_spa_3d_icon_card.png') });
  }

  // Preview C: Full Salon Detail context for hierarchy
  await page.evaluate(() => {
    const el = document.getElementById('customer-salon-screen');
    if (el) el.scrollTop = 260;
  });
  await delay(600);
  console.log('Capturing Preview C: Full Salon Detail context...');
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_C_full_salon_detail_context.png') });

  await browser.close();
  console.log('ALL 3D EXPLORE ICONS PREVIEWS CAPTURED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error running explore icons capture:', err);
  process.exit(1);
});
