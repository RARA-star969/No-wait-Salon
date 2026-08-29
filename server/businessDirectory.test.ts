import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let child: ChildProcess | null = null;
let base = '';
let dataDir = '';

const api = async (method: string, url: string, body?: unknown, token?: string) => {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${base}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  const data = text && !text.startsWith('<') ? JSON.parse(text) : null;
  return { status: response.status, data };
};

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'no-wait-test-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  base = `http://127.0.0.1:${port}`;
  child = spawn('node', ['--import', 'tsx', 'server/index.ts'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, NO_WAIT_TEST_DEPLOYMENT: 'true', ADMIN_PASSWORD: 'test' },
  });
  await new Promise<void>((resolve, reject) => {
    let output = '';
    const onData = (b: Buffer) => { output += b.toString(); if (output.includes('server listening')) { child?.stdout?.off('data', onData); resolve(); } };
    child?.stdout?.on('data', onData);
    child?.on('exit', () => reject(new Error('server died')));
  });
});

after(() => {
  if (child) child.kill();
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
});

test('Business directory — carries the real category for every business, never defaulted/collapsed', async (t) => {
  await t.test('Sharpcut Studio (salon) and Iron House Gym (gym) each report their own real mainCategoryId', async () => {
    const res = await api('GET', '/api/salons/directory');
    assert.equal(res.status, 200);
    const byName = new Map(res.data.salons.map((s: { name: string; mainCategoryId: string }) => [s.name, s.mainCategoryId]));
    assert.equal(byName.get('Sharpcut Studio'), 'salon');
    assert.equal(byName.get('Iron House Gym'), 'gym');
  });

  await t.test('every directory entry names a mainCategoryId — none silently missing', async () => {
    const res = await api('GET', '/api/salons/directory');
    for (const entry of res.data.salons) {
      assert.ok(entry.mainCategoryId, `${entry.name} is missing mainCategoryId in the directory response`);
    }
  });
});

test('Business detail routing — a Salon never resolves to Gym data and vice versa', async (t) => {
  await t.test('the nearby endpoint keeps each business on its own real category regardless of category filter used', async () => {
    const salonOnly = await api('GET', '/api/salons/nearby?area=Bengaluru&categoryId=salon');
    assert.ok(salonOnly.data.salons.every((s: { mainCategoryId?: string }) => (s.mainCategoryId || 'salon') === 'salon'));

    const gymOnly = await api('GET', '/api/salons/nearby?area=Bengaluru&categoryId=gym');
    assert.ok(gymOnly.data.salons.every((s: { mainCategoryId?: string }) => s.mainCategoryId === 'gym'));

    const sharpcut = salonOnly.data.salons.find((s: { name: string }) => s.name === 'Sharpcut Studio');
    const ironHouse = gymOnly.data.salons.find((s: { name: string }) => s.name === 'Iron House Gym');
    assert.ok(sharpcut, 'Sharpcut Studio should appear under the salon category filter');
    assert.ok(ironHouse, 'Iron House Gym should appear under the gym category filter');
    assert.notEqual(sharpcut.mainCategoryId, 'gym');
    assert.equal(ironHouse.mainCategoryId, 'gym');
  });
});
