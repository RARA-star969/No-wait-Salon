import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SalonSearchBar, type CategoryItemConfig } from './CustomerHomeComponents';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, 'CustomerApp.tsx'), 'utf8');
const cssSource = readFileSync(path.join(here, '..', 'index.css'), 'utf8');

const sampleCategories: CategoryItemConfig[] = [
  { id: 'salon', name: 'Salon', iconName: 'Scissors', label: 'Salons' },
  { id: 'gym', name: 'Gym', iconName: 'Dumbbell', label: 'Gym' },
];

test('the Home search bar renders one unified neumorphic capsule surface', () => {
  const html = renderToStaticMarkup(
    React.createElement(SalonSearchBar, { value: '', onChange: () => {}, categories: sampleCategories }),
  );
  // Icon, input and filter button all live inside the single element that
  // carries the shared surface class (customer-search-glass) plus the
  // capsule marker class — never a second bg-white/border patch around the
  // filter control, and no hairline divider element splitting the bar.
  assert.match(html, /customer-search-glass noq-search-capsule/);
  assert.doesNotMatch(html, /h-6 w-px shrink-0 rounded-full/, 'no inner divider element should remain between the input and the filter button');
});

test('the Home search bar and the category-listing search bar share the same capsule/gap architecture', () => {
  assert.match(appSource, /customer-search-glass noq-search-capsule/);
});

test('CSS reserves a 12-14px icon-to-text gap on the shared capsule class, applied identically on both search bars', () => {
  const match = cssSource.match(/\.noq-search-input-wrap\s*\{\s*margin-left:\s*(\d+)px;/);
  assert.ok(match, 'expected a .noq-search-input-wrap margin-left rule in index.css');
  const gap = Number(match![1]);
  assert.ok(gap >= 12 && gap <= 14, `expected the icon-text gap to be 12-14px, got ${gap}px`);
});

test('the search input surface is forced transparent so it never paints as a separate box inside the capsule', () => {
  assert.match(cssSource, /\.noq-search-capsule input[\s\S]*?background:\s*transparent\s*!important;/);
});

test('the static "Search for" prefix and the animated category token use the exact same grey placeholder color token', () => {
  const html = renderToStaticMarkup(
    React.createElement(SalonSearchBar, { value: '', onChange: () => {}, categories: sampleCategories }),
  );
  const prefixMatch = html.match(/text-\[var\(--noq-muted\)\][^>]*>\s*<span class="shrink-0">Search for/);
  assert.ok(prefixMatch, 'expected the "Search for" prefix wrapper to use --noq-muted');
  const tokenMatch = html.match(/customer-search-rotating-token[^"]*text-\[var\(--([a-z-]+)\)\]/);
  assert.ok(tokenMatch, 'expected the rotating token span to carry a --noq-* color token');
  assert.equal(tokenMatch![1], 'noq-muted', 'the animated category word must use the same grey token as the prefix, never --noq-ink');
  assert.doesNotMatch(html.match(/customer-search-rotating-token[^>]*>/)![0], /--noq-ink/);
});
