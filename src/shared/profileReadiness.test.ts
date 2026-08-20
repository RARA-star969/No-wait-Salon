import assert from 'node:assert/strict';
import test from 'node:test';
import { canJoinWithoutPrompting, resolveJoinGate } from './profileReadiness.ts';
import type { CustomerAuthSession, CustomerProfile } from '../types';

const auth: CustomerAuthSession = { token: 'tok-1', customerId: 'cust-1', phoneNumber: '9876543210' };
const profile: CustomerProfile = {
  customerId: 'cust-1',
  phoneNumber: '9876543210',
  name: 'Riya Shah',
  email: '',
  dateOfBirth: '',
  gender: '',
  anniversary: '',
  city: '',
  profilePhotoUrl: '',
  createdAt: 0,
  updatedAt: 0,
};

test('a verified customer with a usable name is never asked again', () => {
  const gate = resolveJoinGate(auth, profile);
  assert.equal(gate.kind, 'ready');
  assert.equal(canJoinWithoutPrompting(auth, profile), true);
});

test('no session at all requires verification', () => {
  assert.deepEqual(resolveJoinGate(null, null), { kind: 'needs_verification', reason: 'not_signed_in' });
});

test('a session without a verified phone still requires verification', () => {
  const gate = resolveJoinGate({ token: '', customerId: 'cust-1', phoneNumber: '9876543210' }, profile);
  assert.equal(gate.kind, 'needs_verification');
});

test('verified but nameless customer is asked only for the missing field', () => {
  const gate = resolveJoinGate(auth, { ...profile, name: '' });
  assert.deepEqual(gate, { kind: 'needs_profile', missing: ['name'] });
});

test('a signed-in customer whose profile has not loaded yet waits instead of being asked', () => {
  const gate = resolveJoinGate(auth, null, { profileLoading: true });
  assert.deepEqual(gate, { kind: 'loading' });
});

test('optional fields never gate a join', () => {
  const gate = resolveJoinGate(auth, { ...profile, email: '', dateOfBirth: '', gender: '', city: '' });
  assert.equal(gate.kind, 'ready');
});
