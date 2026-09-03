import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeProfileAvatar, SalonSearchBar, type CategoryItemConfig } from './CustomerHomeComponents';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, 'CustomerApp.tsx'), 'utf8');
const homeComponentsSource = readFileSync(path.join(here, 'CustomerHomeComponents.tsx'), 'utf8');
const carouselSource = readFileSync(path.join(here, 'CustomerHomeCarousel.tsx'), 'utf8');

const sampleCategories: CategoryItemConfig[] = [
  { id: 'salon', name: 'Salon', iconName: 'Scissors', label: 'Salons' },
  { id: 'gym', name: 'Gym', iconName: 'Dumbbell', label: 'Gym' },
];

test('Home header avatar falls back to a neutral empty-user glyph when no photo exists', () => {
  const html = renderToStaticMarkup(React.createElement(HomeProfileAvatar, { name: 'Ritik', photoObjectUrl: '' }));
  assert.doesNotMatch(html, /<img/, 'must never render a fake placeholder photo when none exists');
  assert.match(html, /aria-label="Open your profile"/);
});

test('Home header avatar renders the real photo when a photoObjectUrl is provided', () => {
  const html = renderToStaticMarkup(
    React.createElement(HomeProfileAvatar, { name: 'Ritik', photoObjectUrl: 'blob:fake-object-url' }),
  );
  assert.match(html, /<img src="blob:fake-object-url"/);
});

test('the Home header avatar is wired to the existing customer profile screen and photo source, not a duplicate flow', () => {
  assert.match(appSource, /<HomeProfileAvatar[\s\S]*?photoObjectUrl=\{headerAvatarPhotoUrl\}[\s\S]*?onClick=\{\(\) => setScreen\('profile'\)\}/);
  assert.match(appSource, /customerAccountService\.getPhotoObjectUrl\(\)\.then\(\(url\) => \{ objectUrl = url; setHeaderAvatarPhotoUrl\(url\); \}\)/);
  // Reuses the same CustomerAccountService/CustomerProfileScreen the bottom
  // dock's Profile tab already opens — no second profile route is added.
  assert.match(appSource, /currentScreen === 'profile' \|\| currentScreen === 'edit-profile'/);
});

test('the search bar mic writes recognized speech into the same query state typing uses', () => {
  assert.match(homeComponentsSource, /import \{ [^}]*Mic[^}]* \} from 'lucide-react'/);
  assert.match(homeComponentsSource, /onClick=\{onVoiceSearch\}/);
  assert.match(homeComponentsSource, /aria-label=\{isListening \? 'Stop voice search' : 'Search by voice'\}/);
  // handleVoiceSearch (CustomerApp) feeds recognized speech into `salonSearch`
  // — the exact same state `onChange` writes into from typing.
  assert.match(appSource, /setSalonSearch\(transcript\)/);
  assert.match(appSource, /onChange=\{\(value\) => setSalonSearch\(value\)\}/);
  assert.match(appSource, /onVoiceSearch=\{handleVoiceSearch\}/);
});

test('voice search has no second result system — it reuses the one real business search/filter pipeline', () => {
  // handleVoiceSearch never renders its own result list; it only mutates the
  // shared salonSearch query plus the shared categoryListingId navigation.
  const handler = appSource.slice(appSource.indexOf('const handleVoiceSearch'), appSource.indexOf('}, [activeCategoryId, isListening]);'));
  assert.match(handler, /setSalonSearch\(transcript\)/);
  assert.match(handler, /setCategoryListingId\(activeCategoryId\)/);
  assert.doesNotMatch(handler, /setVoiceSearchResults|voiceResults/i);
});

