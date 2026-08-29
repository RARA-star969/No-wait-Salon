import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSocialLinksInput, normalizeSocialLinks, socialLinksForEditor, buildSocialUrl } from './gymSocialLinks.ts';

test('Gym Social Links — buildSocialUrl', async (t) => {
  await t.test('a bare handle becomes the platform profile URL', () => {
    assert.equal(buildSocialUrl('instagram', '@ironhousegym'), 'https://instagram.com/ironhousegym');
    assert.equal(buildSocialUrl('twitter', 'ironhousegym'), 'https://x.com/ironhousegym');
  });

  await t.test('a full https URL passes through unchanged', () => {
    assert.equal(buildSocialUrl('facebook', 'https://facebook.com/ironhousegym'), 'https://facebook.com/ironhousegym');
  });

  await t.test('a value that only looks like a URL scheme is still just treated as a handle and heavily sanitized — never becomes a javascript: URL', () => {
    const result = buildSocialUrl('youtube', 'javascript:alert(1)');
    assert.ok(result === null || result.startsWith('https://youtube.com/'));
    assert.ok(!String(result).toLowerCase().includes('javascript:'));
  });

  await t.test('a handle that sanitizes down to nothing builds nothing', () => {
    assert.equal(buildSocialUrl('instagram', '!!!'), null);
  });

  await t.test('an empty value builds nothing', () => {
    assert.equal(buildSocialUrl('instagram', '   '), null);
  });
});

test('Gym Social Links — sanitizeSocialLinksInput (owner save)', async (t) => {
  await t.test('accepts a valid Instagram handle and a Facebook URL', () => {
    const result = sanitizeSocialLinksInput([
      { platform: 'instagram', value: '@ironhousegym', enabled: true },
      { platform: 'facebook', value: 'https://facebook.com/ironhousegym', enabled: true },
    ]);
    assert.equal(result.length, 2);
    assert.equal(result[0].platform, 'instagram');
  });

  await t.test('rejects an unsupported platform', () => {
    assert.throws(() => sanitizeSocialLinksInput([{ platform: 'tiktok', value: '@x' }]));
  });

  await t.test('rejects a handle that sanitizes down to nothing usable', () => {
    assert.throws(() => sanitizeSocialLinksInput([{ platform: 'instagram', value: '!!!' }]));
  });

  await t.test('rejects a duplicate platform in the same payload', () => {
    assert.throws(() => sanitizeSocialLinksInput([
      { platform: 'instagram', value: '@a' },
      { platform: 'instagram', value: '@b' },
    ]));
  });

  await t.test('a website entry carries no value of its own', () => {
    const [result] = sanitizeSocialLinksInput([{ platform: 'website', enabled: false }]);
    assert.equal(result.platform, 'website');
    assert.equal(result.value, '');
    assert.equal(result.enabled, false);
  });

  await t.test('an empty value for a real platform is accepted (means "not configured yet")', () => {
    const [result] = sanitizeSocialLinksInput([{ platform: 'youtube', value: '' }]);
    assert.equal(result.value, '');
  });
});

test('Gym Social Links — normalizeSocialLinks (customer-facing read)', async (t) => {
  await t.test('only enabled, resolvable links render, sorted by order', () => {
    const stored = [
      { platform: 'instagram', value: '@ironhousegym', enabled: true, order: 1 },
      { platform: 'facebook', value: '@ironhousegym', enabled: false, order: 0 },
      { platform: 'youtube', value: '', enabled: true, order: 2 },
    ];
    const links = normalizeSocialLinks(stored, '');
    assert.deepEqual(links.map((l) => l.platform), ['instagram']);
  });

  await t.test('website comes from salon.website_url, never a duplicated stored value', () => {
    const links = normalizeSocialLinks([], 'https://ironhousegym.example');
    assert.equal(links.length, 1);
    assert.equal(links[0].platform, 'website');
    assert.equal(links[0].url, 'https://ironhousegym.example');
  });

  await t.test('an explicit disabled website entry hides it even though website_url is set', () => {
    const links = normalizeSocialLinks([{ platform: 'website', enabled: false, order: 0 }], 'https://ironhousegym.example');
    assert.equal(links.length, 0);
  });

  await t.test('a javascript: website_url never renders, even if somehow stored', () => {
    const links = normalizeSocialLinks([], 'javascript:alert(1)');
    assert.equal(links.length, 0);
  });

  await t.test('no social links and no website_url renders an empty list, not an error', () => {
    assert.deepEqual(normalizeSocialLinks([], ''), []);
    assert.deepEqual(normalizeSocialLinks(undefined, undefined), []);
  });
});

test('Gym Social Links — socialLinksForEditor (owner-facing, includes disabled/unconfigured)', async (t) => {
  await t.test('returns a row for every controlled platform, even unconfigured ones', () => {
    const rows = socialLinksForEditor([], '');
    assert.equal(rows.length, 5);
    assert.ok(rows.some((r) => r.platform === 'twitter'));
  });

  await t.test('website row\'s value always mirrors website_url, never a stored duplicate', () => {
    const rows = socialLinksForEditor([{ platform: 'website', value: 'ignored-if-present', enabled: true, order: 0 }], 'https://real-site.example');
    const website = rows.find((r) => r.platform === 'website')!;
    assert.equal(website.value, 'https://real-site.example');
  });
});
