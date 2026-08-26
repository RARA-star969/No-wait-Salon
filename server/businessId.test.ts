import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let child: ChildProcess | null = null;
let base = '';
let dataDir = '';
let adminToken = '';
let gym1Id = '';
let gym2Id = '';

const api = async (method: string, url: string, body?: unknown, token?: string) => {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${base}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  if (text.startsWith('<')) console.log('HTML RESP:', text.substring(0, 100));
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
  
  // Create Gym 1
  const gym1 = await api('POST', '/api/admin/salons', { name: 'Gym 1', main_category_id: 'gym', business_code: 'GYM01', status: 'active', latitude: 0, longitude: 0 }, adminToken);
  gym1Id = gym1.data.salon.id;
  
  // Add a trainer to Gym 1 via PUT
  await api('PUT', `/api/admin/salons/${gym1Id}`, {
    staff: [{ name: 'Trainer 1', working_status: 'available', role: 'trainer', email: 'ironhouse-trainer@nowaitsalon.test' }]
  }, adminToken);
  
  // Create Gym 2
  const gym2 = await api('POST', '/api/admin/salons', { name: 'Gym 2', main_category_id: 'gym', business_code: 'GYM02', status: 'active', latitude: 0, longitude: 0 }, adminToken);
  gym2Id = gym2.data.salon.id;
  
  // Link the pre-seeded staff accounts to our new dynamic Gym 1 ID
  const db = new DatabaseSync(path.join(dataDir, 'no-wait-salon.db'));
  db.prepare("UPDATE staff_account SET business_id = ? WHERE email = 'ironhouse-owner@nowaitsalon.test'").run(gym1Id);
  db.prepare("UPDATE staff_account SET business_id = ? WHERE email = 'ironhouse-trainer@nowaitsalon.test'").run(gym1Id);
  db.close();

});

