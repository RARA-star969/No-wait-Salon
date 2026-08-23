import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {ensureBusinessQr,findActiveBusinessQr} from './businessQr.ts';
import {renderQrPng,renderQrSvg} from './qrRendering.ts';

function database(){
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE business_qr (id TEXT PRIMARY KEY,business_id TEXT NOT NULL,business_type TEXT NOT NULL,public_token TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'active',version INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,revoked_at INTEGER);CREATE UNIQUE INDEX business_qr_active_business_idx ON business_qr(business_id,business_type) WHERE status='active';`);
  return db;
}

test('existing businesses keep unique persistent QR identities',()=>{
  const db=database();
  const salonA=ensureBusinessQr(db,'sharpcut-studio');
  const salonB=ensureBusinessQr(db,'royal-man-salon');
  assert.notEqual(salonA.public_token,salonB.public_token);
  assert.equal(ensureBusinessQr(db,'sharpcut-studio').public_token,salonA.public_token);
  assert.equal(ensureBusinessQr(db,'royal-man-salon').public_token,salonB.public_token);
});

test('a token resolves only to the business that owns it',()=>{
  const db=database();
  const salonA=ensureBusinessQr(db,'salon-a');
  const salonB=ensureBusinessQr(db,'salon-b');
  assert.equal(findActiveBusinessQr(db,salonA.public_token)?.business_id,'salon-a');
  assert.equal(findActiveBusinessQr(db,salonB.public_token)?.business_id,'salon-b');
  assert.notEqual(findActiveBusinessQr(db,salonA.public_token)?.business_id,'salon-b');
});

test('future businesses automatically receive an independent identity',()=>{
  const db=database();
  const existing=ensureBusinessQr(db,'existing');
  const future=ensureBusinessQr(db,'future-business','clinic');
  assert.equal(future.business_type,'clinic');
  assert.notEqual(future.public_token,existing.public_token);
  assert.equal(findActiveBusinessQr(db,future.public_token)?.business_id,'future-business');
});

test('QR rendering is local SVG and contains no remote renderer URL',()=>{
  const svg=renderQrSvg('https://customer.example/q/secure-token');
  assert.match(svg,/^<svg/);
  assert.match(svg,/<path d="M/);
  assert.doesNotMatch(svg,/quickchart\.io|<(?:image|script)[^>]+https?:\/\//i);
  assert.deepEqual([...renderQrPng('https://customer.example/q/secure-token').subarray(0,8)],[137,80,78,71,13,10,26,10]);
});
