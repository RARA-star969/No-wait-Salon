import React, {useEffect, useMemo, useState} from 'react';
import {Building2, Users, CalendarCheck, Activity, LogOut, LayoutDashboard, Search, Plus, Pencil, Power, Save, X, ChevronLeft, Trash2, ImagePlus, Scissors, Tag, Clock3, Menu, QrCode, Download, Printer, Copy, RefreshCw, Layers} from 'lucide-react';

const API=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
const TOKEN_KEY='no_wait_admin_token';
const SESSION_EXPIRED_EVENT='no-wait-admin-session-expired';
type AnyRow=Record<string,any>;
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const api=async(path:string,init:RequestInit={})=>{const token=localStorage.getItem(TOKEN_KEY);const r=await fetch(`${API}${path}`,{...init,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...init.headers}});const b=await r.json().catch(()=>({}));if(r.status===401&&token){localStorage.removeItem(TOKEN_KEY);window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));}if(!r.ok)throw new Error(b.error||'Request failed.');return b;};
const emptySalon=()=>({name:'',short_description:'',description:'',category:'',phone_number:'',email:'',website_url:'',address:'',area:'',city:'',state:'',pin_code:'',latitude:12.9716,longitude:77.5946,isOpen:true,opening_hours:'9:00 AM–9:00 PM',logo_image_url:'',cover_image_url:'',promotional_banner_url:'',amenities:[],status:'draft',hours:days.map((_,i)=>({day_of_week:i,open_time:'09:00',close_time:'21:00',closed:0})),services:[],staff:[],offers:[],media:[]});

