import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

await import('./index.ts');

if (process.env.NO_WAIT_TEST_DEPLOYMENT === 'true') {
  const dataDir = process.env.DATA_DIR || path.resolve('data');
  const db = new DatabaseSync(path.join(dataDir, 'no-wait-salon.db'));
  db.exec('PRAGMA busy_timeout = 5000');
  db.prepare("UPDATE salon SET business_code = NULL WHERE business_code = ? AND id <> ?").run('IRONHOUSE01', 'gym-1');
  db.prepare("UPDATE salon SET business_code = ? WHERE id = ?").run('IRONHOUSE01', 'gym-1');
  db.prepare("UPDATE salon SET business_code = NULL WHERE business_code = ? AND id <> ?").run('VELOCITY01', 'gym-2');
  db.prepare("UPDATE salon SET business_code = ? WHERE id = ?").run('VELOCITY01', 'gym-2');
  db.close();
  console.log('[test-bootstrap] deterministic Gym Business IDs applied');
}
