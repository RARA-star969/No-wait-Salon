import puppeteer from 'puppeteer';
import path from 'node:path';
import fs from 'node:fs';

const OUT_DIR = '/Users/ritiksinghroth/.gemini/antigravity/brain/662ea8d9-d417-4b1f-95e1-16c08127297a/apk45_calendar_previews';
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  // 1. Open Customer App Home
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    localStorage.setItem('has_entered_app', 'true');
    localStorage.setItem('nowait_location_preference', JSON.stringify({ setupCompleted: true, area: 'Indiranagar, Bangalore' }));
    localStorage.setItem('nowait_notification_prompt_seen', 'done');
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1000);

  // Navigate to Salon Detail
  const firstSalon = await page.$('button[id^="salon-item-"]');
  if (firstSalon) {
    await firstSalon.click();
    await sleep(1000);
  }

  // Preview A: Salon Detail showing exact APK45 "Choose a future time"
  await page.screenshot({ path: path.join(OUT_DIR, 'preview_A_salon_detail_choose_future_time.png') });
  console.log('Saved Preview A');

  // Preview B: Bottom dock Calendar button close-up
  const dockBtn = await page.$('#reserve-slot-btn');
  if (dockBtn) {
    await dockBtn.screenshot({ path: path.join(OUT_DIR, 'preview_B_bottom_dock_calendar_btn.png') });
    console.log('Saved Preview B');
  }

  // Preview C & D: Tap "Choose a future time" -> Complete recovered APK45 reservation page
  const chooseFutureBtn = await page.$('#reserve-future-window-btn');
  if (chooseFutureBtn) {
    await chooseFutureBtn.click();
    await sleep(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'preview_D_future_time_reservation_screen.png') });
    console.log('Saved Preview D');
  }

  // Preview E: Date Selection (open Calendar Coming Soon Modal)
  const calendarModalBtn = await page.$('button[aria-label="Choose a specific calendar date (premium, coming soon)"]');
  if (calendarModalBtn) {
    await calendarModalBtn.click();
    await sleep(600);
    await page.screenshot({ path: path.join(OUT_DIR, 'preview_E_date_selection_calendar_modal.png') });
    console.log('Saved Preview E (Modal)');
    // Close modal
    const closeBtn = await page.$('button[aria-label="Close"]');
    if (closeBtn) await closeBtn.click();
    await sleep(400);
  }

  // Toggle tomorrow pill
  const tomorrowBtns = await page.$$('button');
  for (const b of tomorrowBtns) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text?.trim().toLowerCase() === 'tomorrow') {
      await b.click();
      await sleep(500);
      await page.screenshot({ path: path.join(OUT_DIR, 'preview_E2_tomorrow_selected.png') });
      console.log('Saved Preview E2 (Tomorrow)');
      break;
    }
  }

  // Preview F: Time Selection State (expand Available Windows accordion)
  const windowsToggle = await page.$('button[aria-expanded]');
  if (windowsToggle) {
    await windowsToggle.click();
    await sleep(500);
    await page.screenshot({ path: path.join(OUT_DIR, 'preview_F_time_selection_windows_expanded.png') });
    console.log('Saved Preview F');
  }

  // Preview G: Reservation Confirmation State (Select a slot -> confirms to Live Ticket)
  const slotBtn = await page.$('button[id^="slot-"]');
  if (slotBtn) {
    await slotBtn.click();
    await sleep(1000);
    await page.screenshot({ path: path.join(OUT_DIR, 'preview_G_reservation_confirmed_live_ticket.png') });
    console.log('Saved Preview G');
  }

  // Preview H: Bottom Calendar button opening the same flow
  // First go back to salon
  const backBtn = await page.$('#back-to-home-btn');
  if (backBtn) {
    await backBtn.click();
    await sleep(800);
    // Click salon again
    const salonCard = await page.$('button[id^="salon-item-"]');
    if (salonCard) {
      await salonCard.click();
      await sleep(800);
    }
  }

  // Click bottom dock calendar button
  const dockCalendarBtn = await page.$('#reserve-slot-btn');
  if (dockCalendarBtn) {
    await dockCalendarBtn.click();
    await sleep(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'preview_H_bottom_calendar_btn_opens_same_screen.png') });
    console.log('Saved Preview H');
  }

  // Preview I: Return/close behavior back to Salon Detail
  const backToSalonBtn = await page.$('#back-to-salon-btn');
  if (backToSalonBtn) {
    await backToSalonBtn.click();
    await sleep(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'preview_I_returned_to_salon_detail.png') });
    console.log('Saved Preview I');
  }

  // Preview J: Proof that current Live Capsule + Staff Profile changes are intact
  // Scroll down to show Live Capsule + open Join Queue sheet to show Stylist Profile ("With customer", Rating, View Profile)
  await page.evaluate(() => {
    const el = document.getElementById('customer-salon-screen');
    if (el) el.scrollTo({ top: 380, behavior: 'instant' });
  });
  await sleep(600);

  // Click Join Queue to open sheet
  const joinBtn = await page.$('#join-live-queue-btn');
  if (joinBtn) {
    await joinBtn.click();
    await sleep(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'preview_J_live_capsule_and_staff_profile_intact.png') });
    console.log('Saved Preview J');
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
})();
