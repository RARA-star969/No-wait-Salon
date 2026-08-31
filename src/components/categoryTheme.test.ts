import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_THEME_MAP, NOQ_LIVE_COLOR, categoryCssVars, resolveCategoryTheme } from './CustomerHomeComponents';

const CATEGORY_KEYS = ['salon', 'gym', 'shop', 'moto', 'pets', 'mall', 'food', 'clinic'];
const GLASS_TOKEN_KEYS = ['darkSurface', 'glassSurface', 'glassBorder', 'ctaGradient', 'selectedGlow', 'modalTint', 'subtleAccent'] as const;

test('every category has real, non-empty glass/CTA/glow tokens — no category is left half-themed', () => {
  for (const key of CATEGORY_KEYS) {
    const theme = CATEGORY_THEME_MAP[key];
    for (const token of GLASS_TOKEN_KEYS) {
      assert.ok(theme[token] && theme[token].length > 0, `${key}.${token} must be a real value`);
    }
  }
});

test('CATEGORY_THEME_MAP is the only source: no category theme object is shared/aliased with another', () => {
  for (let i = 0; i < CATEGORY_KEYS.length; i += 1) {
    for (let j = i + 1; j < CATEGORY_KEYS.length; j += 1) {
      assert.notEqual(CATEGORY_THEME_MAP[CATEGORY_KEYS[i]], CATEGORY_THEME_MAP[CATEGORY_KEYS[j]]);
    }
  }
});

test('approved category accents are exact and every category keeps the fixed midnight shell', () => {
  assert.equal(CATEGORY_THEME_MAP.salon.primary, '#FF5CC8');
  assert.equal(CATEGORY_THEME_MAP.gym.primary, '#23E08D');
  assert.equal(CATEGORY_THEME_MAP.shop.primary, '#FFD166');
  assert.equal(CATEGORY_THEME_MAP.clinic.primary, '#4DB7FF');
  for (const key of CATEGORY_KEYS) {
    assert.equal(CATEGORY_THEME_MAP[key].joinedBg, 'bg-[#0D1118]', `${key} must not recolor the NOQ shell`);
  }
});

test('LIVE NOW uses the one fixed semantic live red', () => {
  assert.equal(NOQ_LIVE_COLOR, '#FF3B30');
});

test('categoryCssVars exposes every new token as a --category-* custom property', () => {
  const theme = CATEGORY_THEME_MAP.gym;
  const vars = categoryCssVars(theme);
  assert.equal(vars['--category-dark-surface'], theme.darkSurface);
  assert.equal(vars['--category-glass-surface'], theme.glassSurface);
  assert.equal(vars['--category-glass-border'], theme.glassBorder);
  assert.equal(vars['--category-cta-gradient'], theme.ctaGradient);
  assert.equal(vars['--category-selected-glow'], '#23E08D');
  assert.equal(vars['--category-modal-tint'], theme.modalTint);
  assert.equal(vars['--category-subtle-accent'], theme.subtleAccent);
});

test('resolveCategoryTheme still falls back to salon for an unknown or missing key', () => {
  assert.equal(resolveCategoryTheme(undefined), CATEGORY_THEME_MAP.salon);
  assert.equal(resolveCategoryTheme('not-a-real-category'), CATEGORY_THEME_MAP.salon);
  assert.equal(resolveCategoryTheme('GYM'), CATEGORY_THEME_MAP.gym);
});
