const fs = require('node:fs');

function replaceOnce(path, before, after, label) {
  const text = fs.readFileSync(path, 'utf8');
  if (text.includes(after)) return false;
  if (!text.includes(before)) throw new Error(`Patch anchor not found: ${label}`);
  fs.writeFileSync(path, text.replace(before, after));
  return true;
}

const changed = [];
const mark = (path, didChange) => { if (didChange) changed.push(path); };

mark('src/components/AdminApp.tsx', replaceOnce(
  'src/components/AdminApp.tsx',
  `const emptySalon = () => ({\n  name: '',\n  short_description: '',\n  description: '',\n  category: '',`,
  `const emptySalon = () => ({\n  name: '',\n  short_description: '',\n  description: '',\n  category: '',\n  main_category_id: 'salon',`,
  'Admin new business explicit category',
));

mark('src/components/AdminApp.tsx', replaceOnce(
  'src/components/AdminApp.tsx',
  `              <select\n                value={form.main_category_id || 'salon'}\n                onChange={(e) => set('main_category_id', e.target.value)}\n                className=\"h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600\"\n              >`,
  `              <select\n                value={form.main_category_id || 'salon'}\n                onChange={(e) => set('main_category_id', e.target.value)}\n                required\n                className=\"h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600\"\n              >`,
  'Admin category selector required',
));

mark('server/index.ts', replaceOnce(
  'server/index.ts',
  `app.post('/api/admin/salons', requireAdmin, async (request, response) => {\n  try {`,
  `function resolveAdminMainCategoryId(body: Record<string, unknown>, fallback?: string) {\n  const candidate = cleanText(body.main_category_id || body.mainCategoryId, 50) || cleanText(fallback, 50);\n  if (!candidate) throw new Error('Main category is required.');\n  const category = db.prepare('SELECT id FROM main_category WHERE id = ?').get(candidate) as { id: string } | undefined;\n  if (!category) throw new Error('Select a valid main category.');\n  return category.id;\n}\n\napp.post('/api/admin/salons', requireAdmin, async (request, response) => {\n  try {`,
  'Backend category resolver',
));

mark('server/index.ts', replaceOnce(
  'server/index.ts',
  `    const mainCategoryId = cleanText(body.main_category_id || body.mainCategoryId, 50) || 'salon';`,
  `    const mainCategoryId = resolveAdminMainCategoryId(body);`,
  'Create listing validates category',
));

mark('server/index.ts', replaceOnce(
  'server/index.ts',
  `    const mainCategoryId = cleanText(body.main_category_id || body.mainCategoryId, 50) || 'salon';\n    db.exec('BEGIN IMMEDIATE');\n    db.prepare(\`UPDATE salon SET`,
  `    const mainCategoryId = resolveAdminMainCategoryId(body, String(existing.main_category_id || existing.mainCategoryId || 'salon'));\n    db.exec('BEGIN IMMEDIATE');\n    db.prepare(\`UPDATE salon SET`,
  'Update listing preserves/validates category',
));

mark('server/postgresPersistence.ts', replaceOnce(
  'server/postgresPersistence.ts',
  `const tables:Record<string,string[]>={\n  salon:['id','name','address','latitude','longitude','rating','review_count','is_open','opening_hours','services_json','barbers_json','onboarded','created_at','category','phone_number','description','cover_image_url','logo_image_url','amenities_json','offers_json','gallery_json','brand_key','short_description','email','website_url','area','city','state','pin_code','promotional_banner_url','platform_status','main_category_id','updated_at'],`,
  `const tables:Record<string,string[]>={\n  main_category:['id','name','icon_name','label','description','display_order','active','is_default','theme_key','primary_color','accent_color','banner_image_url','banner_headline','banner_subheadline','banner_cta_text','created_at','updated_at'],\n  salon:['id','name','address','latitude','longitude','rating','review_count','is_open','opening_hours','services_json','barbers_json','onboarded','created_at','category','phone_number','description','cover_image_url','logo_image_url','amenities_json','offers_json','gallery_json','brand_key','short_description','email','website_url','area','city','state','pin_code','promotional_banner_url','platform_status','main_category_id','updated_at'],`,
  'Persist main categories',
));

