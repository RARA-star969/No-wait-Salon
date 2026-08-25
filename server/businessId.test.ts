import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { validateBusinessCode } from '../src/shared/businessCodeValidation.js';

describe('Business ID Integration Tests', () => {
  test('valid code canonicalizes to uppercase', () => {
    assert.strictEqual(validateBusinessCode(' ironHouse01 '), 'IRONHOUSE01');
    assert.strictEqual(validateBusinessCode('gym-123'), 'GYM-123');
  });

  test('invalid chars rejected', () => {
    assert.throws(() => validateBusinessCode('ironhouse@1'), /letters, numbers, and hyphens/);
    assert.throws(() => validateBusinessCode('iron house'), /letters, numbers, and hyphens/);
    assert.throws(() => validateBusinessCode(''), /Business ID is required/);
    assert.throws(() => validateBusinessCode('A'), /between 3 and 50 characters/);
  });
});