test('unsupported/denied speech recognition degrades gracefully without fabricating a result', () => {
  assert.match(appSource, /if \(!SpeechRecognition\) \{/);
  assert.match(appSource, /Voice search is not supported on this browser\. Please type your search\./);
  assert.match(appSource, /Microphone access denied\. Please allow mic permissions\./);
  assert.doesNotMatch(appSource, /setSalonSearch\('Iron House/i);
});

test('the Filter control keeps the exact existing category-preferences workflow after moving out of the search bar', () => {
  // SalonSearchBar itself no longer owns the filter click/badge.
  const searchBarSource = homeComponentsSource.slice(
    homeComponentsSource.indexOf('export const SalonSearchBar'),
    homeComponentsSource.indexOf('export type SalonAudience'),
  );
  assert.doesNotMatch(searchBarSource, /onFilterClick/);
  // The relocated control still opens the one real sheet/state.
  assert.match(appSource, /<CategoryFilterButton[\s\S]*?onClick=\{\(\) => setIsCategoryPreferencesOpen\(true\)\}/);
  assert.match(appSource, /currentScreen === 'home' && isCategoryPreferencesOpen && \(/);
  assert.match(appSource, /preferredCategoryCount=\{Math\.min\(5, resolvedPreferenceIds\.length\)\}/);
});

test('relocated Filter control keeps a compact neumorphic pill, not a full-width bar', () => {
  const html = renderToStaticMarkup(
    React.createElement(SalonSearchBar, { value: '', onChange: () => {}, categories: sampleCategories }),
  );
  assert.doesNotMatch(html, /aria-label="Choose preferred Home categories"/, 'the search capsule itself must no longer render the filter button');
  assert.match(homeComponentsSource, /customer-filter-chip relative inline-flex h-9/);
});

test('carousel title/subtitle get a Netflix-style readable overlay only when there is text, never a flat blanket', () => {
  assert.match(carouselSource, /\{\(slide\.title \|\| slide\.subtitle\) && \(/);
  assert.match(carouselSource, /linear-gradient\(180deg, rgba\(0,0,0,0\) 38%, rgba\(0,0,0,0\.32\) 66%, rgba\(0,0,0,0\.82\) 100%\)/);
  // Media stays visible: no full-opacity black fill anywhere in the slide.
  assert.doesNotMatch(carouselSource, /rgba\(0,\s*0,\s*0,\s*1\)/);
});

test('carousel never overlays text on top of an actively playing YouTube iframe', () => {
  // The iframe's own `title` attribute (accessible name, never painted) is
  // the only allowed use of slide.title inside this branch — no readability
  // overlay or title/subtitle block is rendered on top of active playback.
  const iframeBranch = carouselSource.slice(carouselSource.indexOf('isYoutube && isPlaying ?'), carouselSource.indexOf('allowFullScreen'));
  assert.doesNotMatch(iframeBranch, /absolute inset-x-0 bottom-0/);
  assert.doesNotMatch(iframeBranch, /slide\.subtitle/);
});

test('carousel auto-advances only with 2+ active slides, every 3 seconds', () => {
  assert.match(carouselSource, /AUTO_ADVANCE_INTERVAL_MS = 3000/);
  assert.match(carouselSource, /if \(slides\.length < 2 \|\| playingId \|\| prefersReducedMotion\) return;/);
  assert.match(carouselSource, /window\.setInterval\(\(\) => \{[\s\S]*?AUTO_ADVANCE_INTERVAL_MS\)/);
});

test('carousel auto-advance pauses while a video is playing and respects reduced motion', () => {
  assert.match(carouselSource, /playingId \|\| prefersReducedMotion\) return;/);
  assert.match(carouselSource, /prefers-reduced-motion: reduce/);
});

test('carousel manual swipe/dot navigation restarts the timer instead of fighting it, and cleans up on unmount', () => {
  assert.match(carouselSource, /onPointerDown=\{restartAutoAdvance\}/);
  assert.match(carouselSource, /const handleManualNavigate = React\.useCallback\(\(index: number\) => \{\s*scrollToIndex\(index\);\s*restartAutoAdvance\(\);/);
  assert.match(carouselSource, /return clearAutoAdvance;/);
  assert.match(carouselSource, /window\.clearInterval\(autoAdvanceTimerRef\.current\)/);
});

test('category grid, audience switch and carousel placement wiring are untouched by the Home polish pass', () => {
  assert.match(appSource, /<CustomerCategoryGrid/);
  assert.match(appSource, /<SalonAudienceSwitch/);
  assert.match(appSource, /<CustomerHomeCarousel \/>/);
  assert.match(appSource, /<CustomerCategoryCarousel/);
});