mark('server/migrations.ts', replaceOnce(
  'server/migrations.ts',
  `},{\n  version:6,\n  name:'multi_service_bookings',\n  sql:\`\n    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS services_json TEXT NOT NULL DEFAULT '[]';\n    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS total_price_inr INTEGER;\n  \`\n}];`,
  `},{\n  version:6,\n  name:'multi_service_bookings',\n  sql:\`\n    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS services_json TEXT NOT NULL DEFAULT '[]';\n    ALTER TABLE customer_booking ADD COLUMN IF NOT EXISTS total_price_inr INTEGER;\n  \`\n},{\n  version:7,\n  name:'business_main_category_assignment',\n  sql:\`\n    ALTER TABLE salon ADD COLUMN IF NOT EXISTS main_category_id TEXT NOT NULL DEFAULT 'salon';\n    CREATE TABLE IF NOT EXISTS main_category (\n      id TEXT PRIMARY KEY, name TEXT NOT NULL, icon_name TEXT NOT NULL, label TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',\n      display_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, is_default INTEGER NOT NULL DEFAULT 0,\n      theme_key TEXT NOT NULL DEFAULT 'salon', primary_color TEXT NOT NULL DEFAULT '#0F766E', accent_color TEXT NOT NULL DEFAULT '#2DD4BF',\n      banner_image_url TEXT NOT NULL DEFAULT '', banner_headline TEXT NOT NULL DEFAULT '', banner_subheadline TEXT NOT NULL DEFAULT '', banner_cta_text TEXT NOT NULL DEFAULT '',\n      created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL\n    );\n    INSERT INTO main_category (id,name,icon_name,label,description,display_order,active,is_default,theme_key,primary_color,accent_color,banner_image_url,banner_headline,banner_subheadline,banner_cta_text,created_at,updated_at) VALUES\n      ('salon','Salon','Scissors','Live Salons','Salons, barbershops & styling studios',1,1,1,'salon','#0F766E','#2DD4BF','','Better grooming, less waiting.','Discover trusted salons and reserve your chair before leaving home.','Explore Chairs',0,0),\n      ('gym','Gym','Dumbbell','Fitness & Gym','Gyms, fitness centers & personal trainers',2,1,0,'gym','#D97706','#F59E0B','','Power your fitness goals today.','Onboarded elite gyms, day passes & personal coaching sessions.','View Fitness Gyms',0,0),\n      ('shop','Shop','ShoppingBag','Stores & Shops','Retail stores, boutiques & shopping outlets',3,1,0,'shop','#7C3AED','#8B5CF6','','Bespoke tailoring & retail atelier.','Curated luxury fashion, express alterations & styling sessions.','Discover Shops',0,0),\n      ('moto','Moto','Car','Auto & Services','Automobile care, detailing & service stations',4,1,0,'moto','#DC2626','#EF4444','','Precision automobile detailing spa.','High-shine ceramic wax, foam wash & upholstery steam sanitize.','Book Auto Care',0,0),\n      ('pets','Pets','Dog','Pet Care & Spa','Pet grooming, vet clinics & pet centers',5,1,0,'pets','#059669','#10B981','','Gentle organic pet spa & bath.','Stress-free pet grooming with botanical shampoos & pampering.','Explore Pet Care',0,0),\n      ('mall','Mall','Building2','Shopping Malls','Shopping malls, plazas & commercial centers',6,1,0,'mall','#2563EB','#3B82F6','','Central lifestyle shopping hub.','International brand outlets, multiplex cinema & VIP valet lounge.','View Malls',0,0),\n      ('food','Food','Utensils','Food & Dining','Restaurants, cafes, bakeries & dining spots',7,1,0,'food','#EA580C','#F97316','','Artisanal cafe & gourmet bistro.','Farm-to-table European deli classics, specialty coffee & tasting menus.','Explore Dining',0,0)\n    ON CONFLICT (id) DO NOTHING;\n  \`\n}];`,
  'Postgres category assignment migration',
));

console.log(JSON.stringify({ changed }, null, 2));
