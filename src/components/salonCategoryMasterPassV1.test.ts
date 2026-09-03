import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSalonQueueSignal } from '../shared/salonQueueLevel';
import { resolveSalonAudienceLabel } from '../shared/salonAudienceLabel';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, 'CustomerApp.tsx'), 'utf8');
const homeComponentsSource = readFileSync(path.join(here, 'CustomerHomeComponents.tsx'), 'utf8');

const categoryHeaderBlock = () => appSource.slice(
  appSource.indexOf('id="category-listing-header"'),
  appSource.indexOf('{/* Full Address Management Modal */}'),
);

test('Salon search placeholder rotates only between "Salon" and "Parlour"', () => {
  assert.match(appSource, /const SALON_SEARCH_ROTATING_TERMS = \['Salon', 'Parlour'\];/);
  const header = categoryHeaderBlock();
  assert.match(header, /activeCategoryId === 'salon' && !salonSearch/);
  assert.match(header, /SALON_SEARCH_ROTATING_TERMS\[salonSearchPlaceholderIndex % SALON_SEARCH_ROTATING_TERMS\.length\]/);
  assert.match(header, /Search for &ldquo;/);
});

test('Salon search placeholder animation pauses while typing and resumes once cleared', () => {
  const effectBlock = appSource.slice(
    appSource.indexOf("if (activeCategoryId !== 'salon' || salonSearch) return undefined;"),
    appSource.indexOf("if (activeCategoryId !== 'salon' || salonSearch) return undefined;") + 300,
  );
  assert.match(effectBlock, /window\.setInterval\(\(\) => \{/);
  assert.match(effectBlock, /}, 2000\)/);
  // The salon input's own placeholder text is empty — the animated overlay
  // supplies the visible copy instead, and disappears the instant salonSearch
  // is non-empty (real typed text always wins).
  const header = categoryHeaderBlock();
  assert.match(header, /placeholder=\{activeCategoryId === 'salon' \? '' : `Search \$\{activeCategoryObj\.name\.toLowerCase\(\)\}s\.\.\.`\}/);
});

