import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_THEME_MAP, categoryCssVars, customerHomeAccent, resolveCategoryTheme } from './CustomerHomeComponents';
import { NOQ_BRAND } from '../shared/noqBrand';

const CATEGORY_KEYS = ['salon', 'gym', 'shop', 'moto', 'pets', 'mall', 'food', 'clinic', 'spa', 'more'];
const GLASS_TOKEN_KEYS = ['darkSurface', 'glassSurface', 'glassBorder', 'ctaGradient', 'selectedGlow', 'modalTint', 'subtleAccent'] as const;

test('every customer category resolves to the same canonical NOQ palette', () => {
  for (const key of CATEGORY_KEYS) {
    const theme = CATEGORY_THEME_MAP[key];
    assert.equal(theme.primary, NOQ_BRAND.accent, `${key}.primary`);
    assert.equal(theme.accent, NOQ_BRAND.accent, `${key}.accent`);
    assert.equal(theme.darkSurface, NOQ_BRAND.surfaceSoft, `${key}.darkSurface`);
    assert.equal(theme.glassSurface, NOQ_BRAND.glass, `${key}.glassSurface`);
    assert.equal(theme.glassBorder, NOQ_BRAND.glassBorder, `${key}.glassBorder`);
    assert.equal(theme.ctaGradient, NOQ_BRAND.ctaGradient, `${key}.ctaGradient`);
    assert.equal(theme.selectedGlow, NOQ_BRAND.accent, `${key}.selectedGlow`);
    assert.equal(theme.modalTint, NOQ_BRAND.glassGradient, `${key}.modalTint`);
    assert.equal(theme.subtleAccent, NOQ_BRAND.accentLight, `${key}.subtleAccent`);
    assert.equal(customerHomeAccent({ id: key }), NOQ_BRAND.accent, `${key}.homeAccent`);
  }
});

test('category objects stay independent even though their colours are unified', () => {
  for (let i = 0; i < CATEGORY_KEYS.length; i += 1) {
    for (let j = i + 1; j < CATEGORY_KEYS.length; j += 1) {
      assert.notEqual(CATEGORY_THEME_MAP[CATEGORY_KEYS[i]], CATEGORY_THEME_MAP[CATEGORY_KEYS[j]]);
    }
  }
});

test('every category exposes a complete glass material token set', () => {
  for (const key of CATEGORY_KEYS) {
    for (const token of GLASS_TOKEN_KEYS) assert.ok(CATEGORY_THEME_MAP[key][token], `${key}.${token}`);
  }
});

test('categoryCssVars exposes canonical brand and compatibility properties', () => {
  const vars = categoryCssVars(CATEGORY_THEME_MAP.gym);
  assert.equal(vars['--noq-base'], NOQ_BRAND.base);
  assert.equal(vars['--noq-accent'], NOQ_BRAND.accent);
  assert.equal(vars['--category-primary'], NOQ_BRAND.accent);
  assert.equal(vars['--category-accent'], NOQ_BRAND.accent);
  assert.equal(vars['--category-dark-surface'], NOQ_BRAND.surfaceSoft);
  assert.equal(vars['--category-glass-surface'], NOQ_BRAND.glass);
  assert.equal(vars['--category-cta-gradient'], NOQ_BRAND.ctaGradient);
});

test('resolveCategoryTheme remains category-safe and falls back to salon', () => {
  assert.equal(resolveCategoryTheme(undefined), CATEGORY_THEME_MAP.salon);
  assert.equal(resolveCategoryTheme('not-a-real-category'), CATEGORY_THEME_MAP.salon);
  assert.equal(resolveCategoryTheme('GYM'), CATEGORY_THEME_MAP.gym);
});
