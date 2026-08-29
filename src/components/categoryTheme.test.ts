import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_THEME_MAP, categoryCssVars, resolveCategoryTheme } from './CustomerHomeComponents';

const CATEGORY_KEYS = ['salon', 'gym', 'shop', 'moto', 'pets', 'mall', 'food'];
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

test("gym's canonical tokens match its existing shipped purple identity exactly (consolidation must not change Gym's pixels)", () => {
  const gym = CATEGORY_THEME_MAP.gym;
  assert.equal(gym.darkSurface, '#241539');
  assert.equal(gym.glassSurface, 'rgba(46,27,74,0.88)');
  assert.equal(gym.glassBorder, 'rgba(192,132,252,0.16)');
  assert.equal(gym.ctaGradient, 'linear-gradient(160deg, #5B21B6 0%, #2E1065 75%)');
  assert.equal(gym.selectedGlow, '#8B5CF6');
  assert.equal(gym.modalTint, 'linear-gradient(160deg,#180F28 0%,#241539 55%,#2E1B4A 100%)');
  assert.equal(gym.subtleAccent, '#E9D5FF');
});

test("salon's original hand-authored fields are untouched by the new-token derivation pass", () => {
  const salon = CATEGORY_THEME_MAP.salon;
  assert.equal(salon.primary, '#22D3EE');
  assert.equal(salon.accent, '#2DD4BF');
  assert.equal(salon.cardBg, 'from-[#0B3033] to-[#061B1D]');
  assert.equal(salon.joinedBg, 'bg-[#050B0C]');
  // The new tokens exist for Salon too (one map covers every category) but
  // are formula-derived from its own primary/accent, not Gym's values.
  assert.ok(salon.darkSurface.startsWith('#'));
  assert.notEqual(salon.selectedGlow, CATEGORY_THEME_MAP.gym.selectedGlow);
});

test('categoryCssVars exposes every new token as a --category-* custom property', () => {
  const vars = categoryCssVars(CATEGORY_THEME_MAP.gym);
  assert.equal(vars['--category-dark-surface'], '#241539');
  assert.equal(vars['--category-glass-surface'], 'rgba(46,27,74,0.88)');
  assert.equal(vars['--category-glass-border'], 'rgba(192,132,252,0.16)');
  assert.equal(vars['--category-cta-gradient'], 'linear-gradient(160deg, #5B21B6 0%, #2E1065 75%)');
  assert.equal(vars['--category-selected-glow'], '#8B5CF6');
  assert.equal(vars['--category-modal-tint'], 'linear-gradient(160deg,#180F28 0%,#241539 55%,#2E1B4A 100%)');
  assert.equal(vars['--category-subtle-accent'], '#E9D5FF');
});

test('resolveCategoryTheme still falls back to salon for an unknown or missing key', () => {
  assert.equal(resolveCategoryTheme(undefined), CATEGORY_THEME_MAP.salon);
  assert.equal(resolveCategoryTheme('not-a-real-category'), CATEGORY_THEME_MAP.salon);
  assert.equal(resolveCategoryTheme('GYM'), CATEGORY_THEME_MAP.gym);
});
