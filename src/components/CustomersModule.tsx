import React, { useEffect, useMemo, useState } from 'react';
import {
  UsersRound,
  CalendarCheck,
  Repeat,
  UserPlus,
  Search,
  Download,
  Scissors,
  User,
  ChevronRight,
  Phone,
} from 'lucide-react';
import { ModalShell } from './ui';
import { fetchCustomerDirectory, type CustomerDirectoryEntry, type CustomerDirectorySummary } from '../services/staffCustomersService';
import {
  buildCustomersCsv,
  buildCustomersExcelXml,
  downloadTextFile,
  filterByRange,
  type ExportRange,
} from '../shared/customerDirectoryExport';
import type { StaffRole } from '../shared/categoryDashboardResolver';

type FilterId = 'all' | 'today' | 'repeat' | 'new';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'repeat', label: 'Repeat' },
  { id: 'new', label: 'New' },
];

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function todayStartMs(): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

const AVATAR_TONES = ['bg-[#EEF1FE] text-[#3454FD]', 'bg-[#FCE9EE] text-[#C22B5C]', 'bg-[#E8F5F0] text-[#1B8A63]', 'bg-[#FDF1DF] text-[#B8720A]'];
function avatarTone(customerId: string): string {
  let hash = 0;
  for (let i = 0; i < customerId.length; i += 1) hash = (hash * 31 + customerId.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

interface CustomersModuleProps {
  role: StaffRole;
}

export const CustomersModule: React.FC<CustomersModuleProps> = ({ role }) => {
  const [summary, setSummary] = useState<CustomerDirectorySummary | null>(null);
  const [customers, setCustomers] = useState<CustomerDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CustomerDirectoryEntry | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const canExport = role === 'owner' || role === 'manager';

  useEffect(() => {
    let cancelled = false;
    fetchCustomerDirectory()
      .then((data) => {
        if (cancelled) return;
        setSummary(data.summary);
        setCustomers(data.customers);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load customers.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const todayMs = todayStartMs();
    return customers.filter((customer) => {
      if (filter === 'today' && customer.lastVisitAt < todayMs) return false;
      if (filter === 'repeat' && customer.tag !== 'repeat') return false;
      if (filter === 'new' && customer.tag !== 'new') return false;
      if (query && !customer.name.toLowerCase().includes(query) && !customer.phone.includes(query)) return false;
      return true;
    });
  }, [customers, filter, search]);

  const tiles: { id: FilterId; label: string; count: number; icon: React.ElementType }[] = [
    { id: 'all', label: 'Total Customers', count: summary?.totalCustomers ?? 0, icon: UsersRound },
    { id: 'today', label: 'Visited Today', count: summary?.visitedToday ?? 0, icon: CalendarCheck },
    { id: 'repeat', label: 'Repeat Customers', count: summary?.repeatCustomers ?? 0, icon: Repeat },
    { id: 'new', label: 'New Customers', count: summary?.newCustomers ?? 0, icon: UserPlus },
  ];

  return (
    <div className="space-y-3 p-4 pb-8">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-[#17201F]">Customers</h2>
          <p className="mt-0.5 text-[11px] font-semibold text-[#6F7C7A]">Manage customer relationships &amp; visit history</p>
        </div>
        {canExport && (
          <button
            id="customers-export-button"
            onClick={() => setExportOpen(true)}
            disabled={loading || customers.length === 0}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#DCE5E3] bg-white px-3 py-2 text-[11px] font-bold text-[#35413F] transition hover:border-[#3454FD]/40 hover:text-[#3454FD] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => {
          const isActive = filter === tile.id;
          const Icon = tile.icon;
          return (
            <button
              key={tile.id}
              onClick={() => setFilter(tile.id)}
              className={`rounded-2xl border p-3 text-left transition ${isActive ? 'border-[#3454FD]/40 bg-[#3454FD]/10' : 'border-[#E1E7E6] bg-white'}`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-[#3454FD]' : 'text-[#7A8785]'}`} />
              <div className={`mt-1.5 text-[10.5px] font-bold ${isActive ? 'text-[#3454FD]' : 'text-[#6F7C7A]'}`}>{tile.label}</div>
              <div className="text-xl font-extrabold text-[#17201F]">{tile.count}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${filter === tab.id ? 'bg-[#3454FD] text-white' : 'border border-[#E1E7E6] bg-white text-[#6F7C7A]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7A8785]" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search customer name or phone"
          className="h-9 w-full rounded-xl border border-[#E1E7E6] bg-white pl-8 pr-3 text-[12px] text-[#17201F] outline-none placeholder:text-[#7A8785] focus:border-[#3454FD]/50"
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#E1E7E6] bg-[#F8FAFA] p-8 text-center text-xs text-[#6F7C7A]">Loading customers…</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-xs font-semibold text-rose-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E1E7E6] bg-[#F8FAFA] p-8 text-center">
          <UsersRound className="mx-auto mb-2 h-8 w-8 text-[#3454FD] opacity-60" />
          <p className="text-xs text-[#6F7C7A]">
            {customers.length === 0 ? 'No completed visits from account-linked customers yet.' : 'Nothing in this view for the selected filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((customer) => (
            <CustomerCard key={customer.customerId} customer={customer} onViewProfile={() => setSelected(customer)} />
          ))}
        </div>
      )}

      {selected && <CustomerProfileSheet customer={selected} onClose={() => setSelected(null)} />}
      {exportOpen && canExport && (
        <ExportSheet
          allCustomers={customers}
          currentView={filtered}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
};

const CustomerCard: React.FC<{ customer: CustomerDirectoryEntry; onViewProfile: () => void }> = ({ customer, onViewProfile }) => (
  <div className="rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-extrabold ${avatarTone(customer.customerId)}`}>
          {initialsOf(customer.name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-extrabold text-[#17201F]">{customer.name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ${customer.tag === 'repeat' ? 'bg-[#EEF1FE] text-[#3454FD]' : 'bg-[#E8F5F0] text-[#1B8A63]'}`}>
              {customer.tag === 'repeat' ? 'Repeat' : 'New'}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#6F7C7A]">
            <Phone className="h-3 w-3" />
            {customer.phone}
          </div>
        </div>
      </div>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-[#43504E]">
      <div className="flex items-center gap-1.5">
        <UsersRound className="h-3.5 w-3.5 shrink-0 text-[#7A8785]" />
        Visits <b className="text-[#17201F]">{customer.totalVisits}</b>
      </div>
      <div className="flex items-center gap-1.5">
        <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-[#7A8785]" />
        Last visit <b className="text-[#17201F]">{formatDate(customer.lastVisitAt)}</b>
      </div>
      {customer.mostUsedService && (
        <div className="col-span-2 flex items-center gap-1.5">
          <Scissors className="h-3.5 w-3.5 shrink-0 text-[#7A8785]" />
          Preferred service <b className="text-[#17201F]">{customer.mostUsedService}</b>
        </div>
      )}
      {customer.usualStaff && (
        <div className="col-span-2 flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 shrink-0 text-[#7A8785]" />
          Usually with <b className="text-[#17201F]">{customer.usualStaff}</b>
        </div>
      )}
      <div className="col-span-2 text-[#6F7C7A]">
        {customer.totalSpendInr != null ? (
          <>Total spent <b className="text-[#17201F]">{formatInr(customer.totalSpendInr)}</b></>
        ) : (
          'Spend unavailable'
        )}
      </div>
    </div>

    <button
      onClick={onViewProfile}
      className="mt-3 flex w-full items-center justify-between rounded-xl border border-[#E1E7E6] bg-[#F8FAFA] px-3 py-2 text-[11.5px] font-bold text-[#3454FD] transition hover:border-[#3454FD]/40"
    >
      View Profile
      <ChevronRight className="h-3.5 w-3.5" />
    </button>
  </div>
);

const CustomerProfileSheet: React.FC<{ customer: CustomerDirectoryEntry; onClose: () => void }> = ({ customer, onClose }) => (
  <ModalShell onClose={onClose} labelledBy="customer-profile-title" className="max-h-[88vh] max-w-md overflow-y-auto">
    <div className="p-5">
      <div className="flex items-center gap-3">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-base font-extrabold ${avatarTone(customer.customerId)}`}>
          {initialsOf(customer.name)}
        </div>
        <div className="min-w-0">
          <h3 id="customer-profile-title" className="truncate text-base font-extrabold text-[#17201F]">{customer.name}</h3>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#6F7C7A]">
            <Phone className="h-3 w-3" />
            {customer.phone}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-[#E1E7E6] bg-[#F8FAFA] p-2.5 text-center">
          <div className="text-base font-extrabold text-[#17201F]">{customer.totalVisits}</div>
          <div className="text-[9.5px] font-bold uppercase tracking-wide text-[#7A8785]">Visits</div>
        </div>
        <div className="rounded-xl border border-[#E1E7E6] bg-[#F8FAFA] p-2.5 text-center">
          <div className="text-base font-extrabold text-[#17201F]">{formatDate(customer.lastVisitAt)}</div>
          <div className="text-[9.5px] font-bold uppercase tracking-wide text-[#7A8785]">Last visit</div>
        </div>
        <div className="rounded-xl border border-[#E1E7E6] bg-[#F8FAFA] p-2.5 text-center">
          <div className="text-base font-extrabold text-[#17201F]">{customer.totalSpendInr != null ? formatInr(customer.totalSpendInr) : '—'}</div>
          <div className="text-[9.5px] font-bold uppercase tracking-wide text-[#7A8785]">Total spent</div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 rounded-xl border border-[#E1E7E6] bg-white p-3 text-[11.5px] text-[#43504E]">
        <div>Customer ID · <span className="font-mono text-[#17201F]">{customer.customerId.slice(0, 12)}</span></div>
        <div>First visit · <b className="text-[#17201F]">{formatDate(customer.firstVisitAt)}</b></div>
        {customer.mostUsedService && <div>Most-used service · <b className="text-[#17201F]">{customer.mostUsedService}</b></div>}
        {customer.usualStaff && <div>Usually served by · <b className="text-[#17201F]">{customer.usualStaff}</b></div>}
      </div>

      <div className="mt-4">
        <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#7A8785]">Visit History</h4>
        <div className="space-y-2">
          {customer.visits.map((visit, idx) => (
            <div key={`${customer.customerId}-${idx}`} className="rounded-xl border border-[#E1E7E6] bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#17201F]">{visit.service}</span>
                <span className="text-[12px] font-extrabold text-[#17201F]">{visit.amountInr != null ? formatInr(visit.amountInr) : '—'}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] font-semibold text-[#6F7C7A]">
                <span>{formatDateTime(visit.date)}</span>
                {visit.staff && <span>&middot; {visit.staff}</span>}
                <span>&middot; {visit.paymentStatus === 'paid' ? `Paid${visit.paymentMethod ? ` (${visit.paymentMethod})` : ''}` : 'Payment unavailable'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </ModalShell>
);

const RANGE_OPTIONS: { id: ExportRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'All' },
];

const ExportSheet: React.FC<{
  allCustomers: CustomerDirectoryEntry[];
  currentView: CustomerDirectoryEntry[];
  onClose: () => void;
}> = ({ allCustomers, currentView, onClose }) => {
  const [scope, setScope] = useState<'view' | 'all'>('view');
  const [format, setFormat] = useState<'csv' | 'excel'>('excel');
  const [range, setRange] = useState<ExportRange>('all');

  const handleExport = () => {
    const base = scope === 'view' ? currentView : allCustomers;
    const rows = filterByRange(base, range);
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      downloadTextFile(`customers-${scope}-${stamp}.csv`, buildCustomersCsv(rows), 'text/csv;charset=utf-8;');
    } else {
      downloadTextFile(`customers-${scope}-${stamp}.xls`, buildCustomersExcelXml(rows), 'application/vnd.ms-excel');
    }
    onClose();
  };

  return (
    <ModalShell onClose={onClose} labelledBy="customers-export-title" className="max-w-sm">
      <div className="p-5">
        <h3 id="customers-export-title" className="text-base font-extrabold text-[#17201F]">Export customers</h3>
        <p className="mt-0.5 text-[11px] font-semibold text-[#6F7C7A]">Download your real customer data — no VIP or loyalty fields.</p>

        <div className="mt-4">
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#7A8785]">What to export</div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setScope('view')}
              className={`rounded-xl border px-3 py-2 text-[11.5px] font-bold ${scope === 'view' ? 'border-[#3454FD]/40 bg-[#3454FD]/10 text-[#3454FD]' : 'border-[#E1E7E6] bg-white text-[#6F7C7A]'}`}
            >
              Current view ({currentView.length})
            </button>
            <button
              onClick={() => setScope('all')}
              className={`rounded-xl border px-3 py-2 text-[11.5px] font-bold ${scope === 'all' ? 'border-[#3454FD]/40 bg-[#3454FD]/10 text-[#3454FD]' : 'border-[#E1E7E6] bg-white text-[#6F7C7A]'}`}
            >
              All customers ({allCustomers.length})
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#7A8785]">Format</div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setFormat('excel')}
              className={`rounded-xl border px-3 py-2 text-[11.5px] font-bold ${format === 'excel' ? 'border-[#3454FD]/40 bg-[#3454FD]/10 text-[#3454FD]' : 'border-[#E1E7E6] bg-white text-[#6F7C7A]'}`}
            >
              Excel (.xls)
            </button>
            <button
              onClick={() => setFormat('csv')}
              className={`rounded-xl border px-3 py-2 text-[11.5px] font-bold ${format === 'csv' ? 'border-[#3454FD]/40 bg-[#3454FD]/10 text-[#3454FD]' : 'border-[#E1E7E6] bg-white text-[#6F7C7A]'}`}
            >
              CSV
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#7A8785]">Range</div>
          <div className="flex flex-wrap gap-1.5">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setRange(option.id)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${range === option.id ? 'bg-[#3454FD] text-white' : 'border border-[#E1E7E6] bg-white text-[#6F7C7A]'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleExport} className="mt-5 w-full rounded-xl bg-[#3454FD] py-3 text-sm font-bold text-white transition hover:bg-[#2746EA] active:scale-[0.99]">
          Download
        </button>
      </div>
    </ModalShell>
  );
};
