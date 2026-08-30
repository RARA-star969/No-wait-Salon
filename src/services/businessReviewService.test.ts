import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizePublicReviewsResponse, formatOverallRating } from './businessReviewService.ts';

/**
 * Regression coverage for the real-device crash traced to
 * businessReviewService.ts: a wrong API base sent review requests to the
 * Android WebView's own local origin, which returned the app's own
 * index.html as a 200 (SPA-style fallback) instead of a 404 — so no
 * fetch-level error was ever thrown, and the unparseable body normalized to
 * `{}`, handing RatingSummaryBadge/PublicReviewsSection an `overallRating`
 * of `undefined` and crashing on `.toFixed()`.
 *
 * normalizePublicReviewsResponse is the layer that must never let that (or
 * any other malformed/wrong-shaped body) reach the UI as if it were valid.
 */

test('normalizePublicReviewsResponse: a completely empty body (the exact APK-bug shape) normalizes to safe defaults', () => {
  const result = normalizePublicReviewsResponse({});
  assert.deepEqual(result, { reviews: [], overallRating: 0, totalReviews: 0 });
});

test('normalizePublicReviewsResponse: missing overallRating falls back to 0, never undefined', () => {
  const result = normalizePublicReviewsResponse({ reviews: [], totalReviews: 3 });
  assert.equal(result.overallRating, 0);
  assert.equal(Number.isFinite(result.overallRating), true);
});

test('normalizePublicReviewsResponse: missing totalReviews falls back to 0, never undefined', () => {
  const result = normalizePublicReviewsResponse({ reviews: [], overallRating: 4.5 });
  assert.equal(result.totalReviews, 0);
});

test('normalizePublicReviewsResponse: non-finite/garbage rating and count values are rejected', () => {
  const result = normalizePublicReviewsResponse({ reviews: [], overallRating: NaN, totalReviews: 'five' });
  assert.equal(result.overallRating, 0);
  assert.equal(result.totalReviews, 0);

  const negative = normalizePublicReviewsResponse({ reviews: [], overallRating: 4, totalReviews: -3 });
  assert.equal(negative.totalReviews, 0, 'a negative count is never valid');
});

test('normalizePublicReviewsResponse: a malformed reviews field (not an array) becomes an empty array, never crashes the caller', () => {
  const result = normalizePublicReviewsResponse({ reviews: 'not-an-array', overallRating: 4, totalReviews: 2 });
  assert.deepEqual(result.reviews, []);
});

test('normalizePublicReviewsResponse: a non-object/null body (e.g. parsed HTML fallback) normalizes to safe defaults instead of throwing', () => {
  assert.deepEqual(normalizePublicReviewsResponse(null), { reviews: [], overallRating: 0, totalReviews: 0 });
  assert.deepEqual(normalizePublicReviewsResponse(undefined), { reviews: [], overallRating: 0, totalReviews: 0 });
  assert.deepEqual(normalizePublicReviewsResponse('<!doctype html>'), { reviews: [], overallRating: 0, totalReviews: 0 });
});

test('normalizePublicReviewsResponse: a genuinely reviewless business (zero reviews) stays zero, not a fabricated rating', () => {
  const result = normalizePublicReviewsResponse({ reviews: [], overallRating: 0, totalReviews: 0 });
  assert.deepEqual(result, { reviews: [], overallRating: 0, totalReviews: 0 });
});

test('normalizePublicReviewsResponse: a valid, well-formed response passes through unchanged', () => {
  const review = {
    id: 'r1', businessId: 'gym-1', reviewerName: 'Priya', rating: 5, reviewText: 'Great gym',
    feedbackTags: [], verifiedVisit: true, status: 'visible', ownerReplyText: null, ownerReplyAt: null,
    editedByAdmin: false, editedAt: null, createdAt: 1, updatedAt: 1,
  };
  const result = normalizePublicReviewsResponse({ reviews: [review], overallRating: 4.7, totalReviews: 12 });
  assert.equal(result.overallRating, 4.7);
  assert.equal(result.totalReviews, 12);
  assert.deepEqual(result.reviews, [review]);
});

// The real app is always built by Vite, which replaces import.meta.env at
// build time — a plain `node --test` run of this repo cannot execute that
// substitution, so the "uses the configured API base, not the WebView's own
// local origin" contract is verified by inspecting the source directly
// rather than by importing and invoking the network call.
test('source no longer derives the API base from `typeof window` (the exact APK bug) and uses the same VITE_API_BASE_URL architecture as every other API client', () => {
  const filePath = fileURLToPath(new URL('./businessReviewService.ts', import.meta.url));
  const source = readFileSync(filePath, 'utf8');
  assert.doesNotMatch(
    source,
    /typeof window\s*!==?\s*['"]undefined['"]/,
    'must never branch on `typeof window` to decide the API base — window exists inside the Android WebView too',
  );
  assert.match(
    source,
    /import\.meta\.env\??\.\s*VITE_API_BASE_URL/,
    'must resolve the API base from VITE_API_BASE_URL, the same architecture salonDiscoveryService/gymCustomerService use',
  );
});

// formatOverallRating is what RatingSummaryBadge and PublicReviewsSection
// both call instead of `.toFixed()` directly — this is the exact real
// display logic under test, not just the underlying number normalization.
test('formatOverallRating: valid reviews still display the rating correctly', () => {
  assert.equal(formatOverallRating(4.7, 12), '4.7');
  assert.equal(formatOverallRating(5, 1), '5.0');
  assert.equal(formatOverallRating(3.14159, 4), '3.1');
});

test('formatOverallRating: undefined/missing overallRating never crashes — returns null instead of a formatted string', () => {
  assert.equal(formatOverallRating(undefined, 5), null);
});

test('formatOverallRating: undefined/missing totalReviews never crashes — returns null instead of a formatted string', () => {
  assert.equal(formatOverallRating(4.5, undefined), null);
});

test('formatOverallRating: zero reviews never displays a rating, even if one is somehow present', () => {
  assert.equal(formatOverallRating(4.5, 0), null);
});

test('formatOverallRating: NaN/non-finite rating never reaches .toFixed()', () => {
  assert.equal(formatOverallRating(NaN, 5), null);
  assert.equal(formatOverallRating(Infinity, 5), null);
});

test('submit() and list() share the same request() helper, so a fix to the API base or auth applies to both', () => {
  const filePath = fileURLToPath(new URL('./businessReviewService.ts', import.meta.url));
  const source = readFileSync(filePath, 'utf8');
  const submitBody = source.slice(source.indexOf('submit:'));
  assert.match(submitBody, /request</, 'submit() must go through the same request() helper as list(), not a separate fetch call');
});
