import assert from 'node:assert/strict';
import test from 'node:test';
import { isAppReady, resolveAppReadiness } from './profileReadiness.ts';
import type { CustomerAuthSession, CustomerProfile } from '../types';

const auth: CustomerAuthSession = { token: 'tok-1', customerId: 'cust-1', phoneNumber: '9876543210' };
const profile: CustomerProfile = {
  customerId: 'cust-1',
  phoneNumber: '9876543210',
  name: 'Riya Shah',
  email: '',
  dateOfBirth: '',
  gender: 'Woman',
  anniversary: '',
  city: '',
  profilePhotoUrl: '',
  createdAt: 0,
  updatedAt: 0,
};

test('a verified customer with a usable name and gender is ready, never asked again', () => {
  const gate = resolveAppReadiness(auth, profile);
  assert.equal(gate.kind, 'ready');
  assert.equal(isAppReady(auth, profile), true);
});

test('no session at all requires onboarding', () => {
  assert.deepEqual(resolveAppReadiness(null, null), { kind: 'onboarding_required', reason: 'not_signed_in' });
});

test('a session without a verified phone still requires onboarding', () => {
  const gate = resolveAppReadiness({ token: '', customerId: 'cust-1', phoneNumber: '9876543210' }, profile);
  assert.equal(gate.kind, 'onboarding_required');
});

test('verified but nameless customer is asked only for the missing field', () => {
  const gate = resolveAppReadiness(auth, { ...profile, name: '' });
  assert.deepEqual(gate, { kind: 'onboarding_required', reason: 'missing_profile', missing: ['name'] });
});

test('verified customer missing gender is asked only for the missing field', () => {
  const gate = resolveAppReadiness(auth, { ...profile, gender: '' });
  assert.deepEqual(gate, { kind: 'onboarding_required', reason: 'missing_profile', missing: ['gender'] });
});

test('a signed-in customer whose profile has not loaded yet waits instead of being asked', () => {
  const gate = resolveAppReadiness(auth, null, { profileLoading: true });
  assert.deepEqual(gate, { kind: 'loading' });
});

test('email, date of birth, and city never gate readiness', () => {
  const gate = resolveAppReadiness(auth, { ...profile, email: '', dateOfBirth: '', city: '' });
  assert.equal(gate.kind, 'ready');
});
