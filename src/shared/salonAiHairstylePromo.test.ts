import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveSalonAiHairstylePromo,
  SALON_AI_HAIRSTYLE_PROMO_FALLBACK,
} from './salonAiHairstylePromo';

test('a fully configured, enabled promo resolves visible with its own copy and image', () => {
  const props = resolveSalonAiHairstylePromo({
    enabled: true,
    title: 'Custom title',
    subtitle: 'Custom subtitle',
    imageUrl: '/salon-media/custom.png',
    ctaLabel: 'See looks',
    ctaLink: '/ai',
  });
  assert.equal(props.visible, true);
  assert.equal(props.title, 'Custom title');
  assert.equal(props.subtitle, 'Custom subtitle');
  assert.equal(props.imageUrl, '/salon-media/custom.png');
  assert.equal(props.ctaLabel, 'See looks');
  assert.equal(props.ctaLink, '/ai');
});

test('a disabled promo is never rendered even if fully configured', () => {
  const props = resolveSalonAiHairstylePromo({
    enabled: false,
    title: 'Custom title',
    imageUrl: '/salon-media/custom.png',
  });
  assert.equal(props.visible, false);
});

test('an enabled promo without an image never renders — no broken card', () => {
  const props = resolveSalonAiHairstylePromo({ enabled: true, imageUrl: '' });
  assert.equal(props.visible, false);
});

test('a missing/null record safely falls back to the checked-in default creative', () => {
  const props = resolveSalonAiHairstylePromo(null);
  assert.equal(props.visible, true);
  assert.equal(props.imageUrl, SALON_AI_HAIRSTYLE_PROMO_FALLBACK.imageUrl);
  assert.equal(props.title, SALON_AI_HAIRSTYLE_PROMO_FALLBACK.title);
  assert.equal(props.subtitle, SALON_AI_HAIRSTYLE_PROMO_FALLBACK.subtitle);
});

test('an undefined record (e.g. fetch failed before state was set) also falls back safely', () => {
  const props = resolveSalonAiHairstylePromo(undefined);
  assert.equal(props.visible, true);
  assert.equal(props.imageUrl, SALON_AI_HAIRSTYLE_PROMO_FALLBACK.imageUrl);
});

test('blank title/subtitle fall back to the default copy rather than rendering empty text', () => {
  const props = resolveSalonAiHairstylePromo({ enabled: true, title: '  ', subtitle: '', imageUrl: '/x.png' });
  assert.equal(props.title, SALON_AI_HAIRSTYLE_PROMO_FALLBACK.title);
  assert.equal(props.subtitle, SALON_AI_HAIRSTYLE_PROMO_FALLBACK.subtitle);
});

test('the fallback default creative is the checked-in initial creative path', () => {
  assert.equal(SALON_AI_HAIRSTYLE_PROMO_FALLBACK.imageUrl, '/static-defaults/ai-hairstyle-promo-default.svg');
  assert.equal(SALON_AI_HAIRSTYLE_PROMO_FALLBACK.enabled, true);
});
