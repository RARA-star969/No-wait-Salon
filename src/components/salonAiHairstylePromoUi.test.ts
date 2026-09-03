import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const customerAppSource = readFileSync(path.join(here, 'CustomerApp.tsx'), 'utf8');
const homeComponentsSource = readFileSync(path.join(here, 'CustomerHomeComponents.tsx'), 'utf8');

test('the Salon page fetches the admin-managed promo and gates the card on its visibility', () => {
  assert.match(customerAppSource, /useSalonAiHairstylePromo\(\)/);
  assert.match(customerAppSource, /salonAiHairstylePromo\.visible/);
  assert.match(customerAppSource, /<SalonHairstyleAICard onClick=\{\(\) => setIsHairstyleAIOpen\(true\)\} promo=\{salonAiHairstylePromo\} \/>/);
});

test('tapping the AI hairstyle banner still opens the existing honest "coming soon" flow', () => {
  // Same state setter drives the modal as before this change.
  assert.match(customerAppSource, /setIsHairstyleAIOpen\(true\)/);
  assert.match(customerAppSource, /id="salon-hairstyle-ai-coming-soon"/);
  assert.match(customerAppSource, /isn&rsquo;t live yet — coming soon/);
});

test('the promo card renders the admin-managed banner image, not a generic user icon', () => {
  const cardBlock = homeComponentsSource.slice(
    homeComponentsSource.indexOf('export const SalonHairstyleAICard'),
    homeComponentsSource.indexOf('const HERO_COPY'),
  );
  assert.match(cardBlock, /promo\.visible/);
  assert.match(cardBlock, /<img[\s\S]*src=\{promo\.imageUrl\}/);
  assert.doesNotMatch(cardBlock, /<UserRound/);
});

test('the Salon category page preserves existing search/filter/audience architecture', () => {
  // Rotating "Salon"/"Parlour" placeholder still present.
  assert.match(customerAppSource, /SALON_SEARCH_ROTATING_TERMS = \['Salon', 'Parlour'\]/);
  // Filter sort options unchanged.
  assert.match(customerAppSource, /id: 'nearest', label: 'Nearest first'/);
  assert.match(customerAppSource, /id: 'wait', label: 'Lowest wait'/);
  assert.match(customerAppSource, /id: 'rating', label: 'Top rated'/);
  // Men/Women audience switch still salon-only.
  assert.match(customerAppSource, /activeCategoryId === 'salon' && \(\s*<div className="mt-\[22px\]">\s*<SalonAudienceSwitch/);
});

test('Salon top spacing uses distinct, breathable margins rather than a uniform tight gap', () => {
  const headerBlock = customerAppSource.slice(
    customerAppSource.indexOf('id="category-listing-header"'),
    customerAppSource.indexOf('{/* Full Address Management Modal */}'),
  );
  // The old uniform space-y-3 wrapper is gone in favor of per-section margins.
  assert.doesNotMatch(headerBlock.split('\n')[0], /space-y-3/);
  assert.match(headerBlock, /mt-\[7px\]/); // title -> subtitle
  assert.match(headerBlock, /relative mt-6 flex items-center gap-2/); // subtitle -> search/filter
  assert.match(headerBlock, /<div className="mt-6">\s*<CustomerCategoryCarousel/); // search -> carousel
  assert.match(headerBlock, /<div className="mt-\[22px\]">\s*<SalonAudienceSwitch/); // carousel -> Men/Women
  assert.match(headerBlock, /<div className="mt-5">\s*<SalonHairstyleAICard/); // Men/Women -> AI promo
});
