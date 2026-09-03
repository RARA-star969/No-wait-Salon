import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, 'CustomerApp.tsx'), 'utf8');
const carouselSource = readFileSync(path.join(here, 'CustomerHomeCarousel.tsx'), 'utf8');
const adminSource = readFileSync(path.join(here, 'AdminApp.tsx'), 'utf8');

test('Home renders the two admin promo boxes below the main carousel, before Why NOQ', () => {
  const home = appSource.slice(appSource.indexOf('id="customer-home-screen"'), appSource.indexOf("currentScreen === 'salon'"));
  const carouselIndex = home.indexOf('<CustomerHomeCarousel />');
  const promoIndex = home.indexOf('<CustomerHomePromoBoxRow />');
  const contentSectionsIndex = home.indexOf('<HomeContentSections');
  assert.ok(carouselIndex > -1 && promoIndex > -1 && contentSectionsIndex > -1);
  assert.ok(carouselIndex < promoIndex, 'promo boxes must render below the main carousel');
  assert.ok(promoIndex < contentSectionsIndex, 'promo boxes must render above Why NOQ / AI Queue Insight / About NOQ');
});

test('promo boxes fetch their own placements, never the main carousel or category feeds', () => {
  assert.match(carouselSource, /useCarouselSlides\('\/api\/carousel-banners\/home-promo-1'\)/);
  assert.match(carouselSource, /useCarouselSlides\('\/api\/carousel-banners\/home-promo-2'\)/);
});

test('promo boxes rotate independently at 5s and 7s, distinct from the 3s main carousel', () => {
  assert.match(carouselSource, /PROMO_BOX_1_INTERVAL_MS = 5000/);
  assert.match(carouselSource, /PROMO_BOX_2_INTERVAL_MS = 7000/);
  assert.match(carouselSource, /AUTO_ADVANCE_INTERVAL_MS = 3000/, 'the main carousel interval must stay untouched');
});

test('promo box row renders nothing when neither box has admin content, and never a hollow half-empty grid', () => {
  assert.match(carouselSource, /if \(!slides1\.length && !slides2\.length\) return null;/);
  assert.match(carouselSource, /const bothPresent = slides1\.length > 0 && slides2\.length > 0;/);
  assert.match(carouselSource, /bothPresent \? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1'/);
});

test('promo boxes reuse the same auto-advance safety rules as the main carousel: pause on video, respect reduced motion, restart on manual nav, clean up on unmount', () => {
  const promoTrack = carouselSource.slice(carouselSource.indexOf('const PromoBoxTrack'), carouselSource.indexOf('const CarouselSlide'));
  assert.match(promoTrack, /if \(slides\.length < 2 \|\| playingId \|\| prefersReducedMotion\) return;/);
  assert.match(promoTrack, /prefers-reduced-motion: reduce/);
  assert.match(promoTrack, /onPointerDown=\{restartAutoAdvance\}/);
  assert.match(promoTrack, /return clearAutoAdvance;/);
});

test('admin carousel manager exposes Promo Box 1 / Promo Box 2 as placement options alongside Home and category placements', () => {
  assert.match(adminSource, /placement === 'home-promo-1'\) return 'Home — Promo Box 1'/);
  assert.match(adminSource, /placement === 'home-promo-2'\) return 'Home — Promo Box 2'/);
  assert.match(adminSource, /<option value="home-promo-1">Home — Promo Box 1/);
  assert.match(adminSource, /<option value="home-promo-2">Home — Promo Box 2/);
});
