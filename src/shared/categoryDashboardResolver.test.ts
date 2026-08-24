import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCategoryCapabilities,
  resolveCategoryModules,
  canAccessModule,
} from './categoryDashboardResolver.ts';

test('Gym Owner resolves full Gym capabilities & modules without Salon terms', () => {
  const caps = resolveCategoryCapabilities('gym', 'owner');
  assert.ok(caps.includes('capacity_view'));
  assert.ok(caps.includes('classes_manage'));
  assert.ok(caps.includes('gym_settings'));

  const modules = resolveCategoryModules('gym', 'owner');
  const ids = modules.map((m) => m.id);
  assert.ok(ids.includes('overview'));
  assert.ok(ids.includes('capacity'));
  assert.ok(ids.includes('classes'));
  assert.ok(ids.includes('trainers'));
  assert.ok(ids.includes('settings'));
  assert.equal(ids.includes('chairs'), false);
  assert.equal(ids.includes('barbers'), false);
});

test('Gym Trainer receives restricted view denying owner settings & capacity management', () => {
  const caps = resolveCategoryCapabilities('gym', 'trainer');
  assert.ok(caps.includes('my_classes'));
  assert.ok(caps.includes('my_pt_bookings'));
  assert.equal(caps.includes('gym_settings'), false);

  const modules = resolveCategoryModules('gym', 'trainer');
  const ids = modules.map((m) => m.id);
  assert.ok(ids.includes('overview'));
  assert.ok(ids.includes('classes'));
  assert.ok(ids.includes('pt_bookings'));
  assert.equal(ids.includes('settings'), false);
  assert.equal(ids.includes('trainers'), false);
  assert.equal(ids.includes('capacity'), false);
});

test('Salon Owner receives existing Salon queue and chairs modules unchanged', () => {
  const modules = resolveCategoryModules('salon', 'owner');
  const ids = modules.map((m) => m.id);
  assert.ok(ids.includes('queue'));
  assert.ok(ids.includes('chairs'));
  assert.ok(ids.includes('staff'));
  assert.ok(ids.includes('offers'));
  assert.equal(ids.includes('classes'), false);
  assert.equal(ids.includes('trainers'), false);
});

test('canAccessModule enforces role and category permissions', () => {
  assert.equal(canAccessModule('gym', 'owner', 'settings'), true);
  assert.equal(canAccessModule('gym', 'trainer', 'settings'), false);
  assert.equal(canAccessModule('salon', 'owner', 'chairs'), true);
  assert.equal(canAccessModule('gym', 'owner', 'chairs'), false);
});
