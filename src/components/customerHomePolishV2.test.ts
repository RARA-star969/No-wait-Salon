import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SalonSearchBar, CustomerCategoryGrid, type CategoryItemConfig } from './CustomerHomeComponents';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, 'CustomerApp.tsx'), 'utf8');
const homeComponentsSource = readFileSync(path.join(here, 'CustomerHomeComponents.tsx'), 'utf8');

const sampleCategories: CategoryItemConfig[] = [
  { id: 'salon', name: 'Salon', iconName: 'Scissors', label: 'Salons' },
  { id: 'gym', name: 'Gym', iconName: 'Dumbbell', label: 'Gym' },
  { id: 'shop', name: 'Shop', iconName: 'ShoppingBag', label: 'Shop' },
];

test('Home search placeholder: "Search for" is a constant prefix, only the category token animates', () => {
  const html = renderToStaticMarkup(
    React.createElement(SalonSearchBar, { value: '', onChange: () => {}, categories: sampleCategories }),
  );
  assert.match(html, /Search for/);
  // The rotating class wraps only the category name, never the constant prefix.
  const tokenMatch = html.match(/customer-search-rotating-token[^>]*>([^<]*)</);
  assert.ok(tokenMatch, 'expected a customer-search-rotating-token span in the placeholder');
  assert.equal(tokenMatch![1], sampleCategories[0].name);
  assert.doesNotMatch(tokenMatch![1], /Search for/);
});

test('Home search placeholder rotates through the real supplied category names', () => {
  const html = renderToStaticMarkup(
    React.createElement(SalonSearchBar, { value: '', onChange: () => {}, categories: sampleCategories }),
  );
  // First render always starts at index 0 — the token holds a real category
  // name from the supplied list, never a hardcoded/fabricated word.
  assert.match(html, new RegExp(sampleCategories[0].name));
  assert.match(homeComponentsSource, /window\.setInterval\(\(\) => \{[\s\S]*?setPlaceholderIndex/);
});

test('rotation stops immediately once the customer starts typing, and never overwrites their input', () => {
  const html = renderToStaticMarkup(
    React.createElement(SalonSearchBar, { value: 'Iron House', onChange: () => {}, categories: sampleCategories }),
  );
  assert.doesNotMatch(html, /customer-search-rotating-token/);
  assert.doesNotMatch(html, /Search for/);
  assert.match(html, /value="Iron House"/);
});

test('Home search resolves to a single high-confidence result on an exact business-name match', () => {
  assert.match(
    appSource,
    /const homeExactMatch = homeSearchActive\s*\n\s*\? visibleSalons\.find\(\(salon\) => salon\.name\.trim\(\)\.toLocaleLowerCase\(\) === normalizedSearch\)\s*\n\s*: undefined;/,
  );
  assert.match(
    appSource,
    /const homeSearchResults = homeSearchActive \? \(homeExactMatch \? \[homeExactMatch\] : visibleSalons\) : \[\];/,
  );
});

test('Home search reuses the same authoritative business dataset/filter — no second query or fabricated results', () => {
  // visibleSalons already applies the one real name/address/service filter;
  // Home search must read from it directly rather than re-deriving matches.
  assert.match(appSource, /const homeSearchQuery = salonSearch\.trim\(\);/);
  assert.match(appSource, /const homeSearchActive = homeSearchQuery\.length > 0;/);
  assert.match(appSource, /visibleSalons\.find\(\(salon\) => salon\.name\.trim\(\)\.toLocaleLowerCase\(\) === normalizedSearch\)/);
});

test('clearing the Home search query restores the normal greeting + category discovery view', () => {
  assert.match(appSource, /\{!homeSearchActive && \(/);
  assert.match(appSource, /\{homeSearchActive && \(/);
  // The discovery block (greeting + Explore all + grid) is gated on the same
  // query-emptiness flag the search bar itself clears via onChange('').
  const discoveryBlock = appSource.slice(appSource.indexOf('{!homeSearchActive && ('), appSource.indexOf('>Explore all</button>'));
  assert.match(discoveryBlock, /\{greeting\.text\}/);
});

test('tapping a Home search result opens the existing Business Detail flow, not a new one', () => {
  assert.match(appSource, /const openBusinessDetail = \(salon: NearbySalon\) => \{/);
  assert.match(appSource, /onClick=\{\(\) => openBusinessDetail\(salon\)\}/);
});

test('More card shows only its icon + label — no duplicate "Explore all" text inside the tile', () => {
  const html = renderToStaticMarkup(
    React.createElement(CustomerCategoryGrid, {
      categories: sampleCategories,
      selectedCategoryId: null,
      onSelect: () => {},
      onMore: () => {},
    }),
  );
  assert.match(html, />More</);
  assert.doesNotMatch(html, /Explore all/);
});

test('category tiles render a muted compact count badge, never notification-red', () => {
  const withCount: CategoryItemConfig[] = sampleCategories.map((category, index) => ({ ...category, businessCount: index + 1 }));
  const html = renderToStaticMarkup(
    React.createElement(CustomerCategoryGrid, {
      categories: withCount,
      selectedCategoryId: null,
      onSelect: () => {},
      onMore: () => {},
    }),
  );
  assert.match(html, /customer-category-count/);
  assert.doesNotMatch(html, /bg-red|#FF0000|rgb\(255,\s*0,\s*0\)/i);
});