after(() => {
  if (child) child.kill();
  try { rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
});

test('Business ID Integration Tests', async (t) => {
  
  await t.test('1. valid Business ID canonicalizes uppercase', async () => {
    const res = await api('GET', '/api/admin/check-business-id/abc-123', undefined, adminToken);
    if (res.status !== 200)         if(res.status !== 200) throw new Error(JSON.stringify(res.data));
    assert.equal(res.status, 200);
    assert.equal(res.data.code, 'ABC-123');
  });

  await t.test('2. invalid characters rejected', async () => {
    const res = await api('GET', '/api/admin/check-business-id/abc@123', undefined, adminToken);
    assert.equal(res.status, 400);
  });

  await t.test('3. normal Staff login: correct businessCode + correct credentials succeeds', async () => {
    const res = await api('POST', '/api/staff/login', { email: 'ironhouse-trainer@nowaitsalon.test', password: 'staff123', businessCode: 'GYM01' });
    assert.equal(res.status, 200);
    assert.ok(res.data.token);
  });

  await t.test('4. normal Staff login: WRONG businessCode + otherwise valid credentials returns 401', async () => {
    const res = await api('POST', '/api/staff/login', { email: 'ironhouse-trainer@nowaitsalon.test', password: 'staff123', businessCode: 'WRONG' });
    assert.equal(res.status, 401);
  });

  await t.test('5. login without businessCode fails', async () => {
    const res = await api('POST', '/api/staff/login', { email: 'ironhouse-trainer@nowaitsalon.test', password: 'staff123' });
    assert.equal(res.status, 400);
  });

  let testOwnerToken = '';
  await t.test('6. TEST owner login works when NO_WAIT_TEST_DEPLOYMENT=true', async () => {
    const res = await api('POST', '/api/staff/test-login', { businessCode: 'GYM01' });
    assert.equal(res.status, 200);
    testOwnerToken = res.data.token;
  });

  await t.test('7. TEST owner login returns 403 when NO_WAIT_TEST_DEPLOYMENT is not true', async () => {
    // Create another child without NO_WAIT_TEST_DEPLOYMENT
    const port2 = 30000 + Math.floor(Math.random() * 10000);
    const child2 = spawn('node', ['--import', 'tsx', 'server/index.ts'], {
      cwd: projectRoot,
      env: { ...process.env, PORT: String(port2), DATA_DIR: dataDir, NO_WAIT_TEST_DEPLOYMENT: 'false', ADMIN_PASSWORD: 'test' },
    });
    await new Promise<void>((resolve) => {
      const onData = (b) => {
        if (b.toString().includes('server listening')) {
          child2.stdout.off('data', onData);
          resolve();
        }
      };
      child2.stdout.on('data', onData);
    });
    const res = await fetch(`http://127.0.0.1:${port2}/api/staff/test-login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessCode: 'GYM01' })
    });
    assert.equal(res.status, 403);
    child2.kill();
  });

  await t.test('8. TEST owner session is tied to resolved business', async () => {
    const res = await api('GET', '/api/staff/session', undefined, testOwnerToken);
    assert.equal(res.data.business.businessCode, 'GYM01');
  });

  await t.test('9. owner can update public business profile', async () => {
    const res = await api('PUT', '/api/staff/business/profile', { name: 'Updated Gym' }, testOwnerToken);
    assert.equal(res.status, 200);
  });

  await t.test('10. trainer/non-manager cannot update public profile', async () => {
    const login = await api('POST', '/api/staff/login', { email: 'ironhouse-trainer@nowaitsalon.test', password: 'staff123', businessCode: 'GYM01' });
    const trainerToken = login.data.token;
    const res = await api('PUT', '/api/staff/business/profile', { name: 'Hacked Gym' }, trainerToken);
    assert.equal(res.status, 403);
  });

  await t.test('11. completing setup sets profile_completed_at', async () => {
    await api('PUT', '/api/staff/business/profile', { markComplete: true }, testOwnerToken);
    const sess = await api('GET', '/api/staff/session', undefined, testOwnerToken);
    assert.ok(sess.data.business.profileCompletedAt);
  });

  await t.test('12. Gym owner can update core-state', async () => { const res = await api('PUT', `/api/gym/${gym1Id}/core-state`, { maxCapacity: 100 }, testOwnerToken); assert.equal(res.status, 200); });

  await t.test('13. wrong-business owner cannot update another Gym', async () => {
    const res = await api('PUT', `/api/gym/${gym2Id}/core-state`, { maxCapacity: 100 }, testOwnerToken);
    assert.equal(res.status, 403);
  });

  await t.test('14. trainer cannot update Gym core-state', async () => {
    const login = await api('POST', '/api/staff/login', { email: 'ironhouse-trainer@nowaitsalon.test', password: 'staff123', businessCode: 'GYM01' });
    const trainerToken = login.data.token;
    const res = await api('PUT', `/api/gym/${gym1Id}/core-state`, { maxCapacity: 999 }, trainerToken);
    assert.equal(res.status, 403);
  });

  await t.test('15. Gym A state does not mutate Gym B state', async () => {
    const loginA = await api('POST', '/api/staff/test-login', { businessCode: 'GYM01' });
    const tokenA = loginA.data.token;
    const loginB = await api('POST', '/api/staff/test-login', { businessCode: 'GYM02' });
    if (loginB.status !== 200) throw new Error(JSON.stringify(loginB.data));
    const tokenB = loginB.data.token;
    
    await api('PUT', `/api/gym/${gym1Id}/core-state`, { maxCapacity: 111 }, tokenA);
    await api('PUT', `/api/gym/${gym2Id}/core-state`, { maxCapacity: 222 }, tokenB);
    
    const resA = await api('GET', `/api/gym/${gym1Id}/overview`, undefined, tokenA);
    const resB = await api('GET', `/api/gym/${gym2Id}/overview`, undefined, tokenB);
    
    if (resA.status !== 200) throw new Error(JSON.stringify(resA.data));
    assert.equal(resA.data.maxCapacity, 111);
    if (resB.status !== 200) throw new Error(JSON.stringify(resB.data));
    assert.equal(resB.data.maxCapacity, 222);
  });

  await t.test('16. admin can assign a Business ID to an existing business without changing its QR', async () => {
    const beforeQr = await api('GET', `/api/admin/businesses/${gym1Id}/qr`, undefined, adminToken);
    const assigned = await api('PATCH', `/api/admin/salons/${gym1Id}/business-id`, { business_code: 'IRON001' }, adminToken);
    assert.equal(assigned.status, 200);
    assert.equal(assigned.data.businessCode, 'IRON001');
    assert.equal(assigned.data.qrUnchanged, true);

    const afterQr = await api('GET', `/api/admin/businesses/${gym1Id}/qr`, undefined, adminToken);
    assert.equal(afterQr.data.qr.publicToken, beforeQr.data.qr.publicToken);
  });

  await t.test('17. existing-business assignment canonicalizes lowercase input', async () => {
    const assigned = await api('PATCH', `/api/admin/salons/${gym1Id}/business-id`, { business_code: 'iron-002' }, adminToken);
    assert.equal(assigned.status, 200);
    assert.equal(assigned.data.businessCode, 'IRON-002');
  });

  await t.test('18. existing-business assignment rejects an ID owned by another business', async () => {
    const duplicate = await api('PATCH', `/api/admin/salons/${gym1Id}/business-id`, { business_code: 'GYM02' }, adminToken);
    assert.equal(duplicate.status, 409);
  });

});
