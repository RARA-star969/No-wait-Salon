import {copyFileSync,existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import {createDatabase,type Database} from './database.ts';
import {runMigrations} from './migrations.ts';

const tables:Record<string,string[]>={
  salon:['id','name','address','latitude','longitude','rating','review_count','is_open','opening_hours','services_json','barbers_json','onboarded','created_at','category','phone_number','description','cover_image_url','logo_image_url','amenities_json','offers_json','gallery_json','brand_key','short_description','email','website_url','area','city','state','pin_code','promotional_banner_url','platform_status','updated_at'],
  salon_hours:['salon_id','day_of_week','open_time','close_time','closed'],
  salon_service:['id','salon_id','name','category','price_inr','duration_min','description','image_url','active','sort_order','created_at','updated_at'],
  salon_staff:['id','salon_id','name','photo_url','role','service_ids_json','working_status','active','sort_order','created_at','updated_at'],
  salon_offer:['id','salon_id','title','discount_text','description','minimum_bill','start_date','end_date','terms','image_url','active','sort_order','created_at','updated_at'],
  salon_media:['id','salon_id','media_type','url','caption','featured','sort_order','created_at','updated_at'],
  otp_challenge:['id','phone','code_hash','expires_at','attempts','verified_at'],
  customer_account:['id','phone_number','created_at','updated_at'],
  customer_profile:['customer_id','name','email','date_of_birth','gender','anniversary','city','profile_photo_url','marketing_consent','created_at','updated_at'],
  customer_session:['token_hash','customer_id','expires_at','created_at'],
  customer_booking:['id','queue_entry_id','customer_id','salon_id','service','status','reserved_for','source','created_at','updated_at','outcome','first_called_at','call_attempts','acknowledged_at','grace_expires_at','no_show_at','service_started_at','service_completed_at'],
  admin_user:['id','email','password_hash','created_at','updated_at'],
  admin_session:['token_hash','admin_id','expires_at','created_at'],
  salon_state:['salon_id','version','state_json','updated_at'],
  business_qr:['id','business_id','business_type','public_token','status','version','created_at','updated_at','revoked_at'],
  web_qr_attribution:['id','business_id','qr_token_id','customer_id','acquisition_source','first_visit_at','joined_at','app_cta_shown','app_cta_clicked','created_at','updated_at'],
};
const insertOrder=Object.keys(tables);
const deleteOrder=[...insertOrder].reverse();

function includeReferencedTables(selected:string[]){
  const expanded=new Set(selected);
  if(expanded.has('customer_account'))['customer_profile','customer_session','customer_booking'].forEach(table=>expanded.add(table));
  if(expanded.has('admin_user'))expanded.add('admin_session');
  return insertOrder.filter(table=>expanded.has(table));
}

const placeholders=(count:number)=>Array.from({length:count},()=>'?').join(',');
const sqliteRows=(db:DatabaseSync,table:string)=>db.prepare(`SELECT * FROM ${table}`).all() as Record<string,unknown>[];

async function replacePostgres(sqlite:DatabaseSync,postgres:Database,selected=insertOrder){
  selected=includeReferencedTables(selected);
  const counts:Record<string,number>={};
  await postgres.transaction(async tx=>{
    for(const table of deleteOrder.filter(table=>selected.includes(table)))await tx.run(`DELETE FROM ${table}`);
    for(const table of insertOrder.filter(table=>selected.includes(table))){const columns=tables[table];const rows=sqliteRows(sqlite,table);counts[table]=rows.length;for(const row of rows)await tx.run(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders(columns.length)})`,columns.map(column=>row[column]??null))}
  });
  return counts;
}

async function replaceSqlite(sqlite:DatabaseSync,postgres:Database){
  const counts:Record<string,number>={};
  sqlite.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
  try{
    for(const table of deleteOrder)sqlite.prepare(`DELETE FROM ${table}`).run();
    for(const table of insertOrder){const columns=tables[table];const rows=await postgres.all<Record<string,unknown>>(`SELECT ${columns.join(',')} FROM ${table}`);counts[table]=rows.length;const statement=sqlite.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders(columns.length)})`);for(const row of rows)statement.run(...columns.map(column=>row[column]??null) as any[])}
    sqlite.exec('COMMIT; PRAGMA foreign_keys=ON');
  }catch(error){sqlite.exec('ROLLBACK; PRAGMA foreign_keys=ON');throw error}
  return counts;
}

export async function initPostgresPersistence(sqlite:DatabaseSync,dataDir:string){
  if(!process.env.DATABASE_URL)return null;
  const postgres=await createDatabase(dataDir);await runMigrations(postgres);
  const databasePath=path.join(dataDir,'no-wait-salon.db');const backupDir=path.join(dataDir,'backups');mkdirSync(backupDir,{recursive:true});
  const backupPath=path.join(backupDir,`pre-postgres-${Date.now()}.sqlite`);if(existsSync(databasePath))copyFileSync(databasePath,backupPath);
  const persisted=Number((await postgres.get<{count:number}>('SELECT COUNT(*) count FROM salon'))?.count||0);
  const initialCounts=persisted?await replaceSqlite(sqlite,postgres):await replacePostgres(sqlite,postgres);
  let pending=Promise.resolve(initialCounts);let timer:ReturnType<typeof setTimeout>|undefined;
  const flushNow=(selected?:string[])=>{pending=pending.then(()=>replacePostgres(sqlite,postgres,selected));return pending};
  const scheduleFlush=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void flushNow().catch(error=>console.error('PostgreSQL persistence failed',error)),50)};
  const close=async()=>{if(timer)clearTimeout(timer);await flushNow();await postgres.close()};
  return{backupPath,initialCounts,source:persisted?'postgres':'sqlite',scheduleFlush,flushNow,close};
}
