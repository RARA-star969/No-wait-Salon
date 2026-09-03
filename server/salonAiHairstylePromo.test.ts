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
let adminToken = '';

const api = async (method: string, url: string, body?: unknown, token?: string) => {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${base}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
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
    const onData = (b: Buffer) => {
      output += b.toString();
      if (output.includes('server listening')) {
        child?.stdout?.off('data', onData);
        resolve();
      }
    };
    child?.stdout?.on('data', onData);
    child?.on('exit', () => reject(new Error('server died')));
  });

  const loginRes = await api('POST', '/api/admin/login', { password: 'admin123' });
  adminToken = loginRes.data.token;
});

after(() => {
  if (child) child.kill();
  try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
});

test('Salon AI hairstyle promo — public read path', async (t) => {
  await t.test('the public endpoint returns the seeded default creative before any admin edit', async () => {
    const res = await api('GET', '/api/salon/ai-hairstyle-promo');
    assert.equal(res.status, 200);
    assert.equal(res.data.promo.enabled, true);
    assert.equal(res.data.promo.title, 'Try hairstyle with AI');
    assert.equal(res.data.promo.subtitle, 'Preview styles before you visit');
    assert.equal(res.data.promo.imageUrl, '/static-defaults/ai-hairstyle-promo-default.svg');
  });

  await t.test('the default creative asset is actually served and resolves', async () => {
    const res = await fetch(`${base}/static-defaults/ai-hairstyle-promo-default.svg`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /<svg/);
  });
});

test('Salon AI hairstyle promo — admin config path', async (t) => {
  await t.test('admin read requires auth', async () => {
    const res = await api('GET', '/api/admin/salon-ai-hairstyle-promo');
    assert.equal(res.status, 401);
  });

  await t.test('admin can read the current config', async () => {
    const res = await api('GET', '/api/admin/salon-ai-hairstyle-promo', undefined, adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.data.promo.imageUrl, '/static-defaults/ai-hairstyle-promo-default.svg');
  });

  await t.test('admin replacing the image is immediately reflected in the public feed — no rebuild required', async () => {
    const updated = await api('PUT', '/api/admin/salon-ai-hairstyle-promo', {
      enabled: true,
      title: 'New look, new you',
      subtitle: 'See it before you sit down',
      imageUrl: '/salon-media/new-hairstyle-banner.png',
      ctaLabel: '',
      ctaLink: '',
    }, adminToken);
    assert.equal(updated.status, 200);
    assert.equal(updated.data.promo.imageUrl, '/salon-media/new-hairstyle-banner.png');
    assert.equal(updated.data.promo.title, 'New look, new you');

    const publicRes = await api('GET', '/api/salon/ai-hairstyle-promo');
    assert.equal(publicRes.data.promo.imageUrl, '/salon-media/new-hairstyle-banner.png');
    assert.equal(publicRes.data.promo.title, 'New look, new you');
    assert.equal(publicRes.data.promo.subtitle, 'See it before you sit down');
  });

  await t.test('admin can disable the promo and it is reflected publicly', async () => {
    const updated = await api('PUT', '/api/admin/salon-ai-hairstyle-promo', {
      enabled: false,
      title: 'New look, new you',
      subtitle: 'See it before you sit down',
      imageUrl: '/salon-media/new-hairstyle-banner.png',
      ctaLabel: '',
      ctaLink: '',
    }, adminToken);
    assert.equal(updated.status, 200);
    assert.equal(updated.data.promo.enabled, false);

    const publicRes = await api('GET', '/api/salon/ai-hairstyle-promo');
    assert.equal(publicRes.data.promo.enabled, false);
  });

  await t.test('re-enabling requires an image while enabled', async () => {
    const rejected = await api('PUT', '/api/admin/salon-ai-hairstyle-promo', {
      enabled: true,
      title: '',
      subtitle: '',
      imageUrl: '',
      ctaLabel: '',
      ctaLink: '',
    }, adminToken);
    assert.equal(rejected.status, 400);
  });

  await t.test('admin update requires auth', async () => {
    const res = await api('PUT', '/api/admin/salon-ai-hairstyle-promo', { enabled: true, imageUrl: '/x.png' });
    assert.equal(res.status, 401);
  });
});
