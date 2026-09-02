import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, 'CustomerApp.tsx'), 'utf8');
const reviewSource = readFileSync(path.join(here, 'PublicReviewsSection.tsx'), 'utf8');
const salonSource = readFileSync(path.join(here, 'SalonDetailPage.tsx'), 'utf8');
const logo = readFileSync(path.join(here, '..', 'assets', 'brand', 'noq-official.png'));

test('Home uses the exact supplied official NOQ image asset', () => {
  assert.equal(createHash('sha256').update(logo).digest('hex'), '569349f3f6f6c7faf1a54feefe124433371d334e693bbffe27d5ac650335e493');
  assert.match(appSource, /import officialNoqLogo from '..\/assets\/brand\/noq-official\.png'/);
  assert.match(appSource, /src=\{officialNoqLogo\}/);
  assert.doesNotMatch(appSource, /NOQ<span/);
});

test('Home is a discovery surface and category tap opens the separate listings state', () => {
  assert.match(appSource, /const \[categoryListingId, setCategoryListingId\]/);
  assert.match(appSource, /onSelect=\{openCategoryListing\}/);
  assert.match(appSource, /\{categoryListingId && <div ref=\{listingsSectionRef\}/);
  assert.match(appSource, /Back to Home categories/);
});

test('review form hides after own review and persisted owner reply remains visible', () => {
  assert.match(reviewSource, /\{!myReview && \(/);
  assert.match(reviewSource, /Your Review/);
  assert.match(reviewSource, /myReview\.ownerReplyText/);
  assert.match(reviewSource, /Owner reply/);
  assert.match(reviewSource, /\{rating \? `\$\{rating\} of 5 stars selected` : 'No rating selected'\}/);
});

test('Salon has one Join Queue primary path and one future reservation path', () => {
  const heroActions = salonSource.slice(salonSource.indexOf('actions={['), salonSource.indexOf(']}', salonSource.indexOf('actions={[')));
  assert.doesNotMatch(heroActions, /Join Queue|View Queue/);
  assert.equal((salonSource.match(/id="join-live-queue-btn"/g) || []).length, 1);
  assert.equal((salonSource.match(/id="reserve-future-window-btn"/g) || []).length, 1);
  assert.doesNotMatch(salonSource, /id="reserve-slot-btn"/);
});
