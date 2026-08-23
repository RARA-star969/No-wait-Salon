import {randomBytes, randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';

export type BusinessQrRow={id:string;business_id:string;business_type:string;public_token:string;status:string;version:number;created_at:number;updated_at:number;revoked_at?:number};

export function ensureBusinessQr(db:DatabaseSync,businessId:string,businessType='salon'){
  const existing=db.prepare("SELECT * FROM business_qr WHERE business_id=? AND business_type=? AND status='active'").get(businessId,businessType) as BusinessQrRow|undefined;
  if(existing)return existing;
  const now=Date.now();
  const previous=db.prepare('SELECT MAX(version) version FROM business_qr WHERE business_id=? AND business_type=?').get(businessId,businessType) as {version:number|null};
  const created:BusinessQrRow={id:randomUUID(),business_id:businessId,business_type:businessType,public_token:randomBytes(24).toString('base64url'),status:'active',version:Number(previous?.version||0)+1,created_at:now,updated_at:now};
  db.prepare('INSERT INTO business_qr (id,business_id,business_type,public_token,status,version,created_at,updated_at,revoked_at) VALUES (?,?,?,?,?,?,?,?,NULL)')
    .run(created.id,created.business_id,created.business_type,created.public_token,created.status,created.version,created.created_at,created.updated_at);
  return created;
}

export function findActiveBusinessQr(db:DatabaseSync,publicToken:string){
  return db.prepare("SELECT * FROM business_qr WHERE public_token=? AND status='active'").get(publicToken) as BusinessQrRow|undefined;
}
