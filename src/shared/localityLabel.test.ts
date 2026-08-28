import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveLocalityLabel } from './localityLabel.ts';

test('Locality Label', async (t) => {
  await t.test('prefers the business\'s own area field when set', () => {
    assert.equal(deriveLocalityLabel({ area: 'Indiranagar', address: '1, MG Road, Bengaluru' }), 'Indiranagar');
  });

  await t.test('derives the locality from the address when area is empty', () => {
    const label = deriveLocalityLabel({
      area: '',
      address: '742, 12th Main Road, Indiranagar, Bengaluru 560038',
    });
    assert.equal(label, 'Indiranagar');
  });

  await t.test('falls back to city when the address has too few segments', () => {
    assert.equal(deriveLocalityLabel({ area: '', address: 'Bengaluru', city: 'Bengaluru' }), 'Bengaluru');
  });

  await t.test('falls back to the raw address only as a last resort', () => {
    assert.equal(deriveLocalityLabel({ area: '', address: 'Bengaluru' }), 'Bengaluru');
  });
});
