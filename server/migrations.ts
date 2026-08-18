import type {Database} from './database.ts';

const migrations=[{
  version:1,
  name:'initial_platform_schema',
  sql:`
    CREATE TABLE IF NOT EXISTS salon_state (salon_id TEXT PRIMARY KEY,version INTEGER NOT NULL,state_json TEXT NOT NULL,updated_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS salon (
      id TEXT PRIMARY KEY,name TEXT NOT NULL,address TEXT NOT NULL,latitude DOUBLE PRECISION NOT NULL,longitude DOUBLE PRECISION NOT NULL,
      rating DOUBLE PRECISION NOT NULL,review_count INTEGER NOT NULL,is_open INTEGER NOT NULL DEFAULT 1,opening_hours TEXT NOT NULL,
      services_json TEXT NOT NULL,barbers_json TEXT NOT NULL,onboarded INTEGER NOT NULL DEFAULT 1,created_at BIGINT NOT NULL,
      category TEXT NOT NULL DEFAULT '',phone_number TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',cover_image_url TEXT NOT NULL DEFAULT '',
      logo_image_url TEXT NOT NULL DEFAULT '',amenities_json TEXT NOT NULL DEFAULT '[]',offers_json TEXT NOT NULL DEFAULT '[]',gallery_json TEXT NOT NULL DEFAULT '[]',
      brand_key TEXT NOT NULL DEFAULT '',short_description TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',website_url TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',city TEXT NOT NULL DEFAULT '',state TEXT NOT NULL DEFAULT '',pin_code TEXT NOT NULL DEFAULT '',promotional_banner_url TEXT NOT NULL DEFAULT '',
      platform_status TEXT NOT NULL DEFAULT 'active',updated_at BIGINT NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS salon_hours (salon_id TEXT NOT NULL REFERENCES salon(id),day_of_week INTEGER NOT NULL,open_time TEXT NOT NULL DEFAULT '09:00',close_time TEXT NOT NULL DEFAULT '21:00',closed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(salon_id,day_of_week));
    CREATE TABLE IF NOT EXISTS salon_service (id TEXT PRIMARY KEY,salon_id TEXT NOT NULL REFERENCES salon(id),name TEXT NOT NULL,category TEXT NOT NULL DEFAULT '',price_inr INTEGER NOT NULL,duration_min INTEGER NOT NULL,description TEXT NOT NULL DEFAULT '',image_url TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS salon_staff (id TEXT PRIMARY KEY,salon_id TEXT NOT NULL REFERENCES salon(id),name TEXT NOT NULL,photo_url TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT 'Barber',service_ids_json TEXT NOT NULL DEFAULT '[]',working_status TEXT NOT NULL DEFAULT 'available',active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS salon_offer (id TEXT PRIMARY KEY,salon_id TEXT NOT NULL REFERENCES salon(id),title TEXT NOT NULL,discount_text TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',minimum_bill INTEGER NOT NULL DEFAULT 0,start_date TEXT NOT NULL DEFAULT '',end_date TEXT NOT NULL DEFAULT '',terms TEXT NOT NULL DEFAULT '',image_url TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS salon_media (id TEXT PRIMARY KEY,salon_id TEXT NOT NULL REFERENCES salon(id),media_type TEXT NOT NULL DEFAULT 'gallery',url TEXT NOT NULL,caption TEXT NOT NULL DEFAULT '',featured INTEGER NOT NULL DEFAULT 0,sort_order INTEGER NOT NULL DEFAULT 0,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS otp_challenge (id TEXT PRIMARY KEY,phone TEXT NOT NULL,code_hash TEXT NOT NULL,expires_at BIGINT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,verified_at BIGINT);
    CREATE TABLE IF NOT EXISTS customer_account (id TEXT PRIMARY KEY,phone_number TEXT NOT NULL UNIQUE,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS customer_profile (customer_id TEXT PRIMARY KEY REFERENCES customer_account(id),name TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',date_of_birth TEXT NOT NULL DEFAULT '',gender TEXT NOT NULL DEFAULT '',anniversary TEXT NOT NULL DEFAULT '',city TEXT NOT NULL DEFAULT '',profile_photo_url TEXT NOT NULL DEFAULT '',created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS customer_session (token_hash TEXT PRIMARY KEY,customer_id TEXT NOT NULL REFERENCES customer_account(id),expires_at BIGINT NOT NULL,created_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS customer_booking (id TEXT PRIMARY KEY,queue_entry_id TEXT NOT NULL UNIQUE,customer_id TEXT NOT NULL REFERENCES customer_account(id),salon_id TEXT NOT NULL,service TEXT NOT NULL,status TEXT NOT NULL,reserved_for TEXT,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_user (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_session (token_hash TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES admin_user(id),expires_at BIGINT NOT NULL,created_at BIGINT NOT NULL);
    CREATE INDEX IF NOT EXISTS salon_service_salon_idx ON salon_service(salon_id,sort_order);
    CREATE INDEX IF NOT EXISTS salon_staff_salon_idx ON salon_staff(salon_id,sort_order);
    CREATE INDEX IF NOT EXISTS salon_offer_salon_idx ON salon_offer(salon_id,sort_order);
    CREATE INDEX IF NOT EXISTS salon_media_salon_idx ON salon_media(salon_id,sort_order);
    CREATE INDEX IF NOT EXISTS salon_location_idx ON salon(latitude,longitude);
    CREATE INDEX IF NOT EXISTS salon_status_idx ON salon(platform_status,onboarded);
    CREATE INDEX IF NOT EXISTS customer_booking_customer_idx ON customer_booking(customer_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS customer_booking_salon_idx ON customer_booking(salon_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS customer_booking_status_idx ON customer_booking(status,updated_at DESC);
  `
},{
  version:2,
  name:'universal_business_qr',
  sql:`
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'customer_app';
    CREATE TABLE IF NOT EXISTS business_qr (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      business_type TEXT NOT NULL,
      public_token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      version INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      revoked_at BIGINT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS business_qr_active_business_idx ON business_qr(business_id,business_type) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS business_qr_token_status_idx ON business_qr(public_token,status);
  `
}];

export async function runMigrations(db:Database){
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migration (version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at BIGINT NOT NULL)');
  for(const migration of migrations){const existing=await db.get('SELECT version FROM schema_migration WHERE version = ?',[migration.version]);if(existing)continue;await db.transaction(async tx=>{await tx.exec(migration.sql);await tx.run('INSERT INTO schema_migration (version,name,applied_at) VALUES (?,?,?)',[migration.version,migration.name,Date.now()])})}
}
