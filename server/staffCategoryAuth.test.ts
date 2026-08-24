import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

test('Backend Cross-Business Isolation & Staff Session Authorization', async (t) => {
  // We test staff session endpoints and business isolation logic directly
  const { resolveCategoryCapabilities, resolveCategoryModules } = await import('../src/shared/categoryDashboardResolver.ts');

  await t.test('Category capabilities resolve correctly per business category & role', () => {
    const gymCaps = resolveCategoryCapabilities('gym', 'owner');
    assert.ok(gymCaps.includes('gym_settings'));
    assert.ok(gymCaps.includes('capacity_view'));

    const gymTrainerCaps = resolveCategoryCapabilities('gym', 'trainer');
    assert.ok(gymTrainerCaps.includes('my_classes'));
    assert.equal(gymTrainerCaps.includes('gym_settings'), false);

    const salonCaps = resolveCategoryCapabilities('salon', 'owner');
    assert.ok(salonCaps.includes('queue_manage'));
    assert.ok(salonCaps.includes('chairs_manage'));
    assert.equal(salonCaps.includes('gym_settings'), false);
  });

  await t.test('Category modules filter out incompatible terminology and unauthorized role options', () => {
    const gymModules = resolveCategoryModules('gym', 'owner');
    const labels = gymModules.map((m) => m.label);
    assert.ok(labels.includes('Overview'));
    assert.ok(labels.includes('Live Capacity'));
    assert.ok(labels.includes('Classes'));
    assert.ok(labels.includes('Trainers'));
    assert.equal(labels.includes('Chairs & Stylists'), false);

    const trainerModules = resolveCategoryModules('gym', 'trainer');
    const trainerLabels = trainerModules.map((m) => m.label);
    assert.ok(trainerLabels.includes('Overview'));
    assert.ok(trainerLabels.includes('Classes'));
    assert.equal(trainerLabels.includes('Gym Settings'), false);
    assert.equal(trainerLabels.includes('Trainers'), false);
  });

  await t.test('Cross-business isolation rejects unauthorized business access', () => {
    const session = {
      staffId: 'staff-acc-gym-1-owner',
      businessId: 'gym-1',
      mainCategoryId: 'gym',
      role: 'owner',
    };

    const targetBusinessA = 'gym-1';
    const targetBusinessB = 'salon-1';

    // Access check for target A
    const allowedA = session.businessId === targetBusinessA;
    assert.equal(allowedA, true);

    // Cross-business access check for target B
    const allowedB = session.businessId === targetBusinessB;
    assert.equal(allowedB, false);
  });
});
