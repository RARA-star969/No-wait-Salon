import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, 'CustomerApp.tsx'), 'utf8');
const homeComponentsSource = readFileSync(path.join(here, 'CustomerHomeComponents.tsx'), 'utf8');
const scoreboardSource = readFileSync(path.join(here, 'LiveQueueScoreboard.tsx'), 'utf8');
const liveQueueCardSource = readFileSync(path.join(here, 'LiveQueueCard.tsx'), 'utf8');
const salonDetailSource = readFileSync(path.join(here, 'SalonDetailPage.tsx'), 'utf8');
const gymLiveCardSource = readFileSync(path.join(here, 'GymLiveCard.tsx'), 'utf8');
const gymFloatingCapsuleSource = readFileSync(path.join(here, 'GymFloatingCapsule.tsx'), 'utf8');
const stickyScanQrSource = readFileSync(path.join(here, 'StickyScanQrButton.tsx'), 'utf8');
const cssSource = readFileSync(path.join(here, '..', 'index.css'), 'utf8');

test('Home header contains only logo/location and search — greeting lives in body content', () => {
  const headerBlock = appSource.slice(
    appSource.indexOf('id="customer-home-header"'),
    appSource.indexOf('id="customer-home-header"') + appSource.slice(appSource.indexOf('id="customer-home-header"')).indexOf('</div>\n          )}'),
  );
  assert.doesNotMatch(headerBlock, /\{greeting\.text\}/);
  assert.doesNotMatch(headerBlock, /Less waiting\. More of your day\./);
  assert.match(headerBlock, /src=\{officialNoqLogo\}/);
  assert.match(headerBlock, /<SalonSearchBar/);

  // Greeting now renders inside the ordinary Home content, above Explore all.
  const homeBody = appSource.slice(appSource.indexOf('{!categoryListingId ? ('), appSource.indexOf('>Explore all</button>'));
  assert.match(homeBody, /\{greeting\.text\}/);
});

test('Home header has no bottom shadow / seam', () => {
  const headerCss = cssSource.slice(cssSource.indexOf('.customer-home-header {'), cssSource.indexOf('.customer-home-header::before'));
  assert.doesNotMatch(headerCss, /box-shadow/);
});

test('NOQ logo is sized down from its previous dominant footprint', () => {
  assert.match(appSource, /w-\[92px\] object-contain/);
  assert.doesNotMatch(appSource, /w-\[112px\] object-contain/);
});

test('category screen does not render the Home header, logo, location, search or greeting', () => {
  assert.match(appSource, /\{!categoryListingId && \(\s*<div className="sticky top-0 z-\[140\]/);
  assert.match(appSource, /id="category-listing-header"/);
});

test('category listing has its own compact back + search, scoped to the open category', () => {
  const categoryHeader = appSource.slice(appSource.indexOf('id="category-listing-header"'), appSource.indexOf('id="category-listing-header"') + 2200);
  assert.match(categoryHeader, /Back to Home categories/);
  assert.match(categoryHeader, /aria-label=\{`Search \$\{activeCategoryObj\.name\.toLocaleLowerCase|aria-label=\{`Search \$\{activeCategoryObj\.name\.toLowerCase/);
  assert.match(categoryHeader, /placeholder=\{`Search \$\{activeCategoryObj\.name\.toLowerCase\(\)\}s\.\.\.`\}/);
});

test('category-specific search filters only businesses inside the open category', () => {
  assert.match(appSource, /const categoryFilteredSalons = visibleSalons\.filter\(\(salon\) => \{/);
  assert.match(appSource, /catId === activeCategoryId\.toLowerCase\(\)/);
});

test('Home search placeholder rotates through real category names and pauses once the user types', () => {
  assert.match(homeComponentsSource, /rotatingNames = categories\.length > 0 \? categories\.map\(\(category\) => category\.name\)/);
  assert.match(homeComponentsSource, /Search for "\$\{rotatingNames\[placeholderIndex % rotatingNames\.length\]\}"/);
  assert.match(homeComponentsSource, /if \(value\) return undefined;/);
  assert.match(homeComponentsSource, /window\.setInterval\(\(\) => \{[\s\S]*?\}, 2000\)/);
});

test('category tiles show a compact business count without the word "nearby"', () => {
  const gridSource = homeComponentsSource.slice(
    homeComponentsSource.indexOf('export const CustomerCategoryGrid'),
    homeComponentsSource.indexOf('CATEGORY_TAGLINES'),
  );
  assert.doesNotMatch(gridSource, /nearby/i);
  assert.match(gridSource, /\{category\.businessCount \?\? 0\}/);
});

test('Explore all opens the same stable sheet shell/z-index as the search filter button', () => {
  const filterSheet = appSource.slice(appSource.indexOf('isCategoryPreferencesOpen &&'), appSource.indexOf('isCategoryPreferencesOpen &&') + 400);
  const exploreSheet = appSource.slice(appSource.indexOf('isMoreCategoriesOpen &&'), appSource.indexOf('isMoreCategoriesOpen &&') + 400);
  assert.match(filterSheet, /z-\[150\]/);
  assert.match(exploreSheet, /z-\[150\]/);
  assert.match(exploreSheet, /customer-more-sheet/);
  assert.match(filterSheet, /customer-more-sheet/);
});

test('Scan QR dock keeps the action and its accessible label without a visible text caption', () => {
  assert.match(stickyScanQrSource, /aria-label="Scan QR"/);
  assert.doesNotMatch(stickyScanQrSource, />Scan QR</);
});

test('business detail hero shoulder has no blurred glow halo pseudo-element', () => {
  assert.doesNotMatch(cssSource, /\.business-detail-surface::before/);
});

test('Salon live card and floating capsule derive their live/connected state from one prop, not independent state', () => {
  assert.match(salonDetailSource, /live=\{liveConnected\}/);
  assert.match(salonDetailSource, /<LiveQueueScoreboard metrics=\{scoreboardMetrics\} onTap=\{scrollToLiveQueue\} live=\{liveConnected\} \/>/);
});

test('disconnected Salon state shows Updating, never a false Live claim, on both card and capsule', () => {
  assert.match(liveQueueCardSource, /\{live \? 'Live' : 'Updating'\}/);
  assert.match(scoreboardSource, /\{live \? 'Live' : 'Updating'\}/);
  assert.match(scoreboardSource, /live\?: boolean/);
});

test('Salon live card keeps Time/Position/Ready Chairs metrics and never adopts Gym-only metrics', () => {
  const salonVariant = liveQueueCardSource.slice(liveQueueCardSource.indexOf("if (variant === 'salon')"), liveQueueCardSource.indexOf('return (', liveQueueCardSource.indexOf("if (variant === 'salon')") + 2000));
  assert.match(salonVariant, /label="Time"/);
  assert.match(salonVariant, /label="Position"/);
  assert.match(salonVariant, /label="Ready"/);
  assert.doesNotMatch(salonVariant, /INSIDE|CROWD|TRAINERS/);
});

test('Gym live card and capsule keep their existing Inside/Crowd/Trainers metrics untouched', () => {
  assert.match(gymLiveCardSource, /label: 'INSIDE'/);
  assert.match(gymLiveCardSource, /label: 'CROWD'/);
  assert.match(gymLiveCardSource, /label: 'TRAINERS'/);
  assert.match(gymFloatingCapsuleSource, /label: 'INSIDE'/);
});
