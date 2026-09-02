import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, 'CustomerApp.tsx'), 'utf8');
const componentsSource = readFileSync(path.join(here, 'CustomerHomeComponents.tsx'), 'utf8');
const cssSource = readFileSync(path.join(here, '..', 'index.css'), 'utf8');

test('Customer Home approved header and operational presentation stay locked', async (t) => {
  await t.test('theme toggle remains absent', () => {
    assert.doesNotMatch(appSource, /Midnight|Liquid Glass theme/i);
  });

  await t.test('header uses fixed NOQ blue ambient light with no divider pseudo-element', () => {
    const headerCss = cssSource.slice(
      cssSource.indexOf('.customer-home-header'),
      cssSource.indexOf('.customer-location-button'),
    );
    assert.match(headerCss, /#3454FD|52,84,253/);
    assert.doesNotMatch(headerCss, /customer-home-header::after/);
    assert.doesNotMatch(headerCss, /height:\s*1px/);
    assert.doesNotMatch(headerCss, /--category-/);
    assert.doesNotMatch(appSource, /customer-home-header[^\n]*border-b/);
  });

  await t.test('search reflection stays brand blue instead of category-driven', () => {
    const searchSource = componentsSource.slice(
      componentsSource.indexOf('export const SalonSearchBar'),
      componentsSource.indexOf('const HERO_COPY'),
    );
    assert.match(searchSource, /rgba\(52,84,253/);
    assert.doesNotMatch(searchSource, /--category-border/);
  });

  await t.test('Shop keeps FAST PICKUP and has no Schedule control', () => {
    assert.match(appSource, /FAST PICKUP/);
    const listingSource = appSource.slice(appSource.indexOf('categoryFilteredSalons.map'), appSource.indexOf('categoryFilteredSalons.map') + 7000);
    assert.doesNotMatch(listingSource, /Schedule/);
  });

  await t.test('Gym progress track is always rendered and its fill has no fake minimum', () => {
    const cardSource = componentsSource.slice(
      componentsSource.indexOf('export const PremiumBusinessCard'),
      componentsSource.length,
    );
    assert.match(cardSource, /role="progressbar"/);
    assert.match(cardSource, /bg-white\/\[0\.16\]/);
    assert.match(cardSource, /width: `\$\{occupancyPercent\}%`/);
    assert.doesNotMatch(cardSource, /Math\.max\([^,]+,\s*occupancyPercent\)/);
  });

  await t.test('header greeting uses dynamic time logic and avoids fake names', () => {
    assert.match(appSource, /formatCustomerGreeting/);
    assert.doesNotMatch(appSource, /Alex/);
    assert.match(appSource, /Smart zero-wait discovery & live flow/);
  });

  await t.test('search bar integrates category preference filter button', () => {
    assert.match(componentsSource, /onOpenFilter/);
    assert.match(componentsSource, /SlidersHorizontal/);
    assert.match(appSource, /CategoryPreferenceSheet/);
    assert.match(appSource, /onOpenFilter=\{/);
  });

  await t.test('pinned categories control Home deck order', () => {
    assert.match(appSource, /pinnedIds=\{pinnedCategoryIds\}/);
    assert.match(componentsSource, /pinnedIds\?: string\[\]/);
  });
});

