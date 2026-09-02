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

test('Salon audience field', async (t) => {
  await t.test('a salon created without an audience defaults to unisex', async () => {
    const created = await api('POST', '/api/admin/salons', {
      name: 'Default Audience Salon', main_category_id: 'salon', business_code: 'AUD01', status: 'active', latitude: 0, longitude: 0,
    }, adminToken);
    assert.equal(created.status, 201);
    assert.equal(created.data.salon.audience, 'unisex');
  });

  await t.test('a salon can be created and updated with an explicit men/women audience', async () => {
    const created = await api('POST', '/api/admin/salons', {
      name: 'Mens Barbershop', main_category_id: 'salon', business_code: 'AUD02', status: 'active', latitude: 0, longitude: 0, audience: 'men',
    }, adminToken);
    assert.equal(created.data.salon.audience, 'men');

    const updated = await api('PUT', `/api/admin/salons/${created.data.salon.id}`, {
      name: 'Mens Barbershop', main_category_id: 'salon', status: 'active', latitude: 0, longitude: 0, audience: 'women',
    }, adminToken);
    assert.equal(updated.data.salon.audience, 'women');
  });

  await t.test('an unrecognized audience value safely falls back to unisex, never crashes', async () => {
    const created = await api('POST', '/api/admin/salons', {
      name: 'Weird Audience Salon', main_category_id: 'salon', business_code: 'AUD03', status: 'active', latitude: 0, longitude: 0, audience: 'everyone',
    }, adminToken);
    assert.equal(created.status, 201);
    assert.equal(created.data.salon.audience, 'unisex');
  });

  await t.test('the public nearby-salons feed carries the persisted audience through', async () => {
    const nearby = await api('GET', '/api/salons/nearby?lat=0&lng=0');
    const mensSalon = nearby.data.salons.find((s: { name: string }) => s.name === 'Mens Barbershop');
    assert.equal(mensSalon.audience, 'women'); // updated above
    const defaultSalon = nearby.data.salons.find((s: { name: string }) => s.name === 'Default Audience Salon');
    assert.equal(defaultSalon.audience, 'unisex');
  });
});

test('Carousel banner placement scoping', async (t) => {
  await t.test('a banner created without a placement defaults to home', async () => {
    const created = await api('POST', '/api/admin/carousel-banners', {
      type: 'image', imageUrl: 'https://example.com/a.jpg', enabled: true,
    }, adminToken);
    assert.equal(created.status, 201);
    assert.equal(created.data.banner.placement, 'home');
  });

  await t.test('rejects a placement that is neither home/category nor a real category id', async () => {
    const created = await api('POST', '/api/admin/carousel-banners', {
      type: 'image', imageUrl: 'https://example.com/b.jpg', enabled: true, placement: 'not-a-real-category',
    }, adminToken);
    assert.equal(created.status, 400);
  });

  await t.test('home, all-category, and salon-specific banners land in the right public feeds', async () => {
    const homeBanner = await api('POST', '/api/admin/carousel-banners', {
      type: 'image', imageUrl: 'https://example.com/home.jpg', enabled: true, placement: 'home', title: 'Home Only',
    }, adminToken);
    assert.equal(homeBanner.status, 201);

    const allCategoryBanner = await api('POST', '/api/admin/carousel-banners', {
      type: 'image', imageUrl: 'https://example.com/all-category.jpg', enabled: true, placement: 'category', title: 'All Categories',
    }, adminToken);
    assert.equal(allCategoryBanner.status, 201);

    const salonBanner = await api('POST', '/api/admin/carousel-banners', {
      type: 'image', imageUrl: 'https://example.com/salon.jpg', enabled: true, placement: 'salon', title: 'Salon Only',
    }, adminToken);
    assert.equal(salonBanner.status, 201);

    const gymBanner = await api('POST', '/api/admin/carousel-banners', {
      type: 'image', imageUrl: 'https://example.com/gym.jpg', enabled: true, placement: 'gym', title: 'Gym Only',
    }, adminToken);
    assert.equal(gymBanner.status, 201);

    const home = await api('GET', '/api/carousel-banners');
    const homeTitles = home.data.banners.map((b: { title: string }) => b.title);
    assert.ok(homeTitles.includes('Home Only'), 'Home feed should include the home-placed banner');
    assert.ok(!homeTitles.includes('All Categories'), 'Home feed should not include category-placed banners');
    assert.ok(!homeTitles.includes('Salon Only'), 'Home feed should not include salon-specific banners');

    const salonFeed = await api('GET', '/api/carousel-banners/category/salon');
    const salonTitles = salonFeed.data.banners.map((b: { title: string }) => b.title);
    assert.ok(salonTitles.includes('All Categories'), "Salon's category feed should include 'category'-wide banners");
    assert.ok(salonTitles.includes('Salon Only'), "Salon's category feed should include salon-specific banners");
    assert.ok(!salonTitles.includes('Gym Only'), "Salon's category feed should not include gym-specific banners");
    assert.ok(!salonTitles.includes('Home Only'), "Salon's category feed should not include home-only banners");

    const gymFeed = await api('GET', '/api/carousel-banners/category/gym');
    const gymTitles = gymFeed.data.banners.map((b: { title: string }) => b.title);
    assert.ok(gymTitles.includes('All Categories'), "Gym's category feed should include 'category'-wide banners");
    assert.ok(gymTitles.includes('Gym Only'), "Gym's category feed should include gym-specific banners");
    assert.ok(!gymTitles.includes('Salon Only'), "Gym's category feed should not include salon-specific banners");
  });

  await t.test('a disabled banner never appears in either public feed', async () => {
    const created = await api('POST', '/api/admin/carousel-banners', {
      type: 'image', imageUrl: 'https://example.com/disabled.jpg', enabled: false, placement: 'salon', title: 'Disabled Salon Banner',
    }, adminToken);
    assert.equal(created.status, 201);

    const salonFeed = await api('GET', '/api/carousel-banners/category/salon');
    const titles = salonFeed.data.banners.map((b: { title: string }) => b.title);
    assert.ok(!titles.includes('Disabled Salon Banner'));
  });
});
