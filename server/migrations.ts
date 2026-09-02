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
      category TEXT NOT NULL DEFAULT '',main_category_id TEXT NOT NULL DEFAULT 'salon',phone_number TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',cover_image_url TEXT NOT NULL DEFAULT '',
      logo_image_url TEXT NOT NULL DEFAULT '',amenities_json TEXT NOT NULL DEFAULT '[]',offers_json TEXT NOT NULL DEFAULT '[]',
      gallery_json TEXT NOT NULL DEFAULT '[]',brand_key TEXT NOT NULL DEFAULT '',short_description TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',website_url TEXT NOT NULL DEFAULT '',area TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',state TEXT NOT NULL DEFAULT '',pin_code TEXT NOT NULL DEFAULT '',
      promotional_banner_url TEXT NOT NULL DEFAULT '',platform_status TEXT NOT NULL DEFAULT 'active',updated_at BIGINT NOT NULL DEFAULT 0
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
},{
  version:3,
  name:'public_qr_web_join',
  sql:`
    ALTER TABLE customer_profile ADD COLUMN IF NOT EXISTS marketing_consent INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS web_qr_attribution (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      qr_token_id TEXT NOT NULL,
      customer_id TEXT,
      acquisition_source TEXT NOT NULL DEFAULT 'salon_qr_web',
      first_visit_at BIGINT NOT NULL,
      joined_at BIGINT,
      app_cta_shown INTEGER NOT NULL DEFAULT 0,
      app_cta_clicked INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS web_qr_attribution_business_idx ON web_qr_attribution(business_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS web_qr_attribution_customer_idx ON web_qr_attribution(customer_id);
  `
},{
  version:4,
  name:'call_grace_period_outcomes',
  sql:`
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS outcome TEXT;
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS first_called_at BIGINT;
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS call_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS acknowledged_at BIGINT;
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS grace_expires_at BIGINT;
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS no_show_at BIGINT;
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS service_started_at BIGINT;
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS service_completed_at BIGINT;
    CREATE INDEX IF NOT EXISTS customer_booking_outcome_idx ON customer_booking(outcome,updated_at DESC);
  `
},{
  version:5,
  name:'structured_cancellations',
  sql:`
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS cancel_reason_code TEXT;
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS cancel_reason_text TEXT;
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS cancelled_at BIGINT;
  `
},{
  version:6,
  name:'multi_service_bookings',
  sql:`
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS services_json TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS total_price_inr INTEGER;
  `
},{
  version:7,
  name:'add_main_category_id_to_salon',
  sql:`
    ALTER TABLE salon ADD COLUMN IF NOT EXISTS main_category_id TEXT NOT NULL DEFAULT 'salon';
  `
},{
  version:8,
  name:'fix_seed_categories',
  sql:`
    UPDATE salon SET main_category_id = 'salon' WHERE id IN ('salon-1', 'salon-2');
    UPDATE salon SET main_category_id = 'gym' WHERE id = 'gym-1';
    UPDATE salon SET main_category_id = 'shop' WHERE id = 'shop-1';
    UPDATE salon SET main_category_id = 'moto' WHERE id = 'moto-1';
    UPDATE salon SET main_category_id = 'pets' WHERE id = 'pets-1';
    UPDATE salon SET main_category_id = 'mall' WHERE id = 'mall-1';
    UPDATE salon SET main_category_id = 'food' WHERE id = 'food-1';
  `
},{
  version:9,
  name:'persist_main_categories',
  sql:`
    CREATE TABLE IF NOT EXISTS main_category (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon_name TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      theme_key TEXT NOT NULL DEFAULT 'salon',
      primary_color TEXT NOT NULL DEFAULT '#0F766E',
      accent_color TEXT NOT NULL DEFAULT '#2DD4BF',
      banner_image_url TEXT NOT NULL DEFAULT '',
      banner_headline TEXT NOT NULL DEFAULT '',
      banner_subheadline TEXT NOT NULL DEFAULT '',
      banner_cta_text TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
    INSERT INTO main_category (id,name,icon_name,label,description,display_order,active,is_default,theme_key,primary_color,accent_color,banner_image_url,banner_headline,banner_subheadline,banner_cta_text,created_at,updated_at) VALUES
      ('salon','Salon','Scissors','Live Salons','Salons, barbershops & styling studios',1,1,1,'salon','#0F766E','#2DD4BF','','Better grooming, less waiting.','Discover trusted salons and reserve your chair before leaving home.','Explore Chairs',0,0),
      ('gym','Gym','Dumbbell','Fitness & Gym','Gyms, fitness centers & personal trainers',2,1,0,'gym','#D97706','#F59E0B','','Power your fitness goals today.','Onboarded elite gyms, day passes & personal coaching sessions.','View Fitness Gyms',0,0),
      ('shop','Shop','ShoppingBag','Stores & Shops','Retail stores, boutiques & shopping outlets',3,1,0,'shop','#7C3AED','#8B5CF6','','Bespoke tailoring & retail atelier.','Curated luxury fashion, express alterations & styling sessions.','Discover Shops',0,0),
      ('moto','Moto','Car','Auto & Services','Automobile care, detailing & service stations',4,1,0,'moto','#DC2626','#EF4444','','Precision automobile detailing spa.','High-shine ceramic wax, foam wash & upholstery steam sanitize.','Book Auto Care',0,0),
      ('pets','Pets','Dog','Pet Care & Spa','Pet grooming, vet clinics & pet centers',5,1,0,'pets','#059669','#10B981','','Gentle organic pet spa & bath.','Stress-free pet grooming with botanical shampoos & pampering.','Explore Pet Care',0,0),
      ('mall','Mall','Building2','Shopping Malls','Shopping malls, plazas & commercial centers',6,1,0,'mall','#2563EB','#3B82F6','','Central lifestyle shopping hub.','International brand outlets, multiplex cinema & VIP valet lounge.','View Malls',0,0),
      ('food','Food','Utensils','Food & Dining','Restaurants, cafes, bakeries & dining spots',7,1,0,'food','#EA580C','#F97316','','Artisanal cafe & gourmet bistro.','Farm-to-table European deli classics, specialty coffee & tasting menus.','Explore Dining',0,0)
    ON CONFLICT(id) DO NOTHING;
  `
}, {
  version: 10,
  name: 'business_code_and_profile_completion',
  sql: `
    ALTER TABLE salon ADD COLUMN business_code TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS salon_business_code_idx ON salon(business_code);
    ALTER TABLE salon ADD COLUMN profile_completed_at BIGINT;
  `
}, {
  version: 11,
  name: 'staff_business_auth',
  sql: `
    CREATE TABLE IF NOT EXISTS staff_account (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL REFERENCES salon(id),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      active INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS staff_session (
      token_hash TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL REFERENCES staff_account(id),
      business_id TEXT NOT NULL REFERENCES salon(id),
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS staff_account_business_idx ON staff_account(business_id,role);
    CREATE INDEX IF NOT EXISTS staff_session_business_idx ON staff_session(business_id,expires_at);
  `
}, {
  version: 12,
  name: 'category_banner_carousel_and_salon_audience',
  sql: `
    ALTER TABLE main_category ADD COLUMN IF NOT EXISTS banner_carousel_json TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE salon ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'unisex';
  `
}];

export async function runMigrations(db:Database){
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migration (version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at BIGINT NOT NULL)');
  for(const migration of migrations){const existing=await db.get('SELECT version FROM schema_migration WHERE version = ?',[migration.version]);if(existing)continue;await db.transaction(async tx=>{await tx.exec(migration.sql);await tx.run('INSERT INTO schema_migration (version,name,applied_at) VALUES (?,?,?)',[migration.version,migration.name,Date.now()])})}
}
