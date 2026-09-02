import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { REVIEW_CUSTOMER_BUSINESS_UNIQUENESS_MIGRATION_SQL } from './migrations.ts';

test('migration 17 canonicalizes historical review duplicates without deleting audit rows', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE business_review (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      customer_id TEXT,
      review_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'visible',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  const insert = db.prepare(`
    INSERT INTO business_review
      (id, business_id, customer_id, review_text, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run('older-visible', 'business-1', 'customer-1', 'Older legitimate review', 'visible', 100, 200);
  insert.run('newer-hidden', 'business-1', 'customer-1', 'Newest moderated review', 'hidden', 150, 300);
  insert.run('historical-deleted', 'business-1', 'customer-1', 'Already deleted history', 'deleted', 50, 400);
  insert.run('visible-with-deleted', 'business-2', 'customer-2', 'Visible canonical review', 'visible', 100, 100);
  insert.run('deleted-alongside-visible', 'business-2', 'customer-2', 'Deleted history', 'deleted', 200, 200);
  insert.run('deleted-only', 'business-3', 'customer-3', 'Only historical review', 'deleted', 100, 100);

  db.exec(REVIEW_CUSTOMER_BUSINESS_UNIQUENESS_MIGRATION_SQL);

  const rows = db.prepare('SELECT id, review_text, status FROM business_review ORDER BY id').all() as Array<{ id: string; review_text: string; status: string }>;
  assert.equal(rows.length, 6, 'migration must retain every historical row');
  const canonical = rows.find((row) => row.id === 'newer-hidden');
  assert.equal(canonical?.review_text, 'Newest moderated review');
  assert.equal(canonical?.status, 'hidden');
  assert.equal(rows.find((row) => row.id === 'older-visible')?.status, 'deleted');
  assert.equal(rows.find((row) => row.id === 'historical-deleted')?.review_text, 'Already deleted history');
  assert.equal(rows.find((row) => row.id === 'visible-with-deleted')?.status, 'visible');
  assert.equal(rows.find((row) => row.id === 'deleted-alongside-visible')?.status, 'deleted');
  assert.equal(rows.find((row) => row.id === 'deleted-only')?.status, 'deleted');

  assert.throws(
    () => insert.run('race-duplicate', 'business-2', 'customer-2', 'Concurrent active duplicate', 'visible', 300, 300),
    /UNIQUE constraint failed/,
  );
  assert.doesNotThrow(() => {
    insert.run('more-deleted-history', 'business-2', 'customer-2', 'Retained audit history', 'deleted', 300, 300);
  });
  assert.doesNotThrow(() => {
    insert.run('replacement-after-delete', 'business-3', 'customer-3', 'Replacement review', 'visible', 300, 300);
  });

  db.close();
});