function Field({label,value,onChange,type='text',required=false,placeholder=''}:{label:string;value:any;onChange:(v:any)=>void;type?:string;required?:boolean;placeholder?:string}){return <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>{label}{required&&<b className="text-red-500"> *</b>}</span><input type={type} value={value??''} placeholder={placeholder} onChange={e=>onChange(type==='number'?Number(e.target.value):e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"/></label>}
function Toggle({checked,onChange,label}:{checked:boolean;onChange:(v:boolean)=>void;label:string}){return <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><button type="button" onClick={()=>onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked?'bg-teal-600':'bg-slate-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked?'left-6':'left-1'}`}/></button>{label}</label>}
function Section({title,subtitle,children}:{title:string;subtitle?:string;children:React.ReactNode}){return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5"><h3 className="text-lg font-semibold text-slate-950">{title}</h3>{subtitle&&<p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>{children}</section>}
const norm=(raw:AnyRow)=>({...raw,isOpen:Boolean(raw.isOpen),status:raw.status||raw.platform_status||'draft',amenities:raw.amenities||[],hours:raw.hours||[],services:(raw.services||[]).map((x:AnyRow)=>({...x,active:Boolean(x.active)})),staff:(raw.staff||[]).map((x:AnyRow)=>({...x,active:Boolean(x.active)})),offers:(raw.offers||[]).map((x:AnyRow)=>({...x,active:Boolean(x.active)})),media:raw.media||[]});

export function AdminApp(){
 const [token,setToken]=useState(()=>localStorage.getItem(TOKEN_KEY));const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{const expire=()=>{setToken(null);setPassword('');setError('Your admin session expired. Please sign in again.');};window.addEventListener(SESSION_EXPIRED_EVENT,expire);return()=>window.removeEventListener(SESSION_EXPIRED_EVENT,expire)},[]);
 const login=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const b=await api('/api/admin/login',{method:'POST',body:JSON.stringify({email,password})});localStorage.setItem(TOKEN_KEY,b.token);setToken(b.token)}catch(x){setError(x instanceof Error?x.message:'Login failed.')}finally{setBusy(false)}};
 if(!token)return <main className="min-h-screen bg-slate-50 px-5 py-16"><form onSubmit={login} className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50"><div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white"><Scissors/></div><p className="text-xs font-bold tracking-[.18em] text-teal-700">NO-WAIT SALON</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Admin sign in</h1><p className="mt-2 text-sm text-slate-500">Secure access for platform operations.</p><div className="mt-8 grid gap-4"><Field label="Admin email" type="email" required value={email} onChange={setEmail}/><Field label="Password" type="password" required value={password} onChange={setPassword}/>{error&&<p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="h-12 rounded-xl bg-slate-950 font-semibold text-white disabled:opacity-60">{busy?'Signing in…':'Sign in securely'}</button></div></form></main>;
 return <AdminShell onLogout={()=>{void api('/api/admin/logout',{method:'POST'}).catch(()=>{});localStorage.removeItem(TOKEN_KEY);setToken(null)}}/>;
}

function AdminShell({onLogout}:{onLogout:()=>void}){const [page,setPage]=useState<'dashboard'|'categories'|'salons'|'customers'>('dashboard');const [editing,setEditing]=useState<string|'new'|null>(null);const [mobileNav,setMobileNav]=useState(false);const nav=[['dashboard','Overview',LayoutDashboard],['categories','Main Categories',Layers],['salons','Salons & Businesses',Building2],['customers','Customers',Users]] as const;
 return <div className="min-h-screen bg-slate-50 text-slate-900"><aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white p-5 transition lg:translate-x-0 ${mobileNav?'translate-x-0':'-translate-x-full'}`}><div className="flex items-center gap-3 px-2 py-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-600 text-white"><Scissors size={20}/></div><div><b>No-Wait Platform</b><p className="text-xs text-slate-500">Platform Admin</p></div></div><nav className="mt-7 grid gap-1">{nav.map(([id,label,Icon])=><button key={id} onClick={()=>{setPage(id);setEditing(null);setMobileNav(false)}} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${page===id?'bg-teal-50 text-teal-800':'text-slate-600 hover:bg-slate-50'}`}><Icon size={19}/>{label}</button>)}</nav><button onClick={onLogout} className="absolute bottom-6 left-5 right-5 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700"><LogOut size={18}/>Log out</button></aside><div className="lg:pl-64"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-8"><button className="lg:hidden" onClick={()=>setMobileNav(true)}><Menu/></button><div><p className="text-sm font-semibold">{editing?'Business editor':page==='dashboard'?'Dashboard':page==='categories'?'Main Categories':page==='salons'?'Business management':'Customers'}</p><p className="hidden text-xs text-slate-500 sm:block">Manage platform categories & business content without rebuilding customer apps.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Secure session</span></header><main className="mx-auto max-w-7xl p-5 lg:p-8">{editing?<SalonEditor id={editing} onBack={()=>setEditing(null)}/>:page==='dashboard'?<Dashboard onSalons={()=>setPage('salons')}/>:page==='categories'?<CategoriesList/>:page==='salons'?<SalonList onEdit={setEditing}/>:<Customers/>}</main></div>{mobileNav&&<button aria-label="Close menu" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={()=>setMobileNav(false)}/>}</div>}

function Dashboard({onSalons}:{onSalons:()=>void}){const [data,setData]=useState<AnyRow|null>(null);useEffect(()=>{api('/api/admin/summary').then(setData).catch(()=>{})},[]);const cards=[['Total businesses',data?.totalSalons,Building2],['Active businesses',data?.activeSalons,Activity],['Customers',data?.totalCustomers,Users],['Bookings',data?.totalBookings,CalendarCheck]] as const;return <div><div className="mb-7 flex items-end justify-between"><div><h1 className="text-3xl font-bold">Overview</h1><p className="mt-1 text-slate-500">A simple view of current platform activity across categories.</p></div><button onClick={onSalons} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white">Manage businesses</button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,Icon])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon size={20}/></span><span className="text-xs text-slate-400">Live</span></div><p className="mt-5 text-3xl font-bold">{value??'—'}</p><p className="mt-1 text-sm text-slate-500">{label}</p></div>)}</div><Section title="Platform controls" subtitle="Business content is separate from live queue operations."><div className="grid gap-4 md:grid-cols-3"><Info title="Category management" text="Main categories (Salon, Gym, Food, etc.) drive Customer Home tabs."/><Info title="Content updates" text="Names, services, offers and media update through the backend API."/><Info title="Live operations" text="Staff retains control of walk-ins, calls, services and chairs."/></div></Section></div>}
function Info({title,text}:{title:string;text:string}){return <div className="rounded-xl bg-slate-50 p-4"><b className="text-sm">{title}</b><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>}

function CategoriesList() {
  const [categories, setCategories] = useState<AnyRow[]>([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<AnyRow | null>(null);

  const load = () => {
    api('/api/admin/main-categories')
      .then((b) => setCategories(b.categories))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (c: AnyRow) => {
    await api(`/api/admin/main-categories/${c.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !c.active }),
    });
    load();
  };

  const remove = async (c: AnyRow) => {
    if (c.isDefault) return alert('Default category cannot be deleted.');
    if (!window.confirm(`Delete category "${c.name}"? Businesses in this category will be reset to Salon.`)) return;
    try {
      await api(`/api/admin/main-categories/${c.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to delete category.');
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Main Categories</h1>
          <p className="mt-1 text-slate-500">Configure top category tabs for Customer Home and assign business categories.</p>
        </div>
        <button
          onClick={() => {
            setEditingCat({ id: '', name: '', iconName: 'Scissors', label: '', description: '', displayOrder: (categories.length + 1) * 10, active: true });
            setModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition"
        >
          <Plus size={18} />
          Add Main Category
        </button>
      </div>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Icon Key</th>
                <th className="px-4 py-3">Customer Label</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned Businesses</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 font-bold">
                        {c.name.charAt(0)}
                      </span>
                      <div>
                        <b>{c.name}</b>
                        {c.isDefault && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-bold">DEFAULT</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 text-slate-500 font-mono text-xs">{c.iconName}</td>
                  <td className="px-4 text-slate-700">{c.label}</td>
                  <td className="px-4 text-slate-700">{c.displayOrder}</td>
                  <td className="px-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 font-bold text-slate-800">{c.businessCount ?? 0}</td>
                  <td className="px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingCat(c);
                          setModalOpen(true);
                        }}
                        className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => void toggle(c)}
                        className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50"
                        title="Toggle active"
                      >
                        <Power size={16} />
                      </button>
                      {!c.isDefault && (
                        <button
                          onClick={() => void remove(c)}
                          className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50"
                          title="Delete category"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && editingCat && (
        <CategoryModal
          cat={editingCat}
          onClose={() => {
            setModalOpen(false);
            setEditingCat(null);
          }}
          onSave={() => {
            setModalOpen(false);
            setEditingCat(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CategoryModal({ cat, onClose, onSave }: { cat: AnyRow; onClose: () => void; onSave: () => void }) {
  const isNew = !cat.created_at && (!cat.id || cat.id === '');
  const [form, setForm] = useState<AnyRow>({
    ...cat,
    id: cat.id || '',
    name: cat.name || '',
    iconName: cat.iconName || 'Scissors',
    label: cat.label || '',
    description: cat.description || '',
    displayOrder: cat.displayOrder || 10,
    active: cat.active ?? true,
    themeKey: cat.themeKey || 'salon',
    primaryColor: cat.primaryColor || '#0F766E',
    accentColor: cat.accentColor || '#2DD4BF',
    bannerHeadline: cat.bannerHeadline || '',
    bannerSubheadline: cat.bannerSubheadline || '',
    bannerCtaText: cat.bannerCtaText || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isNew) {
        await api('/api/admin/main-categories', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      } else {
        await api(`/api/admin/main-categories/${cat.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const iconOptions = ['Scissors', 'Dumbbell', 'ShoppingBag', 'Car', 'Dog', 'Building2', 'Utensils', 'Store', 'Sparkles'];
  const themeOptions = ['salon', 'gym', 'shop', 'moto', 'pets', 'mall', 'food'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <form onSubmit={save} className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-xl font-bold text-slate-900">{isNew ? 'Add Main Category' : `Edit Category: ${cat.name}`}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          {isNew && <Field label="Category ID / Key (e.g. 'spa')" value={form.id} onChange={(v) => setForm((f) => ({ ...f, id: v }))} required />}
          <Field label="Category Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Icon Key
            <select
              value={form.iconName}
              onChange={(e) => setForm((f) => ({ ...f, iconName: e.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-teal-600"
            >
              {iconOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Visual Theme Key
            <select
              value={form.themeKey}
              onChange={(e) => setForm((f) => ({ ...f, themeKey: e.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-teal-600 capitalize"
            >
              {themeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} theme
                </option>
              ))}
            </select>
          </label>
          <Field label="Customer Facing Label" value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} required />
          <Field label="Display Order" type="number" value={form.displayOrder} onChange={(v) => setForm((f) => ({ ...f, displayOrder: v }))} />
          <Field label="Primary Theme Color" value={form.primaryColor} onChange={(v) => setForm((f) => ({ ...f, primaryColor: v }))} placeholder="#0F766E" />
          <Field label="Accent Color" value={form.accentColor} onChange={(v) => setForm((f) => ({ ...f, accentColor: v }))} placeholder="#2DD4BF" />
          <div className="sm:col-span-2 space-y-3 border-t pt-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Hero Banner Configuration</h4>
            <Field label="Banner Headline" value={form.bannerHeadline} onChange={(v) => setForm((f) => ({ ...f, bannerHeadline: v }))} placeholder="e.g. Better grooming, less waiting." />
            <Field label="Banner Subheadline" value={form.bannerSubheadline} onChange={(v) => setForm((f) => ({ ...f, bannerSubheadline: v }))} placeholder="e.g. Reserve your chair before leaving home." />
            <Field label="Banner CTA Text" value={form.bannerCtaText} onChange={(v) => setForm((f) => ({ ...f, bannerCtaText: v }))} placeholder="e.g. Explore Chairs" />
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="Short category description for customers" />
          </div>
          <div className="sm:col-span-2 pt-2">
            <Toggle checked={Boolean(form.active)} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Category is active on Customer Home" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button disabled={busy} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50">
            {busy ? 'Saving…' : 'Save Category'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SalonList({onEdit}:{onEdit:(id:string|'new')=>void}){
  const [salons,setSalons]=useState<AnyRow[]>([]);
  const [categories,setCategories]=useState<AnyRow[]>([]);
  const [q,setQ]=useState('');
  const [catFilter,setCatFilter]=useState('all');
  const [error,setError]=useState('');
  const load=()=>{
    api('/api/admin/salons').then(b=>setSalons(b.salons)).catch(e=>setError(e.message));
    api('/api/admin/main-categories').then(b=>setCategories(b.categories)).catch(()=>{});
  };
  useEffect(()=>{void load()},[]);
  const shown=salons.filter(s=>{
    const matchQuery = `${s.name} ${s.city} ${s.area}`.toLowerCase().includes(q.toLowerCase());
    const matchCat = catFilter === 'all' || (s.main_category_id || 'salon') === catFilter;
    return matchQuery && matchCat;
  });
  const toggle=async(s:AnyRow)=>{await api(`/api/admin/salons/${s.id}/status`,{method:'PATCH',body:JSON.stringify({status:s.platform_status==='active'?'deactivated':'active'})});load()};
  return <div><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold">Salons & Businesses</h1><p className="mt-1 text-slate-500">Create, update and control customer visibility across main categories.</p></div><button onClick={()=>onEdit('new')} className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={18}/>Add new business</button></div><div className="mb-4 flex flex-wrap items-center gap-3"><div className="flex max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 flex-1 min-w-[240px]"><Search size={18} className="text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search business, city or area" className="h-11 w-full outline-none"/></div><select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none"><option value="all">All Categories</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>{error&&<p className="mb-4 text-red-600">{error}</p>}<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Business','Main Category','City / area','Status','Services','Staff','Last updated','Actions'].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody>{shown.map(s=>{const catObj=categories.find(c=>c.id===(s.main_category_id||'salon')); return <tr key={s.id} className="border-t border-slate-100"><td className="px-4 py-4 font-semibold">{s.name}</td><td className="px-4"><span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800 capitalize">{catObj?.name || s.main_category_id || 'Salon'}</span></td><td className="px-4 text-slate-500">{[s.area,s.city].filter(Boolean).join(', ')||'—'}</td><td className="px-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${s.platform_status==='active'?'bg-emerald-50 text-emerald-700 border border-emerald-200':s.platform_status==='deactivated'?'bg-rose-50 text-rose-700 border border-rose-200':'bg-slate-100 text-slate-600'}`}>{s.platform_status}</span></td><td className="px-4">{s.service_count}</td><td className="px-4">{s.staff_count}</td><td className="px-4 text-slate-500">{s.updated_at?new Date(s.updated_at).toLocaleDateString():'—'}</td><td className="px-4"><div className="flex gap-2"><button onClick={()=>onEdit(s.id)} className="rounded-lg border p-2 text-slate-600" title="Edit"><Pencil size={16}/></button><button onClick={()=>void toggle(s)} className={`rounded-lg border p-2 ${s.platform_status==='active'?'text-rose-600 hover:bg-rose-50':'text-emerald-600 hover:bg-emerald-50'}`} title={s.platform_status==='active'?'Deactivate business':'Reactivate business'}><Power size={16}/></button></div></td></tr>})}</tbody></table></div>{!shown.length&&<p className="p-10 text-center text-slate-500">No businesses found matching criteria.</p>}</div></div>
}

function SalonEditor({id,onBack}:{id:string|'new';onBack:()=>void}){const [form,setForm]=useState<AnyRow>(emptySalon());const [tab,setTab]=useState('details');const [busy,setBusy]=useState(id!=='new');const [message,setMessage]=useState('');const [error,setError]=useState('');useEffect(()=>{if(id==='new')return;void api(`/api/admin/salons/${id}`).then(b=>setForm(norm(b.salon))).catch(e=>setError(e.message)).finally(()=>setBusy(false))},[id]);const set=(k:string,v:any)=>setForm((f:AnyRow)=>({...f,[k]:v}));const save=async()=>{setBusy(true);setError('');setMessage('');try{const b=await api(id==='new'?'/api/admin/salons':`/api/admin/salons/${id}`,{method:id==='new'?'POST':'PUT',body:JSON.stringify(form)});setForm(norm(b.salon));setMessage('Business saved. Customer App will receive this data on its next refresh.')}catch(e){setError(e instanceof Error?e.message:'Save failed.')}finally{setBusy(false)}};if(busy&&id!=='new'&&!form.name)return <p>Loading business…</p>;
 const tabs=[['details','Details',Building2],['hours','Hours',Clock3],['services','Services',Scissors],['staff','Staff',Users],['offers','Offers',Tag],['media','Gallery',ImagePlus],['qr','Business QR',QrCode]] as const;
 return <div><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-slate-600"><ChevronLeft size={18}/>Back to businesses</button><div className="flex gap-2"><button onClick={onBack} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">Cancel</button><button onClick={()=>void save()} disabled={busy} className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={17}/>{busy?'Saving…':'Save business'}</button></div></div><div className="mb-6"><h1 className="text-3xl font-bold">{id==='new'?'Add new business':form.name}</h1><p className="mt-1 text-slate-500">Configuration changes do not affect the live operational queue.</p></div>{message&&<p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}{error&&<p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">{tabs.map(([key,label,Icon])=><button key={key} onClick={()=>setTab(key)} className={`flex min-w-max items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${tab===key?'bg-slate-950 text-white':'text-slate-600'}`}><Icon size={16}/>{label}</button>)}</div>{tab==='details'?<Details form={form} set={set}/>:tab==='hours'?<Hours rows={form.hours} set={v=>set('hours',v)}/>:tab==='services'?<Services rows={form.services} set={v=>set('services',v)}/>:tab==='staff'?<Staff rows={form.staff} set={v=>set('staff',v)}/>:tab==='offers'?<Offers rows={form.offers} set={v=>set('offers',v)}/>:tab==='media'?<Media rows={form.media} set={v=>set('media',v)}/>:<BusinessQr businessId={id} businessName={form.name}/>}</div>}

type BusinessQrData={businessName:string;businessType:string;publicToken:string;status:string;createdAt:number;publicUrl:string;previewImageUrl:string;downloadImageUrl:string};
function BusinessQr({businessId,businessName}:{businessId:string|'new';businessName:string}){const [qr,setQr]=useState<BusinessQrData|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const load=()=>businessId==='new'?Promise.resolve():api(`/api/admin/businesses/${businessId}/qr`).then(b=>setQr(b.qr)).catch(e=>setError(e.message));useEffect(()=>{void load()},[businessId]);if(businessId==='new')return <Section title="Business QR"><p className="text-sm text-slate-500">Save this business first. Its secure QR will be generated automatically.</p></Section>;const regenerate=async()=>{if(!window.confirm('Replace this QR? The current printed code will stop working immediately.'))return;setBusy(true);setError('');try{const b=await api(`/api/admin/businesses/${businessId}/qr/regenerate`,{method:'POST'});setQr(b.qr)}catch(e){setError(e instanceof Error?e.message:'Unable to replace QR.')}finally{setBusy(false)}};const copy=async()=>{if(qr)await navigator.clipboard.writeText(qr.publicUrl)};const print=()=>{if(!qr)return;const win=window.open('','_blank');if(!win)return;win.document.write(`<title>${businessName} QR</title><main style="font-family:system-ui;text-align:center;padding:40px"><h1>${businessName}</h1><p>Scan to view services and join the live queue</p><img src="${qr.downloadImageUrl}" style="width:420px;max-width:90%"><p>${qr.publicUrl}</p></main>`);win.document.close();win.focus();setTimeout(()=>win.print(),500)};return <Section title="Business QR" subtitle="Customers can scan this code to open this exact business and join its queue.">{error&&<p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{!qr?<p className="text-sm text-slate-500">Loading secure QR…</p>:<div className="grid gap-6 md:grid-cols-[280px_1fr]"><div className="rounded-2xl border bg-white p-4"><img src={qr.previewImageUrl} alt={`${businessName} queue QR`} className="aspect-square w-full"/></div><div className="space-y-4"><div><p className="text-lg font-semibold">{qr.businessName}</p><p className="text-sm capitalize text-slate-500">{qr.businessType} · {qr.status}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Public scan link</p><p className="mt-1 break-all text-sm">{qr.publicUrl}</p></div><p className="text-xs text-slate-500">Created {new Date(qr.createdAt).toLocaleString()} · Token ending {qr.publicToken.slice(-6)}</p><div className="flex flex-wrap gap-2"><a href={qr.downloadImageUrl} download={`${businessName}-qr.png`} className="flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white"><Download size={16}/>Download</a><button onClick={print} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><Printer size={16}/>Print</button><button onClick={()=>void copy()} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><Copy size={16}/>Copy link</button><button disabled={busy} onClick={()=>void regenerate()} className="flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"><RefreshCw size={16}/>{busy?'Replacing…':'Regenerate'}</button></div></div></div>}</Section>}

function Details({form,set}:{form:AnyRow;set:(k:string,v:any)=>void}){
  const [mainCats, setMainCats] = useState<AnyRow[]>([]);
  useEffect(() => {
    api('/api/admin/main-categories').then(b => setMainCats(b.categories)).catch(() => {});
  }, []);

  return <div className="grid gap-5"><Section title="Basic information"><div className="grid gap-4 md:grid-cols-2"><Field label="Business name" required value={form.name} onChange={v=>set('name',v)}/><label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>Main Category<b className="text-red-500"> *</b></span><select value={form.main_category_id || form.mainCategoryId || 'salon'} onChange={e=>set('main_category_id',e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-teal-600">{mainCats.length?mainCats.map(c=><option key={c.id} value={c.id}>{c.name} ({c.label})</option>):<option value="salon">Salon (Live Salons)</option>}</select></label><Field label="Category / Tagline" value={form.category} onChange={v=>set('category',v)}/><Field label="Short description" value={form.short_description} onChange={v=>set('short_description',v)}/><Field label="Phone number" value={form.phone_number} onChange={v=>set('phone_number',v)}/><Field label="Email" type="email" value={form.email} onChange={v=>set('email',v)}/><Field label="Website / social link" value={form.website_url} onChange={v=>set('website_url',v)}/><label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">Full description<textarea value={form.description||''} onChange={e=>set('description',e.target.value)} className="min-h-28 rounded-xl border border-slate-200 p-3 outline-none focus:border-teal-600"/></label></div></Section><Section title="Address & location"><div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><Field label="Full address" required value={form.address} onChange={v=>set('address',v)}/></div><Field label="Area" value={form.area} onChange={v=>set('area',v)}/><Field label="City" value={form.city} onChange={v=>set('city',v)}/><Field label="State" value={form.state} onChange={v=>set('state',v)}/><Field label="PIN code" value={form.pin_code} onChange={v=>set('pin_code',v)}/><Field label="Latitude" type="number" value={form.latitude} onChange={v=>set('latitude',v)}/><Field label="Longitude" type="number" value={form.longitude} onChange={v=>set('longitude',v)}/></div></Section><Section title="Branding & visibility"><div className="grid gap-4 md:grid-cols-2"><Field label="Logo URL" value={form.logo_image_url} onChange={v=>set('logo_image_url',v)}/><Field label="Cover image URL" value={form.cover_image_url} onChange={v=>set('cover_image_url',v)}/><Field label="Promotional banner URL" value={form.promotional_banner_url} onChange={v=>set('promotional_banner_url',v)}/><label className="grid gap-1.5 text-sm font-medium text-slate-700">Platform status<select value={form.status} onChange={e=>set('status',e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3"><option value="active">Active</option><option value="deactivated">Deactivated</option><option value="draft">Draft</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label><Toggle checked={Boolean(form.isOpen)} onChange={v=>set('isOpen',v)} label="Business is currently open"/></div></Section></div>
}
function Hours({rows,set}:{rows:AnyRow[];set:(v:AnyRow[])=>void}){const edit=(i:number,k:string,v:any)=>set(rows.map((r,n)=>n===i?{...r,[k]:v}:r));return <Section title="Weekly opening hours" subtitle="Set different timings or close individual days."><div className="grid gap-3">{days.map((day,i)=>{const r=rows[i]||{day_of_week:i,open_time:'09:00',close_time:'21:00',closed:0};return <div key={day} className="grid items-center gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[140px_1fr_1fr_auto]"><b className="text-sm">{day}</b><input type="time" disabled={Boolean(r.closed)} value={r.open_time} onChange={e=>edit(i,'open_time',e.target.value)} className="h-10 rounded-lg border px-2 disabled:opacity-40"/><input type="time" disabled={Boolean(r.closed)} value={r.close_time} onChange={e=>edit(i,'close_time',e.target.value)} className="h-10 rounded-lg border px-2 disabled:opacity-40"/><Toggle checked={Boolean(r.closed)} onChange={v=>edit(i,'closed',v?1:0)} label="Closed"/></div>})}</div></Section>}
function RowActions({onDelete}:{onDelete:()=>void}){return <button onClick={onDelete} className="rounded-lg border border-red-100 p-2 text-red-600"><Trash2 size={16}/></button>}
function Services({rows,set}:{rows:AnyRow[];set:(v:AnyRow[])=>void}){const edit=(i:number,k:string,v:any)=>set(rows.map((r,n)=>n===i?{...r,[k]:v}:r));return <Section title="Services" subtitle="Customer service cards are generated from these records."><div className="grid gap-3">{rows.map((r,i)=><div key={r.id||i} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-6"><Field label="Name" value={r.name} onChange={v=>edit(i,'name',v)}/><Field label="Category" value={r.category} onChange={v=>edit(i,'category',v)}/><Field label="Price ₹" type="number" value={r.price_inr} onChange={v=>edit(i,'price_inr',v)}/><Field label="Duration min" type="number" value={r.duration_min} onChange={v=>edit(i,'duration_min',v)}/><div className="flex items-end"><Toggle checked={r.active} onChange={v=>edit(i,'active',v)} label="Active"/></div><div className="flex items-end"><RowActions onDelete={()=>set(rows.filter((_,n)=>n!==i))}/></div><div className="md:col-span-6"><Field label="Description" value={r.description} onChange={v=>edit(i,'description',v)}/></div></div>)}<button onClick={()=>set([...rows,{id:crypto.randomUUID(),name:'',category:'',price_inr:0,duration_min:30,description:'',active:true}])} className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-teal-300 py-3 text-sm font-semibold text-teal-700"><Plus size={17}/>Add service</button></div></Section>}
function Staff({rows,set}:{rows:AnyRow[];set:(v:AnyRow[])=>void}){const edit=(i:number,k:string,v:any)=>set(rows.map((r,n)=>n===i?{...r,[k]:v}:r));return <Section title="Barbers & staff" subtitle="Active staff remain compatible with the live queue system."><div className="grid gap-3">{rows.map((r,i)=><div key={r.id||i} className="grid gap-3 rounded-xl border p-4 md:grid-cols-5"><Field label="Name" value={r.name} onChange={v=>edit(i,'name',v)}/><Field label="Role" value={r.role} onChange={v=>edit(i,'role',v)}/><Field label="Photo URL" value={r.photo_url} onChange={v=>edit(i,'photo_url',v)}/><label className="grid gap-1.5 text-sm font-medium">Working status<select value={r.working_status} onChange={e=>edit(i,'working_status',e.target.value)} className="h-11 rounded-xl border px-3"><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="busy">Busy</option></select></label><div className="flex items-end justify-between"><Toggle checked={r.active} onChange={v=>edit(i,'active',v)} label="Active"/><RowActions onDelete={()=>set(rows.filter((_,n)=>n!==i))}/></div></div>)}<button onClick={()=>set([...rows,{id:crypto.randomUUID(),name:'',role:'Barber',photo_url:'',working_status:'available',active:true}])} className="rounded-xl border border-dashed border-teal-300 py-3 text-sm font-semibold text-teal-700">+ Add staff member</button></div></Section>}
function Offers({rows,set}:{rows:AnyRow[];set:(v:AnyRow[])=>void}){const edit=(i:number,k:string,v:any)=>set(rows.map((r,n)=>n===i?{...r,[k]:v}:r));return <Section title="Offers"><div className="grid gap-3">{rows.map((r,i)=><div key={r.id||i} className="grid gap-3 rounded-xl border p-4 md:grid-cols-4"><Field label="Title" value={r.title} onChange={v=>edit(i,'title',v)}/><Field label="Discount text" value={r.discount_text} onChange={v=>edit(i,'discount_text',v)}/><Field label="Minimum bill ₹" type="number" value={r.minimum_bill} onChange={v=>edit(i,'minimum_bill',v)}/><div className="flex items-end justify-between"><Toggle checked={r.active} onChange={v=>edit(i,'active',v)} label="Active"/><RowActions onDelete={()=>set(rows.filter((_,n)=>n!==i))}/></div><Field label="Start date" type="date" value={r.start_date} onChange={v=>edit(i,'start_date',v)}/><Field label="End date" type="date" value={r.end_date} onChange={v=>edit(i,'end_date',v)}/><div className="md:col-span-2"><Field label="Terms" value={r.terms} onChange={v=>edit(i,'terms',v)}/></div></div>)}<button onClick={()=>set([...rows,{id:crypto.randomUUID(),title:'',discount_text:'',minimum_bill:0,start_date:'',end_date:'',terms:'',description:'',image_url:'',active:true}])} className="rounded-xl border border-dashed border-teal-300 py-3 text-sm font-semibold text-teal-700">+ Add offer</button></div></Section>}
function Media({rows,set}:{rows:AnyRow[];set:(v:AnyRow[])=>void}){const [uploading,setUploading]=useState(false);const upload=async(file:File)=>{if(file.size>2*1024*1024)return alert('Image must be 2 MB or smaller.');setUploading(true);const reader=new FileReader();reader.onload=async()=>{try{const b=await api('/api/admin/media/upload',{method:'POST',body:JSON.stringify({dataUrl:reader.result})});set([...rows,{id:crypto.randomUUID(),media_type:'gallery',url:b.url,caption:'',featured:rows.length===0}])}finally{setUploading(false)}};reader.readAsDataURL(file)};return <Section title="Gallery & vibes" subtitle="PNG, JPEG or WebP up to 2 MB. Local files use temporary server storage."><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-teal-300 py-4 font-semibold text-teal-700"><ImagePlus size={18}/>{uploading?'Uploading…':'Upload gallery image'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={uploading} onChange={e=>e.target.files?.[0]&&void upload(e.target.files[0])}/></label><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((r,i)=><div key={r.id||i} className="overflow-hidden rounded-xl border"><div className="aspect-video bg-slate-100">{r.url&&<img src={r.url} className="h-full w-full object-cover"/>}</div><div className="grid gap-2 p-3"><input value={r.caption||''} placeholder="Caption" onChange={e=>set(rows.map((x,n)=>n===i?{...x,caption:e.target.value}:x))} className="h-9 rounded-lg border px-2 text-sm"/><div className="flex justify-between"><Toggle checked={Boolean(r.featured)} onChange={v=>set(rows.map((x,n)=>({...x,featured:n===i?v:false})))} label="Featured"/><RowActions onDelete={()=>set(rows.filter((_,n)=>n!==i))}/></div></div></div>)}</div></Section>}
function Customers(){const [rows,setRows]=useState<AnyRow[]>([]);useEffect(()=>{void api('/api/admin/customers').then(b=>setRows(b.customers)).catch(()=>{})},[]);return <div><h1 className="text-3xl font-bold">Customers</h1><p className="mt-1 text-slate-500">Read-only account overview with limited personal data.</p><div className="mt-6 overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50"><tr>{['Customer ID','Name','Verified phone','Email','Created','Bookings'].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t"><td className="max-w-40 truncate px-4 py-4 font-mono text-xs">{r.id}</td><td className="px-4">{r.name||'—'}</td><td className="px-4">••••••{String(r.phone_number).slice(-4)}</td><td className="px-4">{r.email||'—'}</td><td className="px-4">{new Date(r.created_at).toLocaleDateString()}</td><td className="px-4">{r.booking_count}</td></tr>)}</tbody></table></div></div>}