test('category-specific search filters only businesses inside the open category (Salon-only search scope)', () => {
  assert.match(appSource, /const categoryFilteredSalons = visibleSalons\.filter\(\(salon\) => \{/);
  assert.match(appSource, /catId === activeCategoryId\.toLowerCase\(\)/);
});

test('Salon filter supports Nearest first, Lowest wait and Top rated, and closes via an outside-click backdrop', () => {
  const header = categoryHeaderBlock();
  assert.match(header, /\{ id: 'nearest', label: 'Nearest first' \}/);
  assert.match(header, /\{ id: 'wait', label: 'Lowest wait' \}/);
  assert.match(header, /\{ id: 'rating', label: 'Top rated' \}/);
  // Dropdown sits above a dedicated close-on-outside-click backdrop, both
  // above the search/filter row itself.
  assert.match(header, /aria-label="Close filter menu"/);
  assert.match(header, /className="fixed inset-0 z-30 cursor-default bg-transparent"/);
  assert.match(header, /z-40 w-48 rounded-2xl/);
  assert.match(header, /role="menu" aria-label="Sort businesses"/);
});

test('sort comparator sorts by distance, live wait minutes, or rating without touching the resolver', () => {
  const sortBlock = appSource.slice(
    appSource.indexOf('}).sort((a, b) => {', appSource.indexOf('categoryFilteredSalons')),
    appSource.indexOf('});', appSource.indexOf('}).sort((a, b) => {', appSource.indexOf('categoryFilteredSalons'))) + 3,
  );
  assert.match(sortBlock, /if \(salonSort === 'rating'\) return b\.rating - a\.rating;/);
  assert.match(sortBlock, /if \(salonSort === 'wait'\) return a\.liveWaitMinutes - b\.liveWaitMinutes;/);
  assert.match(sortBlock, /return a\.distanceKm - b\.distanceKm;/);
});

test('Men audience shows men + unisex; Women audience shows women + unisex', () => {
  assert.match(appSource, /const audience = salon\.audience \|\| 'unisex';/);
  assert.match(appSource, /if \(audience !== 'unisex' && audience !== salonAudience\) return false;/);
});

test('audience maps to the Salon listing subtitle, never the freeform category string', () => {
  assert.equal(resolveSalonAudienceLabel('men'), "Men's Salon");
  assert.equal(resolveSalonAudienceLabel('women'), "Women's Salon");
  assert.equal(resolveSalonAudienceLabel('unisex'), 'Unisex Salon');
  assert.equal(resolveSalonAudienceLabel(undefined), 'Unisex Salon');
  assert.equal(resolveSalonAudienceLabel(null), 'Unisex Salon');

  assert.match(
    homeComponentsSource,
    /\{isSalon \? resolveSalonAudienceLabel\(salon\.audience\) : \(salon\.category \|\| localityLabel\)\} · \{salon\.distanceKm\} km/,
  );
});

test('non-Salon categories keep using salon.category for their subtitle — unchanged', () => {
  assert.match(homeComponentsSource, /: \(salon\.category \|\| localityLabel\)/);
});

test('Salon listing wait label reads "est. wait" and stays dark ink, never blue', () => {
  assert.match(homeComponentsSource, /\{salon\.waitingCustomers === 0 \? 'walk in' : 'est\.\s?wait'\}/);
  assert.doesNotMatch(homeComponentsSource, /estimated wait/);
  const waitValueBlock = homeComponentsSource.slice(
    homeComponentsSource.indexOf(") : isSalon ? ("),
    homeComponentsSource.indexOf(") : isSalon ? (") + 400,
  );
  assert.match(waitValueBlock, /text-\[var\(--noq-ink\)\]/);
  assert.doesNotMatch(waitValueBlock, /text-(blue|\[var\(--noq-accent\))/);
});

test('signal presentation is strengthened without altering the underlying resolver logic', () => {
  // Presentation-only: richer colors/contrast in the chip styles.
  assert.match(homeComponentsSource, /green: \{ bar: '#10B981', text: 'text-emerald-800', bg: 'bg-emerald-100'/);
  assert.match(homeComponentsSource, /yellow: \{ bar: '#D97706', text: 'text-amber-800', bg: 'bg-amber-100'/);
  // The queue-load resolver itself is untouched — same thresholds/labels.
  assert.deepEqual(resolveSalonQueueSignal(0), { color: 'green', label: 'Low Wait' });
  assert.deepEqual(resolveSalonQueueSignal(1), { color: 'yellow', label: 'Moderate' });
  assert.deepEqual(resolveSalonQueueSignal(2), { color: 'yellow', label: 'Moderate' });
  assert.deepEqual(resolveSalonQueueSignal(3), { color: 'orange', label: 'Busy' });
  assert.deepEqual(resolveSalonQueueSignal(6), { color: 'red', label: 'Busy' });
});

test('Men/Women switch never renders a third Unisex customer tab', () => {
  const switchBlock = homeComponentsSource.slice(
    homeComponentsSource.indexOf('export const SalonAudienceSwitch'),
    homeComponentsSource.indexOf('export const SalonHairstyleAICard'),
  );
  assert.match(switchBlock, /\{ id: 'men', label: 'Men'/);
  assert.match(switchBlock, /\{ id: 'women', label: 'Women'/);
  assert.doesNotMatch(switchBlock, /Unisex/);
  assert.doesNotMatch(switchBlock, /'unisex'/);
});

test('Men/Women switch is compact and right-aligned, not a full-width card', () => {
  const switchBlock = homeComponentsSource.slice(
    homeComponentsSource.indexOf('export const SalonAudienceSwitch'),
    homeComponentsSource.indexOf('export const SalonHairstyleAICard'),
  );
  assert.match(switchBlock, /className="flex justify-end"/);
  assert.match(switchBlock, /inline-flex items-center gap-1 rounded-full/);
  assert.match(switchBlock, /h-9 items-center gap-1\.5 rounded-full px-3\.5/);
});

test('AI hairstyle card is an honest entry point — tappable, and opens a "coming soon" surface rather than a fake generated result', () => {
  assert.match(homeComponentsSource, /export const SalonHairstyleAICard: React\.FC<\{ onClick: \(\) => void \}>/);
  assert.match(homeComponentsSource, /Try hairstyle with AI/);
  assert.match(homeComponentsSource, /Preview styles before you visit/);

  const header = categoryHeaderBlock();
  assert.match(header, /activeCategoryId === 'salon' &&\s*\(\s*<SalonHairstyleAICard onClick=\{\(\) => setIsHairstyleAIOpen\(true\)\}/);

  const comingSoonBlock = appSource.slice(
    appSource.indexOf('id="salon-hairstyle-ai-coming-soon"'),
    appSource.indexOf('id="salon-hairstyle-ai-coming-soon"') + 2600,
  );
  assert.match(comingSoonBlock, /coming soon/i);
  assert.doesNotMatch(comingSoonBlock, /generat(ed|ing)/i);
  assert.match(comingSoonBlock, /onClick=\{\(\) => setIsHairstyleAIOpen\(false\)\}/);
});
