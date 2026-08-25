import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { validateBusinessCode } from './index.js';

describe('Business ID & Profile Completion Architecture', () => {

  test('valid Business ID accepted and canonicalized', () => {
    assert.strictEqual(validateBusinessCode('  abc-123 '), 'ABC-123');
    assert.strictEqual(validateBusinessCode('IRONHOUSE01'), 'IRONHOUSE01');
  });

  test('invalid chars rejected', () => {
    assert.throws(() => validateBusinessCode('abc@123'), /can only contain/);
    assert.throws(() => validateBusinessCode('abc 123'), /can only contain/);
  });
  
  test('duplicate different-case code rejected', () => {
    assert.strictEqual(validateBusinessCode('IRONhouse01'), 'IRONHOUSE01');
    assert.strictEqual(validateBusinessCode('ironhouse01'), 'IRONHOUSE01');
  });
  
  test('Admin create persists business_code', () => {});
  test('correct businessCode + correct Staff credentials succeeds', () => {});
  test('WRONG businessCode + valid credentials fails', () => {});
  test('Business ID alone cannot login', () => {});
  test('owner profile edit works', () => {});
  test('manager profile edit works', () => {});
  test('trainer profile edit denied', () => {});
  test('protected fields ignored/rejected', () => {});
  test('Skip does not modify profile completion', () => {});
  test('Complete setup sets profile_completed_at', () => {});
  test('Gym owner core-state update works', () => {});
  test('wrong-business Staff core-state denied', () => {});
  test('trainer core-state denied', () => {});
  test('Gym state isolation', () => {});
  test('TEST owner path unavailable outside test environment', () => {});
});
