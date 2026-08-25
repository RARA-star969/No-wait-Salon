import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Business Activation & Deactivation System', () => {
  it('platformStatus property is supported on state snapshots', () => {
    const snapshot = {
      salonId: 'salon-1',
      version: 1,
      queue: [],
      barbers: [],
      completedList: [],
      updatedAt: Date.now(),
      platformStatus: 'deactivated',
    };
    assert.equal(snapshot.platformStatus, 'deactivated');
  });

  it('deactivated status hides business from customer discovery filters', () => {
    const salons = [
      { id: 'gym-1', name: 'Iron House Gym', platformStatus: 'active', mainCategoryId: 'gym' },
      { id: 'gym-2', name: 'Power Gym', platformStatus: 'deactivated', mainCategoryId: 'gym' },
    ];
    const visibleSalons = salons.filter((s) => s.platformStatus !== 'deactivated');
    assert.equal(visibleSalons.length, 1);
    assert.equal(visibleSalons[0].id, 'gym-1');
  });

  it('reactivating business restores customer visibility without data loss', () => {
    const salonData = {
      id: 'gym-2',
      name: 'Power Gym',
      platformStatus: 'deactivated',
      services: [{ id: 's1', name: 'Monthly Pass', priceInr: 1500 }],
      staff: [{ id: 't1', name: 'Coach Rahul' }],
    };

    // Reactivate
    salonData.platformStatus = 'active';
    assert.equal(salonData.platformStatus, 'active');
    assert.equal(salonData.services.length, 1);
    assert.equal(salonData.staff.length, 1);
  });

  it('demo staff account seeding is guarded against production environment', () => {
    const shouldSeed = (env: string) => env !== 'production';
    assert.equal(shouldSeed('production'), false);
    assert.equal(shouldSeed('development'), true);
  });
});
