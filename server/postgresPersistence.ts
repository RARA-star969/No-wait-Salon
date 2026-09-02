import {copyFileSync,existsSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import {SALONS} from '../src/data/mockData.ts';
import {createDatabase,type Database} from './database.ts';
import {runMigrations} from './migrations.ts';

const tables:Record<string,string[]>={
  gym_state:['gym_id','state_json','updated_at'],
  main_category:['id','name','icon_name','label','description','display_order','active','is_default','theme_key','primary_color','accent_color','banner_image_url','banner_headline','banner_subheadline','banner_cta_text','created_at','updated_at'],
  salon:['id','name','address','latitude','longitude','rating','review_count','is_open','opening_hours','services_json','barbers_json','onboarded','created_at','category','phone_number','description','cover_image_url','logo_image_url','amenities_json','offers_json','gallery_json','brand_key','short_description','email','website_url','area','city','state','pin_code','promotional_banner_url','platform_status','main_category_id','updated_at','business_code','profile_completed_at','quick_actions_json','social_links_json'],
  salon_hours:['salon_id','day_of_week','open_time','close_time','closed'],
  salon_service:['id','salon_id','name','category','price_inr','duration_min','description','image_url','active','sort_order','created_at','updated_at'],
  salon_staff:['id','salon_id','name','photo_url','role','service_ids_json','working_status','active','sort_order','created_at','updated_at'],
  salon_offer:['id','salon_id','title','discount_text','description','minimum_bill','start_date','end_date','terms','image_url','active','sort_order','created_at','updated_at'],
  salon_media:['id','salon_id','media_type','url','caption','featured','sort_order','created_at','updated_at'],
  otp_challenge:['id','phone','code_hash','expires_at','attempts','verified_at'],
  customer_account:['id','phone_number','created_at','updated_at'],
  customer_profile:['customer_id','name','email','date_of_birth','gender','anniversary','city','profile_photo_url','marketing_consent','created_at','updated_at'],
  customer_session:['token_hash','customer_id','expires_at','created_at'],
  customer_booking:['id','queue_entry_id','customer_id','salon_id','service','status','reserved_for','source','created_at','updated_at','outcome','first_called_at','call_attempts','acknowledged_at','grace_expires_at','no_show_at','service_started_at','service_completed_at','cancelled_by','cancel_reason_code','cancel_reason_text','cancelled_at','services_json','total_price_inr'],
  admin_user:['id','email','password_hash','created_at','updated_at'],
  admin_session:['token_hash','admin_id','expires_at','created_at'],
  staff_account:['id','business_id','email','password_hash','name','role','active','created_at','updated_at'],
  staff_session:['token_hash','staff_id','business_id','expires_at','created_at'],
  salon_state:['salon_id','version','state_json','updated_at'],
  business_qr:['id','business_id','business_type','public_token','status','version','created_at','updated_at','revoked_at'],
  web_qr_attribution:['id','business_id','qr_token_id','customer_id','acquisition_source','first_visit_at','joined_at','app_cta_shown','app_cta_clicked','created_at','updated_at'],
  business_profile_moderation:['business_id','hold','held_by','held_at','updated_at'],
  business_profile_draft:['business_id','draft_json','submitted_by','submitted_at'],
  business_review:['id','business_id','customer_id','reviewer_name','rating','review_text','original_review_text','feedback_tags_json','source','verified_visit','status','owner_reply_text','owner_reply_at','edited_by_admin_id','edited_at','created_at','updated_at'],
  customer_workout_plan:['customer_id','business_id','plan_json','created_at','updated_at'],
  customer_notification:['id','customer_id','type','category','priority','title','body','source_kind','source_business_id','source_name','deep_link_json','dedupe_key','actor_kind','actor_id','read_at','created_at'],
  customer_notification_preference:['customer_id','promotional_enabled','business_updates_enabled','quiet_hours_start','quiet_hours_end','updated_at'],
  customer_push_device:['id','customer_id','platform','token','created_at','updated_at','last_seen_at'],
  carousel_banner:['id','type','enabled','display_order','title','subtitle','image_url','cta_label','cta_link','youtube_url','created_at','updated_at'],
};
const insertOrder=Object.keys(tables);
const deleteOrder=[...insertOrder].reverse();

function includeReferencedTables(selected:string[]){
  const expanded=new Set(selected);
  if(expanded.has('customer_account'))['customer_profile','customer_session','customer_booking','customer_notification','customer_notification_preference','customer_push_device'].forEach(table=>expanded.add(table));
  if(expanded.has('admin_user'))expanded.add('admin_session');
  return insertOrder.filter(table=>expanded.has(table));
}

const placeholders=(count:number)=>Array.from({length:count},()=>'?').join(',');
const sqliteRows=(db:DatabaseSync,table:string)=>db.prepare(`SELECT * FROM ${table}`).all() as Record<string,unknown>[];

const conflictKeys:Record<string,string[]>={
  main_category:['id'],salon:['id'],salon_hours:['salon_id','day_of_week'],salon_service:['id'],salon_staff:['id'],salon_offer:['id'],salon_media:['id'],
  otp_challenge:['id'],customer_account:['id'],customer_profile:['customer_id'],customer_session:['token_hash'],customer_booking:['id'],
  admin_user:['id'],admin_session:['token_hash'],staff_account:['id'],staff_session:['token_hash'],salon_state:['salon_id'],business_qr:['id'],web_qr_attribution:['id'],
  business_profile_moderation:['business_id'],business_profile_draft:['business_id'],business_review:['id'],
  customer_workout_plan:['customer_id','business_id'],
  customer_notification:['id'],customer_notification_preference:['customer_id'],customer_push_device:['id'],
  carousel_banner:['id'],
};

async function replacePostgres(sqlite:DatabaseSync,postgres:Database,selected=insertOrder){
  selected=includeReferencedTables(selected);
  const counts:Record<string,number>={};
  const isFullReplace=selected.length===insertOrder.length;
  await postgres.transaction(async tx=>{
    if(isFullReplace){
      for(const table of deleteOrder)await tx.run(`DELETE FROM ${table}`);
    }else if(selected.includes('staff_session')){
      await tx.run('DELETE FROM staff_session');
    }
    for(const table of insertOrder.filter(table=>selected.includes(table))){
      const columns=tables[table];const rows=sqliteRows(sqlite,table);counts[table]=rows.length;
      const keys=conflictKeys[table];
      const mutable=columns.filter(column=>!keys.includes(column));
      const conflict=isFullReplace?'':` ON CONFLICT (${keys.join(',')}) DO UPDATE SET ${mutable.map(column=>`${column}=EXCLUDED.${column}`).join(',')}`;
      for(const row of rows)await tx.run(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders(columns.length)})${conflict}`,columns.map(column=>row[column]??null));
    }
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

type SeedBackfill={salon:Record<string,unknown>;services:Record<string,unknown>[];hours:Record<string,unknown>[]};

function buildMissingSeedBackfills(sqlite:DatabaseSync):SeedBackfill[]{
  const now=Date.now();
  const result:SeedBackfill[]=[];
  const insertSalon=sqlite.prepare(`INSERT OR IGNORE INTO salon (${tables.salon.join(',')}) VALUES (${placeholders(tables.salon.length)})`);
  const insertService=sqlite.prepare(`INSERT OR IGNORE INTO salon_service (${tables.salon_service.join(',')}) VALUES (${placeholders(tables.salon_service.length)})`);
  const insertHours=sqlite.prepare(`INSERT OR IGNORE INTO salon_hours (${tables.salon_hours.join(',')}) VALUES (${placeholders(tables.salon_hours.length)})`);
  for(const source of SALONS as any[]){
    if(sqlite.prepare('SELECT 1 ok FROM salon WHERE id = ?').get(source.id))continue;
    const salon:Record<string,unknown>={
      id:source.id,name:source.name,address:source.address,latitude:source.latitude,longitude:source.longitude,rating:source.rating,
      review_count:source.reviewCount,is_open:source.isOpen?1:0,opening_hours:source.openingHours,services_json:JSON.stringify(source.services||[]),
      barbers_json:'[]',onboarded:1,created_at:now,category:source.category||'',phone_number:source.phoneNumber||'',description:source.description||'',
      cover_image_url:source.coverImageUrl||'',logo_image_url:source.logoImageUrl||'',amenities_json:JSON.stringify(source.amenities||[]),offers_json:JSON.stringify(source.offers||[]),
      gallery_json:JSON.stringify(source.gallery||[]),brand_key:source.brandKey||'',short_description:source.shortDescription||'',email:source.email||'',website_url:source.websiteUrl||'',
      area:source.area||'',city:source.city||'',state:source.state||'',pin_code:source.pinCode||'',promotional_banner_url:source.promotionalBannerUrl||'',platform_status:'active',
      main_category_id:source.mainCategoryId||'salon',updated_at:now,quick_actions_json:'[]',social_links_json:'[]',
    };
    insertSalon.run(...tables.salon.map(column=>salon[column]??null) as any[]);
    const services=(source.services||[]).map((service:any,index:number)=>({
      id:`${source.id}-${service.id}`,salon_id:source.id,name:service.name,category:'',price_inr:service.priceInr,duration_min:service.durationMin,
      description:service.description||'',image_url:service.icon||'',active:1,sort_order:index,created_at:now,updated_at:now,
    }));
    for(const row of services)insertService.run(...tables.salon_service.map(column=>row[column as keyof typeof row]??null) as any[]);
    const hours=Array.from({length:7},(_,day)=>({salon_id:source.id,day_of_week:day,open_time:'09:00',close_time:'21:00',closed:0}));
    for(const row of hours)insertHours.run(...tables.salon_hours.map(column=>row[column as keyof typeof row]??null) as any[]);
    result.push({salon,services,hours});
  }
  return result;
}

async function persistMissingSeedBackfills(postgres:Database,backfills:SeedBackfill[]){
  if(!backfills.length)return;
  await postgres.transaction(async tx=>{
    for(const backfill of backfills){
      await tx.run(`INSERT INTO salon (${tables.salon.join(',')}) VALUES (${placeholders(tables.salon.length)}) ON CONFLICT(id) DO NOTHING`,tables.salon.map(column=>backfill.salon[column]??null));
      for(const row of backfill.services)await tx.run(`INSERT INTO salon_service (${tables.salon_service.join(',')}) VALUES (${placeholders(tables.salon_service.length)}) ON CONFLICT(id) DO NOTHING`,tables.salon_service.map(column=>row[column]??null));
      for(const row of backfill.hours)await tx.run(`INSERT INTO salon_hours (${tables.salon_hours.join(',')}) VALUES (${placeholders(tables.salon_hours.length)}) ON CONFLICT(salon_id,day_of_week) DO NOTHING`,tables.salon_hours.map(column=>row[column]??null));
    }
  });
}

export async function initPostgresPersistence(sqlite:DatabaseSync,dataDir:string){
  if(!process.env.DATABASE_URL)return null;
  const postgres=await createDatabase(dataDir);await runMigrations(postgres);
  // Backfill only Gym rows absent from PostgreSQL before hydration. Never erase
  // existing local Gym operations when upgrading an already populated test DB.
  for (const row of sqliteRows(sqlite, 'gym_state')) {
    await postgres.run('INSERT INTO gym_state (gym_id,state_json,updated_at) VALUES (?,?,?) ON CONFLICT(gym_id) DO NOTHING', [row.gym_id, row.state_json, row.updated_at]);
  }
  const databasePath=path.join(dataDir,'no-wait-salon.db');const backupDir=path.join(dataDir,'backups');mkdirSync(backupDir,{recursive:true});
  const backupPath=path.join(backupDir,`pre-postgres-${Date.now()}.sqlite`);if(existsSync(databasePath))copyFileSync(databasePath,backupPath);
  const persisted=Number((await postgres.get<{count:number}>('SELECT COUNT(*) count FROM salon'))?.count||0);
  const initialCounts=persisted?await replaceSqlite(sqlite,postgres):await replacePostgres(sqlite,postgres);
  if(persisted){const missingSeedBackfills=buildMissingSeedBackfills(sqlite);await persistMissingSeedBackfills(postgres,missingSeedBackfills)}
  let pending=Promise.resolve(initialCounts);let timer:ReturnType<typeof setTimeout>|undefined;
  const flushNow=(selected?:string[])=>{pending=pending.then(()=>replacePostgres(sqlite,postgres,selected));return pending};

  const insertMissingSalons = async (salons: any[]) => {
    pending = pending.then(async () => {
      await postgres.transaction(async tx => {
        const columns = tables['salon'];
        for (const salon of salons) {
          const placeholdersStr = placeholders(columns.length);
          await tx.run(
            `INSERT INTO salon (${columns.join(',')}) VALUES (${placeholdersStr}) ON CONFLICT(id) DO NOTHING`,
            columns.map(column => salon[column] ?? null)
          );
        }
      });
      return {};
    });
    return pending;
  };

  const scheduleFlush=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void flushNow().catch(error=>console.error('PostgreSQL persistence failed',error)),50)};
  const close=async()=>{if(timer)clearTimeout(timer);await flushNow();await postgres.close()};
  return{backupPath,initialCounts,source:persisted?'postgres':'sqlite',scheduleFlush,flushNow,insertMissingSalons,close};
}
