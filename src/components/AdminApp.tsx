import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { 
  Building2,
  Users,
  CalendarCheck,
  Activity,
  LogOut,
  LayoutDashboard,
  Search,
  Plus,
  Pencil,
  Power,
  Save,
  X,
  ChevronLeft,
  Trash2,
  ImagePlus,
  Scissors,
  Tag,
  Clock3,
  Menu,
  QrCode,
  Download,
  Printer,
  Copy,
  RefreshCw,
  Layers,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'no_wait_admin_token';
const SESSION_EXPIRED_EVENT = 'no-wait-admin-session-expired';
type AnyRow = Record<string, any>;
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Resilient API helper with automatic retries for safe GET requests.
 * Prevents transient network errors or cold-start timeouts from dropping Admin data.
 */
const api = async (path: string, init: RequestInit = {}, retries = 2) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const isGet = !init.method || init.method.toUpperCase() === 'GET';
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= (isGet ? retries : 0); attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, Math.min(1000, 300 * Math.pow(2, attempt - 1))));
      }
      const r = await fetch(`${API}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
      const b = await r.json().catch(() => ({}));
      if (r.status === 401 && token) {
        localStorage.removeItem(TOKEN_KEY);
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      if (!r.ok) {
        throw new Error(b.error || 'Request failed.');
      }
      return b;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError || new Error('Request failed.');
};

const emptySalon = () => ({
  name: '',
  short_description: '',
  description: '',
  category: '',
  phone_number: '',
  email: '',
  website_url: '',
  address: '',
  area: '',
  city: '',
  state: '',
  pin_code: '',
  latitude: 12.9716,
  longitude: 77.5946,
  isOpen: true,
  opening_hours: '9:00 AM–9:00 PM',
  logo_image_url: '',
  cover_image_url: '',
  promotional_banner_url: '',
  amenities: [],
  status: 'draft',
  hours: days.map((_, i) => ({ day_of_week: i, open_time: '09:00', close_time: '21:00', closed: 0 })),
  services: [],
  staff: [],
  offers: [],
  media: [],
});

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder = '',
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>
        {label}
        {required && <b className="text-red-500"> *</b>}
      </span>
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-teal-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
      </button>
      {label}
    </label>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

const norm = (raw: AnyRow) => ({
  ...raw,
  isOpen: Boolean(raw.isOpen),
  status: raw.status || raw.platform_status || 'draft',
  main_category_id: raw.mainCategoryId || raw.main_category_id || 'salon',
  amenities: raw.amenities || [],
  hours: raw.hours || [],
  services: (raw.services || []).map((x: AnyRow) => ({ ...x, active: Boolean(x.active) })),
  staff: (raw.staff || []).map((x: AnyRow) => ({ ...x, active: Boolean(x.active) })),
  offers: (raw.offers || []).map((x: AnyRow) => ({ ...x, active: Boolean(x.active) })),
  media: raw.media || [],
});

export function AdminApp() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const expire = () => {
      setToken(null);
      setPassword('');
      setError('Your admin session expired. Please sign in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const b = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem(TOKEN_KEY, b.token);
      setToken(b.token);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!token)
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-16">
        <form
          onSubmit={login}
          className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50"
        >
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white">
            <Scissors />
          </div>
          <p className="text-xs font-bold tracking-[.18em] text-teal-700">NO-WAIT SALON</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Admin sign in</h1>
          <p className="mt-2 text-sm text-slate-500">Secure access for platform operations.</p>
          <div className="mt-8 grid gap-4">
            <Field label="Admin email" type="email" required value={email} onChange={setEmail} />
            <Field label="Password" type="password" required value={password} onChange={setPassword} />
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button
              disabled={busy}
              className="h-12 rounded-xl bg-slate-950 font-semibold text-white disabled:opacity-60"
            >
              {busy ? 'Signing in…' : 'Sign in securely'}
            </button>
          </div>
        </form>
      </main>
    );

  return (
    <AdminShell
      onLogout={() => {
        void api('/api/admin/logout', { method: 'POST' }).catch(() => {});
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }}
    />
  );
}

function AdminShell({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<'dashboard' | 'categories' | 'salons' | 'customers'>('dashboard');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const nav = [
    ['dashboard', 'Overview', LayoutDashboard],
    ['categories', 'Main Categories', Layers],
    ['salons', 'Salons & Businesses', Building2],
    ['customers', 'Customers', Users],
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white p-5 transition lg:translate-x-0 ${
          mobileNav ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-600 text-white">
            <Scissors size={20} />
          </div>
          <div>
            <b>No-Wait Platform</b>
            <p className="text-xs text-slate-500">Platform Admin</p>
          </div>
        </div>
        <nav className="mt-7 grid gap-1">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setPage(id);
                setEditing(null);
                setMobileNav(false);
              }}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                page === id ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <button
          onClick={onLogout}
          className="absolute bottom-6 left-5 right-5 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut size={18} />
          Log out
        </button>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-8">
          <button className="lg:hidden" onClick={() => setMobileNav(true)}>
            <Menu />
          </button>
          <div>
            <p className="text-sm font-semibold">
              {editing
                ? 'Business editor'
                : page === 'dashboard'
                  ? 'Dashboard'
                  : page === 'categories'
                    ? 'Main Categories'
                    : page === 'salons'
                      ? 'Business management'
                      : 'Customers'}
            </p>
            <p className="hidden text-xs text-slate-500 sm:block">
              Manage platform categories & business content without rebuilding customer apps.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Secure session
          </span>
        </header>
        <main className="mx-auto max-w-7xl p-5 lg:p-8">
          {editing ? (
            <SalonEditor id={editing} onBack={() => setEditing(null)} />
          ) : page === 'dashboard' ? (
            <Dashboard onSalons={() => setPage('salons')} />
          ) : page === 'categories' ? (
            <CategoriesList />
          ) : page === 'salons' ? (
            <SalonList onEdit={setEditing} />
          ) : (
            <Customers />
          )}
        </main>
      </div>
      {mobileNav && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setMobileNav(false)}
        />
      )}
    </div>
  );
}

function Dashboard({ onSalons }: { onSalons: () => void }) {
  const [data, setData] = useState<AnyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!data) setLoading(true);
    setError(null);
    try {
      const res = await api('/api/admin/summary');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch overview metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    void load();
  }, []);

  const cards = [
    ['Total businesses', data?.totalSalons, Building2],
    ['Active businesses', data?.activeSalons, Activity],
    ['Customers', data?.totalCustomers, Users],
    ['Bookings', data?.totalBookings, CalendarCheck],
  ] as const;

  return (
    <div>
      <div className="mb-7 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Overview</h1>
          <p className="mt-1 text-slate-500">A simple view of current platform activity across categories.</p>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && <Loader2 className="animate-spin text-teal-600" size={18} />}
          <button onClick={onSalons} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700">
            Manage businesses
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <span>Connection delay — showing cached overview data.</span>
          </div>
          <button
            onClick={() => void load(true)}
            className="flex items-center gap-1.5 font-semibold text-amber-700 hover:text-amber-900"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
                <Icon size={20} />
              </span>
              <span className="text-xs text-slate-400">Live</span>
            </div>
            <p className="mt-5 text-3xl font-bold">
              {loading && data === null ? <span className="inline-block h-8 w-16 animate-pulse rounded-lg bg-slate-200" /> : (value ?? '—')}
            </p>
            <p className="mt-1 text-sm text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Section title="Platform controls" subtitle="Business content is separate from live queue operations.">
          <div className="grid gap-4 md:grid-cols-3">
            <Info title="Category management" text="Main categories (Salon, Gym, Food, etc.) drive Customer Home tabs." />
            <Info title="Content updates" text="Names, services, offers and media update through the backend API." />
            <Info title="Live operations" text="Staff retains control of walk-ins, calls, services and chairs." />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <b className="text-sm">{title}</b>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function CategoriesList() {
  const [categories, setCategories] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<AnyRow | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (categories.length === 0) setLoading(true);
    setError('');
    try {
      const b = await api('/api/admin/main-categories');
      setCategories(b.categories || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categories.length]);

  useEffect(() => {
    void load();
  }, []);

  const toggle = async (c: AnyRow) => {
    try {
      await api(`/api/admin/main-categories/${c.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !c.active }),
      });
      load(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const remove = async (c: AnyRow) => {
    if (c.isDefault) return alert('Default category cannot be deleted.');
    if (!window.confirm(`Delete category "${c.name}"? Businesses in this category will be reset to Salon.`)) return;
    try {
      await api(`/api/admin/main-categories/${c.id}`, { method: 'DELETE' });
      load(true);
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

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
          <span>{error}</span>
          <button onClick={() => void load(true)} className="flex items-center gap-1 font-semibold hover:underline">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Retry
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
            <tbody className="divide-y divide-slate-100">
              {loading && categories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 animate-spin text-teal-600" size={24} />
                    Loading categories…
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-4 font-semibold text-slate-900">{c.name}</td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-500">{c.iconName}</td>
                    <td className="px-4 py-4">{c.label}</td>
                    <td className="px-4 py-4">{c.displayOrder}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {c.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-teal-700">{c.businessCount ?? 0}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingCat(c); setModalOpen(true); }}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => void toggle(c)}
                          className={`rounded-lg p-1.5 transition ${c.active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                          title={c.active ? 'Disable' : 'Enable'}
                        >
                          <Power size={16} />
                        </button>
                        {!c.isDefault && (
                          <button
                            onClick={() => void remove(c)}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && editingCat && (
        <CategoryModal
          cat={editingCat}
          onClose={() => setModalOpen(false)}
          onSave={() => { setModalOpen(false); load(true); }}
        />
      )}
    </div>
  );
}

function CategoryModal({ cat, onClose, onSave }: { cat: AnyRow; onClose: () => void; onSave: () => void }) {
  const isNew = !cat.id;
  const [form, setForm] = useState({
    id: cat.id || '',
    name: cat.name || '',
    iconName: cat.iconName || 'Scissors',
    themeKey: cat.themeKey || 'salon',
    label: cat.label || '',
    description: cat.description || '',
    displayOrder: cat.displayOrder ?? 10,
    primaryColor: cat.primaryColor || '#0F766E',
    accentColor: cat.accentColor || '#2DD4BF',
    bannerHeadline: cat.bannerHeadline || '',
    bannerSubheadline: cat.bannerSubheadline || '',
    bannerCtaText: cat.bannerCtaText || '',
    active: cat.active ?? true,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <form onSubmit={save} className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
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

function SalonList({ onEdit }: { onEdit: (id: string | 'new') => void }) {
  const [salons, setSalons] = useState<AnyRow[]>([]);
  const [categories, setCategories] = useState<AnyRow[]>([]);
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AnyRow | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (salons.length === 0) setLoading(true);
    setError('');
    try {
      const [salonsRes, catsRes] = await Promise.all([
        api('/api/admin/salons'),
        api('/api/admin/main-categories').catch(() => ({ categories: [] })),
      ]);
      setSalons(salonsRes.salons || []);
      if (catsRes.categories) setCategories(catsRes.categories);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load business records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [salons.length]);

  useEffect(() => {
    void load();
  }, []);

  const shown = salons.filter((s) => {
    const matchQuery = `${s.name} ${s.city} ${s.area}`.toLowerCase().includes(q.toLowerCase());
    const matchCat = catFilter === 'all' || (s.main_category_id || 'salon') === catFilter;
    return matchQuery && matchCat;
  });

  const executeStatusChange = async (s: AnyRow) => {
    const nextStatus = s.platform_status === 'active' ? 'deactivated' : 'active';
    setPendingStatusId(s.id);
    setConfirmTarget(null);
    try {
      await api(`/api/admin/salons/${s.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setSalons((prev) =>
        prev.map((item) => (item.id === s.id ? { ...item, platform_status: nextStatus } : item))
      );
      load(true);
      setToast({
        type: 'success',
        text: `"${s.name}" is now ${nextStatus === 'active' ? 'ACTIVE' : 'DEACTIVATED'}.`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update business status.',
      });
    } finally {
      setPendingStatusId(null);
    }
  };

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div
          id="admin-status-toast"
          className={`fixed bottom-5 right-5 z-[9999] flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur-md transition-all ${
            toast.type === 'success'
              ? 'border border-emerald-300 bg-emerald-900/90 text-emerald-50'
              : 'border border-rose-300 bg-rose-900/90 text-rose-50'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-white/80 hover:text-white" aria-label="Dismiss toast">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmTarget && (
        <div id="admin-deactivate-confirm-modal" className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  confirmTarget.platform_status === 'active' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <Power size={20} />
              </div>
              <button onClick={() => setConfirmTarget(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-bold text-slate-900">
                {confirmTarget.platform_status === 'active' ? 'Deactivate business?' : 'Reactivate business?'}
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {confirmTarget.platform_status === 'active'
                  ? 'This business will be removed from the Customer App and its Staff Dashboard will be temporarily disabled. No business data will be deleted.'
                  : 'This business will be restored to the Customer App and its Staff Dashboard will become operational again.'}
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-deactivate-btn"
                onClick={() => void executeStatusChange(confirmTarget)}
                className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm ${
                  confirmTarget.platform_status === 'active' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmTarget.platform_status === 'active' ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Salons & Businesses</h1>
          <p className="mt-1 text-slate-500">Manage business details across all main categories.</p>
        </div>
        <button
          onClick={() => onEdit('new')}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition"
        >
          <Plus size={18} /> Add Business
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
          <span>{error}</span>
          <button onClick={() => void load(true)} className="flex items-center gap-1 font-semibold hover:underline">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Retry
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search business by name or city…"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-teal-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Category:</span>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Main Category</th>
                <th className="px-4 py-3">City / Area</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && salons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 animate-spin text-teal-600" size={24} />
                    Loading businesses…
                  </td>
                </tr>
              ) : shown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No businesses match your search.
                  </td>
                </tr>
              ) : (
                shown.map((s) => {
                  const isDeactivated = s.platform_status === 'deactivated';
                  const isPending = pendingStatusId === s.id;
                  const catObj = categories.find((c) => c.id === (s.main_category_id || 'salon'));

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-3">
                          {s.logo_image_url ? (
                            <img src={s.logo_image_url} alt="" className="h-8 w-8 rounded-lg object-cover border" />
                          ) : (
                            <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-700">
                              <Building2 size={16} />
                            </div>
                          )}
                          <span>{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {catObj?.name || s.main_category_id || 'Salon'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {s.area ? `${s.area}, ${s.city}` : s.city || '—'}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isDeactivated
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isDeactivated ? 'DEACTIVATED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onEdit(s.id)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            disabled={isPending}
                            onClick={() => setConfirmTarget(s)}
                            className={`rounded-lg border p-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                              isDeactivated
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border-slate-200 text-rose-600 hover:bg-rose-50'
                            }`}
                            title={isDeactivated ? 'Reactivate Business' : 'Deactivate Business'}
                          >
                            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SalonEditor({ id, onBack }: { id: string | 'new'; onBack: () => void }) {
  const [form, setForm] = useState<AnyRow>(emptySalon());
  const [mainCats, setMainCats] = useState<AnyRow[]>([]);
  const [tab, setTab] = useState('details');
  const [busy, setBusy] = useState(id !== 'new');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [assignedBusinessCode, setAssignedBusinessCode] = useState('');
  const [assigningId, setAssigningId] = useState(false);

  useEffect(() => {
    void api('/api/admin/main-categories')
      .then((b) => setMainCats(b.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (id === 'new') return;
    void api(`/api/admin/salons/${id}`)
      .then((b) => {
        const loaded = norm(b.salon);
        setForm(loaded);
        setAssignedBusinessCode(String(loaded.business_code || ''));
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [id]);

  const set = (k: string, v: any) => setForm((f: AnyRow) => ({ ...f, [k]: v }));


  

  const save = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const b = await api(id === 'new' ? '/api/admin/salons' : `/api/admin/salons/${id}`, {
        method: id === 'new' ? 'POST' : 'PUT',
        body: JSON.stringify(form),
      });
      setForm(norm(b.salon));
      setMessage('Business content saved. Live surfaces (Customer App, QR Web, Staff Dashboard) updated!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

const [checkingId, setCheckingId] = useState(false);
  const [idAvailable, setIdAvailable] = useState<boolean | null>(null);

  const checkBusinessId = async () => {
    if (!form.business_code) return;
    setCheckingId(true);
    try {
      const exclude = id === 'new' ? '' : `?excludeBusinessId=${encodeURIComponent(id)}`;
      const res = await api('/api/admin/check-business-id/' + encodeURIComponent(form.business_code) + exclude);
      setIdAvailable(res.available);
      if (!res.available) setError('This Business ID is already in use.');
      else setError('');
    } catch (e) {
      setIdAvailable(false);
      setError(e instanceof Error ? e.message : 'Unable to validate this Business ID.');
    } finally {
      setCheckingId(false);
    }
  };

  const assignBusinessId = async () => {
    if (id === 'new' || !form.business_code) return;
    setAssigningId(true);
    setError('');
    setMessage('');
    try {
      const result = await api(`/api/admin/salons/${id}/business-id`, {
        method: 'PATCH',
        body: JSON.stringify({ business_code: form.business_code }),
      });
      const savedCode = String(result.businessCode || '');
      setForm(norm(result.salon));
      setAssignedBusinessCode(savedCode);
      setIdAvailable(true);
      setMessage(`Business ID ${savedCode} assigned successfully. Existing Business QR remains active.`);
    } catch (e) {
      setIdAvailable(false);
      setError(e instanceof Error ? e.message : 'Unable to assign Business ID.');
    } finally {
      setAssigningId(false);
    }
  };

  if (id === 'new') {
    return (
      <div className="max-w-2xl mx-auto mt-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="rounded-xl border p-2 text-slate-600 hover:bg-slate-100"><ChevronLeft size={18} /></button>
          <div>
            <h1 className="text-2xl font-bold">Add New Business (Shell)</h1>
            <p className="text-xs text-slate-500">Create the platform workspace. Staff owner completes public profile later.</p>
          </div>
        </div>
        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Field label="Business Name" value={form.name} onChange={(v) => set('name', v)} required />
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Main Category
            <select value={form.main_category_id || 'salon'} onChange={(e) => set('main_category_id', e.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600">
              {mainCats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </label>
          
          <div className="pt-4 border-t">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Permanent Platform Identity</h3>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Business ID (Code)</label>
              <div className="flex gap-2">
                <input 
                  value={form.business_code || ''} 
                  onChange={e => { set('business_code', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')); setIdAvailable(null); }}
                  placeholder="e.g. IRONHOUSE01"
                  className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-teal-600 uppercase"
                />
                <button onClick={checkBusinessId} disabled={checkingId || !form.business_code} type="button" className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                  {checkingId ? 'Checking...' : 'Check Availability'}
                </button>
              </div>
              {idAvailable === true && <span className="text-sm font-bold text-teal-600">✅ Available</span>}
              {idAvailable === false && <span className="text-sm font-bold text-red-600">❌ This Business ID is already in use</span>}
              <p className="text-xs text-slate-500">Only A-Z, 0-9, and hyphens. This is the permanent code staff uses to select this workspace.</p>
            </div>
          </div>

          <div className="pt-4 border-t grid gap-4 sm:grid-cols-2">
            <Field label="Owner Phone" value={form.phone_number} onChange={(v) => set('phone_number', v)} placeholder="+1 555-0199" />
            <Field label="Owner Email" value={form.email} onChange={(v) => set('email', v)} placeholder="owner@example.com" />
          </div>

          <div className="pt-4 border-t flex justify-end">
            <button onClick={save} disabled={busy || idAvailable === false || !form.business_code || !form.name} className="rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50">
              {busy ? 'Creating...' : 'Create Business Shell'}
            </button>
          </div>
        </div>
      </div>
    );
  }


  if (busy && id !== 'new' && !form.name)
    return (
      <div className="py-12 text-center text-slate-500">
        <Loader2 className="mx-auto mb-2 animate-spin text-teal-600" size={24} />
        Loading business details…
      </div>
    );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-xl border p-2 text-slate-600 hover:bg-slate-100">
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">{id === 'new' ? 'Add New Business' : form.name || 'Edit Business'}</h1>
            <p className="text-xs text-slate-500">{id === 'new' ? 'Create a business profile' : `ID: ${id}`}</p>
          </div>
        </div>
        <button
          onClick={() => void save()}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
        </button>
      </div>

      {message && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 border border-emerald-200">{message}</p>}
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</p>}

      <div className="mb-6 flex gap-2 border-b">
        {['details', 'services', 'staff', 'offers', 'media', 'qr'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold capitalize transition ${
              tab === t ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'qr' ? 'Business QR' : t}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <div className="grid gap-6">
          <Section title="Basic Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business Name" value={form.name} onChange={(v) => set('name', v)} required />
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Main Category
                <select
                  value={form.main_category_id || 'salon'}
                  onChange={(e) => set('main_category_id', e.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600"
                >
                  {mainCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Phone Number" value={form.phone_number} onChange={(v) => set('phone_number', v)} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => set('email', String(v).trim().toLowerCase())} />
              <Field label="Address" value={form.address} onChange={(v) => set('address', v)} />
              <Field label="Area" value={form.area} onChange={(v) => set('area', v)} />
              <Field label="City" value={form.city} onChange={(v) => set('city', v)} />
              <Field label="Opening Hours String" value={form.opening_hours} onChange={(v) => set('opening_hours', v)} />
              <Field label="Logo Image URL" value={form.logo_image_url} onChange={(v) => set('logo_image_url', v)} placeholder="https://…" />
              <Field label="Cover Image URL" value={form.cover_image_url} onChange={(v) => set('cover_image_url', v)} placeholder="https://…" />
              <div className="sm:col-span-2 pt-2">
                <Toggle checked={Boolean(form.isOpen)} onChange={(v) => set('isOpen', v)} label="Business is currently Open for queueing" />
              </div>
            </div>
          </Section>

          <Section
            title="Staff Dashboard Access"
            subtitle="Assign the permanent Business ID staff will enter to reach this business workspace."
          >
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Business ID</label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={form.business_code || ''}
                    onChange={(event) => {
                      set('business_code', event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
                      setIdAvailable(null);
                    }}
                    placeholder="e.g. IRON001"
                    className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold uppercase tracking-wide outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                  <button
                    type="button"
                    onClick={() => void assignBusinessId()}
                    disabled={assigningId || !form.business_code || form.business_code === assignedBusinessCode}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {assigningId ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {form.business_code === assignedBusinessCode && assignedBusinessCode
                      ? 'Business ID Assigned'
                      : assignedBusinessCode
                        ? 'Validate & Change ID'
                        : 'Validate & Assign ID'}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  {assignedBusinessCode ? (
                    <span className="font-semibold text-emerald-700">Active ID: {assignedBusinessCode}</span>
                  ) : (
                    <span className="font-semibold text-amber-700">No Business ID assigned yet</span>
                  )}
                  <span className="text-slate-500">Use 3–50 uppercase letters, numbers, or hyphens. IDs must be unique.</span>
                </div>
              </div>
              <div className="rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm text-teal-900">
                Changing this staff login ID does not regenerate or disable the customer-facing Business QR.
              </div>
            </div>
          </Section>
        </div>
      )}

      {tab === 'services' && (
        <ServicesEditor rows={form.services || []} set={(v) => set('services', v)} />
      )}

      {tab === 'staff' && (
        <StaffEditor rows={form.staff || []} set={(v) => set('staff', v)} />
      )}

      {tab === 'offers' && (
        <OffersEditor rows={form.offers || []} set={(v) => set('offers', v)} />
      )}

      {tab === 'media' && (
        <Media rows={form.media || []} set={(v) => set('media', v)} />
      )}

      {tab === 'qr' && (
        <BusinessQr businessId={id} businessName={form.name || 'Business'} />
      )}
    </div>
  );
}

function ServicesEditor({ rows, set }: { rows: AnyRow[]; set: (v: AnyRow[]) => void }) {
  const add = () =>
    set([
      ...rows,
      {
        id: crypto.randomUUID(),
        name: 'New Service',
        category: 'Hair Care',
        price: 299,
        duration: 30,
        active: true,
      },
    ]);

  return (
    <Section title="Services & Pricing" subtitle="Add and configure service options offered to customers.">
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={add} className="flex items-center gap-2 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white">
          <Plus size={16} /> Add Service
        </button>
      </div>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id || i} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-12 items-center">
            <div className="sm:col-span-4">
              <input
                value={r.name || ''}
                placeholder="Service Name"
                onChange={(e) => set(rows.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))}
                className="h-10 w-full rounded-lg border px-3 text-sm font-semibold"
              />
            </div>
            <div className="sm:col-span-3">
              <input
                value={r.category || ''}
                placeholder="Category (e.g. Beard)"
                onChange={(e) => set(rows.map((x, n) => (n === i ? { ...x, category: e.target.value } : x)))}
                className="h-10 w-full rounded-lg border px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <input
                type="number"
                value={r.price ?? ''}
                placeholder="Price (₹)"
                onChange={(e) => set(rows.map((x, n) => (n === i ? { ...x, price: Number(e.target.value) } : x)))}
                className="h-10 w-full rounded-lg border px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <input
                type="number"
                value={r.duration ?? ''}
                placeholder="Mins"
                onChange={(e) => set(rows.map((x, n) => (n === i ? { ...x, duration: Number(e.target.value) } : x)))}
                className="h-10 w-full rounded-lg border px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-1 flex justify-end">
              <button type="button" onClick={() => set(rows.filter((_, n) => n !== i))} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function StaffEditor({ rows, set }: { rows: AnyRow[]; set: (v: AnyRow[]) => void }) {
  const add = () =>
    set([
      ...rows,
      {
        id: crypto.randomUUID(),
        name: 'New Staff',
        role: 'Stylist',
        status: 'available',
        active: true,
      },
    ]);

  return (
    <Section title="Staff Roster" subtitle="Configure stylists and staff members for live queue assignment.">
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={add} className="flex items-center gap-2 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white">
          <Plus size={16} /> Add Staff Member
        </button>
      </div>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id || i} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-12 items-center">
            <div className="sm:col-span-4">
              <input
                value={r.name || ''}
                placeholder="Staff Name"
                onChange={(e) => set(rows.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))}
                className="h-10 w-full rounded-lg border px-3 text-sm font-semibold"
              />
            </div>
            <div className="sm:col-span-4">
              <input
                value={r.role || ''}
                placeholder="Role (e.g. Master Stylist)"
                onChange={(e) => set(rows.map((x, n) => (n === i ? { ...x, role: e.target.value } : x)))}
                className="h-10 w-full rounded-lg border px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-3">
              <select
                value={r.status || 'available'}
                onChange={(e) => set(rows.map((x, n) => (n === i ? { ...x, status: e.target.value } : x)))}
                className="h-10 w-full rounded-lg border px-3 text-sm"
              >
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
            <div className="sm:col-span-1 flex justify-end">
              <button type="button" onClick={() => set(rows.filter((_, n) => n !== i))} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function OffersEditor({ rows, set }: { rows: AnyRow[]; set: (v: AnyRow[]) => void }) {
  const add = () =>
    set([
      ...rows,
      {
        id: crypto.randomUUID(),
        title: 'Special Offer',
        discount: '20% OFF',
        code: 'SAVE20',
        active: true,
      },
    ]);

  return (
    <Section title="Promotional Offers" subtitle="Configure deals and coupon codes for customer checkout.">
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={add} className="flex items-center gap-2 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white">
          <Plus size={16} /> Add Offer
        </button>
      </div>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id || i} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-12 items-center">
            <div className="sm:col-span-4">
              <input
                value={r.title || ''}
                placeholder="Offer Title"
                onChange={(e) => set(rows.map((x, n) => (n === i ? { ...x, title: e.target.value } : x)))}
                className="h-10 w-full rounded-lg border px-3 text-sm font-semibold"
              />
            </div>
            <div className="sm:col-span-4">
              <input
                value={r.discount || ''}
                placeholder="Discount Text (e.g. 20% OFF)"
                onChange={(e) => set(rows.map((x, n) => (n === i ? { ...x, discount: e.target.value } : x)))}
                className="h-10 w-full rounded-lg border px-3 text-sm"
              />
            </div>
            <div className="sm:col-span-3">
              <input
                value={r.code || ''}
                placeholder="Code (e.g. SAVE20)"
                onChange={(e) => set(rows.map((x, n) => (n === i ? { ...x, code: e.target.value } : x)))}
                className="h-10 w-full rounded-lg border px-3 text-sm font-mono uppercase"
              />
            </div>
            <div className="sm:col-span-1 flex justify-end">
              <button type="button" onClick={() => set(rows.filter((_, n) => n !== i))} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Media({ rows, set }: { rows: AnyRow[]; set: (v: AnyRow[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) return alert('Image must be 2 MB or smaller.');
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const b = await api('/api/admin/media/upload', { method: 'POST', body: JSON.stringify({ dataUrl: reader.result }) });
        set([...rows, { id: crypto.randomUUID(), media_type: 'gallery', url: b.url, caption: '', featured: rows.length === 0 }]);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };
  return (
    <Section title="Gallery & vibes" subtitle="PNG, JPEG or WebP up to 2 MB. Local files use temporary server storage.">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-teal-300 py-4 font-semibold text-teal-700">
        <ImagePlus size={18} />
        {uploading ? 'Uploading…' : 'Upload gallery image'}
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={uploading} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      </label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, i) => (
          <div key={r.id || i} className="overflow-hidden rounded-xl border">
            <div className="aspect-video bg-slate-100">{r.url && <img src={r.url} alt="" className="h-full w-full object-cover" />}</div>
            <div className="grid gap-2 p-3">
              <input
                value={r.caption || ''}
                placeholder="Caption"
                onChange={(e) => set(rows.map((x, n) => (n === i ? { ...x, caption: e.target.value } : x)))}
                className="h-9 rounded-lg border px-2 text-sm"
              />
              <div className="flex justify-between">
                <Toggle checked={Boolean(r.featured)} onChange={(v) => set(rows.map((x, n) => ({ ...x, featured: n === i ? v : false })))} label="Featured" />
                <button type="button" onClick={() => set(rows.filter((_, n) => n !== i))} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function BusinessQr({ businessId, businessName }: { businessId: string | 'new'; businessName: string }) {
  const [qr, setQr] = useState<AnyRow | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => (businessId === 'new' ? Promise.resolve() : api(`/api/admin/businesses/${businessId}/qr`).then((b) => setQr(b.qr)).catch((e) => setError(e.message)));
  useEffect(() => {
    void load();
  }, [businessId]);
  if (businessId === 'new')
    return (
      <Section title="Business QR">
        <p className="text-sm text-slate-500">Save this business first. Its secure QR will be generated automatically.</p>
      </Section>
    );
  const regenerate = async () => {
    if (!window.confirm('Replace this QR? The current printed code will stop working immediately.')) return;
    setBusy(true);
    setError('');
    try {
      const b = await api(`/api/admin/businesses/${businessId}/qr/regenerate`, { method: 'POST' });
      setQr(b.qr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to replace QR.');
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (qr) await navigator.clipboard.writeText(qr.publicUrl);
  };
  const print = () => {
    if (!qr) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(
      `<title>${businessName} QR</title><main style="font-family:system-ui;text-align:center;padding:40px"><h1>${businessName}</h1><p>Scan to view services and join the live queue</p><img src="${qr.downloadImageUrl}" style="width:420px;max-width:90%"><p>${qr.publicUrl}</p></main>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };
  return (
    <Section title="Business QR" subtitle="Customers can scan this code to open this exact business and join its queue.">
      {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!qr ? (
        <div className="py-6 text-slate-500">
          <Loader2 className="animate-spin" size={20} /> Loading secure QR…
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <div className="rounded-2xl border bg-white p-4">
            <img src={qr.previewImageUrl} alt={`${businessName} queue QR`} className="aspect-square w-full" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold">{qr.businessName}</p>
              <p className="text-sm capitalize text-slate-500">
                {qr.businessType} · {qr.status}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Public scan link</p>
              <p className="mt-1 break-all text-sm">{qr.publicUrl}</p>
            </div>
            <p className="text-xs text-slate-500">
              Created {new Date(qr.createdAt).toLocaleString()} · Token ending {qr.publicToken.slice(-6)}
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={qr.downloadImageUrl}
                download={`${businessName}-qr.png`}
                className="flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white"
              >
                <Download size={16} />
                Download
              </a>
              <button onClick={print} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold">
                <Printer size={16} />
                Print
              </button>
              <button onClick={() => void copy()} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold">
                <Copy size={16} />
                Copy link
              </button>
              <button
                disabled={busy}
                onClick={() => void regenerate()}
                className="flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
              >
                <RefreshCw size={16} />
                {busy ? 'Replacing…' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function Customers() {
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (rows.length === 0) setLoading(true);
    setError('');
    try {
      const b = await api('/api/admin/customers');
      setRows(b.customers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rows.length]);

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="mt-1 text-slate-500">Read-only account overview with limited personal data.</p>
        </div>
        {refreshing && <Loader2 className="animate-spin text-teal-600" size={18} />}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
          <span>{error}</span>
          <button onClick={() => void load(true)} className="flex items-center gap-1 font-semibold hover:underline">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Retry
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {['Customer ID', 'Name', 'Verified phone', 'Email', 'Created', 'Bookings'].map((x) => (
                  <th key={x} className="px-4 py-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 animate-spin text-teal-600" size={24} />
                    Loading customer accounts…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No customer accounts found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="max-w-40 truncate px-4 py-4 font-mono text-xs text-slate-500">{r.id}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{r.name || '—'}</td>
                    <td className="px-4 py-4">••••••{String(r.phone_number).slice(-4)}</td>
                    <td className="px-4 py-4 text-slate-600">{r.email || '—'}</td>
                    <td className="px-4 py-4 text-slate-600">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-4 font-semibold text-teal-700">{r.booking_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
