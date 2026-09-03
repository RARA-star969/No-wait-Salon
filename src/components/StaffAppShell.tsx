import React, { useState, useEffect } from 'react';
import { StaffDashboard } from './StaffDashboard';
import { GymDashboardView } from './GymDashboardView';
import { Salon, QueueItem, Barber, SalonOffer } from '../types';
import { validateBusinessCode } from '../shared/businessCodeValidation';

interface StaffSession {
  token: string;
  staff: { id: string; email: string; name: string; role: string };
  business: { id: string; name: string; mainCategoryId: string; onboarded: boolean; businessCode: string; profileCompletedAt: number | null };
}

interface StaffAppShellProps {
  testBusinessId?: string;
  testRole?: string;
  // Rendered inside the hosted TEST Staff preview panel rather than as the
  // real full-screen business surface. Only ever passed from the TEST
  // wrapper in App.tsx — never set for the real production/Android surface.
  embedded?: boolean;
  salon: Salon;
  queue: QueueItem[];
  barbers: Barber[];
  completedList: QueueItem[];
  onBarberToggle: (idx: number) => void;
  onAddWalkin: (name: string, phone: string, service: string, startImmediately?: boolean, selectedBarberIndex?: number) => void;
  onQueueAction: (item: QueueItem, action: any, reason?: any, specificBarberIndex?: number) => void;
  queueAlert: string;
  onSaveStaff: (staff: Barber[]) => void;
  onSaveOffers: (offers: SalonOffer[]) => void;
  onBusinessResolved?: (business: StaffSession['business']) => void;
}

export const StaffAppShell: React.FC<StaffAppShellProps> = (props) => {
  const [gymModule, setGymModule] = useState('overview');
  const [session, setSession] = useState<StaffSession | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Step 1: Business ID
  const [businessCode, setBusinessCode] = useState('');
  const [resolvedBusiness, setResolvedBusiness] = useState<{id: string, name: string, mainCategoryId: string, businessCode: string} | null>(null);
  const [codeError, setCodeError] = useState('');
  const [resolvingCode, setResolvingCode] = useState(false);

  // Step 2: Login
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 3: Setup
  const [setupForm, setSetupForm] = useState({
    name: '',
    description: '',
    address: '',
    opening_hours: 'Mon-Sun 6:00 AM-10:00 PM',
  });
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [skipSetup, setSkipSetup] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setGymModule('overview');
    setSkipSetup(false);
    if (!props.testBusinessId) { void checkSession(); return; }
    void fetch(      `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/staff/test-login`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: props.testBusinessId, role: props.testRole || 'owner' }) }
    ).then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Test login unavailable'); if (!active) return; localStorage.setItem('no_wait_salon_staff_token', data.token); setSession(data); setSetupForm(prev => ({ ...prev, name: data.business.name })); setSkipSetup(true); }).catch(error => { if (active) { setSession(null); setAuthError(error.message); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [props.testBusinessId, props.testRole]);

  const checkSession = async () => {
    try {
      const token = localStorage.getItem('no_wait_salon_staff_token') || '';
      const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/staff/session`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        props.onBusinessResolved?.(data.business);
        setSetupForm(prev => ({ ...prev, name: data.business.name }));
      } else {
        setSession(null);
      }
    } catch (err) {
      console.error('Session check failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');
    setResolvingCode(true);
    try {
      const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/staff/resolve-business/${encodeURIComponent(businessCode)}`);
      const data = await res.json();
      if (res.ok) {
        setResolvedBusiness(data);
      } else {
        setCodeError(data.error || 'Business not found.');
      }
    } catch (err) {
      setCodeError('Network error');
    } finally {
      setResolvingCode(false);
    }
  };

  
  const handleTestLogin = async () => {
    if (!resolvedBusiness) {
      setAuthError('No business resolved');
      return;
    }
    try {
      const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/staff/test-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessCode: resolvedBusiness!.businessCode })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('no_wait_salon_staff_token', data.token);
        await checkSession(); // refetch full session
      } else {
        setAuthError(data.error || 'Test login failed');
      }
    } catch (err) {
      setAuthError('Network error');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessCode: resolvedBusiness!.businessCode, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('no_wait_salon_staff_token', data.token);
        await checkSession();
        setSkipSetup(false);
      } else {
        setAuthError(data.error || 'Login failed');
      }
    } catch (err) {
      setAuthError('Network error');
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('no_wait_salon_staff_token');
    if (token) {
      await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/staff/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    localStorage.removeItem('no_wait_salon_staff_token');
    setSession(null);
    setResolvedBusiness(null);
    setGymModule('overview');
    setSkipSetup(false);
  };

  const handleSetupComplete = async (e: React.FormEvent, isSkip: boolean) => {
    e.preventDefault();
    if (isSkip) {
      setSkipSetup(true);
      setShowSetup(false);
      return;
    }

    setSetupSubmitting(true);
    try {
      const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/staff/business/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token}`
        },
        body: JSON.stringify({ ...setupForm, markComplete: true })
      });
      if (res.ok) {
        await checkSession();
        setShowSetup(false);
      } else {
        alert('Failed to save profile details.');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setSetupSubmitting(false);
    }
  };

  if (loading) {
    return <div className={`flex items-center justify-center bg-[#F4F7F6] text-[#5C6E6B] ${props.embedded ? 'h-full' : 'h-screen'}`}>Loading Staff App...</div>;
  }

  // 1. Business ID Flow
  if (!session && !resolvedBusiness) {
    return (
      <div className="flex h-full min-h-screen w-full items-center justify-center bg-[#F4F7F6] p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[#17201F]">Enter Business ID</h1>
            <p className="mt-2 text-sm text-[#5C6E6B]">Enter your unique workspace code to continue.</p>
          </div>
          {authError && <div role="alert" className="mb-4 text-sm text-red-600">{authError}</div>}
          {codeError && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{codeError}</div>}
          <form onSubmit={handleResolveBusiness} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#5C6E6B]">Business ID</label>
              <input
                type="text"
                value={businessCode}
                onChange={e => setBusinessCode(e.target.value)}
                placeholder="e.g. IRONHOUSE01"
                className="mt-1 w-full rounded-xl border border-[#DDE5E3] bg-[#F8FAFA] px-4 py-2.5 text-sm text-[#17201F]"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </div>
            <button type="submit" disabled={resolvingCode} className="w-full rounded-xl bg-[#0F766E] py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50">
              {resolvingCode ? 'Checking...' : 'Continue'}
            </button>
          </form>
          
        </div>
      </div>
    );
  }

  // 2. Staff Login Flow
  if (!session && resolvedBusiness) {
    return (
      <div className="flex h-full min-h-screen w-full items-center justify-center bg-[#F4F7F6] p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
          <button onClick={() => setResolvedBusiness(null)} className="mb-6 text-[11px] font-bold text-[#0F766E]">← Back</button>
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[#17201F]">{resolvedBusiness.name}</h1>
            <p className="mt-2 text-sm uppercase tracking-widest text-[#5C6E6B]">{resolvedBusiness.mainCategoryId}</p>
          </div>
          {authError && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{authError}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#5C6E6B]">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#DDE5E3] bg-[#F8FAFA] px-4 py-2.5 text-sm text-[#17201F]"
                required 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#5C6E6B]">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#DDE5E3] bg-[#F8FAFA] px-4 py-2.5 text-sm text-[#17201F]"
                required 
              />
            </div>
            <button type="submit" className="w-full rounded-xl bg-[#0F766E] py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98]">
              Sign In
            </button>
          </form>
          {import.meta.env.VITE_TEST_BUILD === 'true' && (
            <div className="mt-6 border-t border-[#EAEFEF] pt-4">
              <button onClick={handleTestLogin} className="w-full rounded-xl bg-orange-100 py-3 text-sm font-bold text-orange-800 shadow-sm transition active:scale-[0.98]">
                Continue as TEST Owner
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Business Onboarding Flow (First-login setup)
  const isProfileIncomplete = !session!.business.profileCompletedAt && ['owner', 'manager'].includes(session!.staff.role);
  const shouldShowSetup = isProfileIncomplete && (!skipSetup || showSetup);

  if (shouldShowSetup) {
    return (
      <div className="flex h-full min-h-screen w-full items-center justify-center bg-[#F4F7F6] p-4">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-[#17201F]">Complete your setup</h1>
            <p className="mt-2 text-sm text-[#5C6E6B]">Please provide the public details for {session!.business.name} before accessing the dashboard.</p>
          </div>
          <form onSubmit={(e) => handleSetupComplete(e, false)} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#5C6E6B]">Business Name (Public)</label>
              <input 
                type="text" 
                value={setupForm.name} 
                onChange={e => setSetupForm({...setupForm, name: e.target.value})}
                className="mt-1 w-full rounded-xl border border-[#DDE5E3] bg-[#F8FAFA] px-4 py-2 text-sm text-[#17201F]"
                required 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#5C6E6B]">Description</label>
              <textarea 
                value={setupForm.description} 
                onChange={e => setSetupForm({...setupForm, description: e.target.value})}
                className="mt-1 w-full rounded-xl border border-[#DDE5E3] bg-[#F8FAFA] px-4 py-2 text-sm text-[#17201F] h-24"
                placeholder="Describe your facility..."
                required 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#5C6E6B]">Address</label>
              <input 
                type="text" 
                value={setupForm.address} 
                onChange={e => setSetupForm({...setupForm, address: e.target.value})}
                className="mt-1 w-full rounded-xl border border-[#DDE5E3] bg-[#F8FAFA] px-4 py-2 text-sm text-[#17201F]"
                required 
              />
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <button 
                type="submit" 
                disabled={setupSubmitting}
                className="w-full rounded-xl bg-[#0F766E] py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
              >
                {setupSubmitting ? 'Saving...' : 'Save & Continue'}
              </button>
              <button 
                type="button" 
                onClick={(e) => handleSetupComplete(e, true)}
                className="w-full rounded-xl bg-[#F4F7F6] py-3 text-sm font-bold text-[#5C6E6B] shadow-sm transition active:scale-[0.98]"
              >
                Skip for now
              </button>
            </div>
          </form>
          <div className="mt-6 border-t border-[#EAEFEF] pt-4 text-center">
            <button onClick={handleLogout} className="text-xs font-bold text-red-600">Sign Out</button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Normal Authorized Staff Dashboard
  const isGym = session!.business.mainCategoryId === 'gym';
  if (isGym) return <GymDashboardView key={session!.business.id} gymId={session!.business.id} gymName={session!.business.name} role={session!.staff.role as any} staffName={session!.staff.name} activeModule={gymModule} onModuleSelect={setGymModule} onSignOut={handleLogout} onSetup={() => setShowSetup(true)} profileIncomplete={isProfileIncomplete} embedded={props.embedded} />;

  const activeBusinessSalon: Salon = {
    ...props.salon,
    id: session!.business.id,
    name: session!.business.name,
    mainCategoryId: session!.business.mainCategoryId,
  };

  return (
    // A bounded, dynamic-viewport height (not h-full/min-h-screen, which
    // resolve to the content's own height without a percentage-height
    // ancestor chain) is what lets <main> below be the single real scroll
    // container — see the scroll-bug note on its overflow-y-auto.
    <div className="flex h-dvh w-full flex-col bg-[#F4F7F6]">
      {isProfileIncomplete && (
        <div className="bg-[#FFF8E6] px-4 py-2 text-center text-sm font-medium text-[#B45309] flex justify-between items-center">
          <span>Business profile incomplete</span>
          <button onClick={() => setShowSetup(true)} className="underline font-bold">Complete setup</button>
        </div>
      )}
      {/* Top Header Shell */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#DDE5E3] bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#3454FD] text-white font-bold uppercase">
            {session!.business.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#17201F]">{session!.business.name}</h1>
            <p className="text-[10px] text-[#5C6E6B]">{session!.staff.name} ({session!.staff.role})</p>
          </div>
        </div>
        <button onClick={handleLogout} className="rounded-lg bg-gray-100 px-3 py-1.5 text-[11px] font-bold text-gray-700">
          Sign Out
        </button>
      </header>
      
      {/* Dynamic Category Render — the single scroll container for the whole
          Salon dashboard. min-h-0 overrides a flex item's default
          min-height:auto, which otherwise stops it from shrinking below its
          content size and silently defeats overflow-y-auto. */}
      <main className="min-h-0 flex-1 overflow-y-auto">
          <StaffDashboard 
            salon={activeBusinessSalon}
            queue={props.queue}
            barbers={props.barbers}
            completedList={props.completedList}
            onBarberToggle={props.onBarberToggle}
            onAddWalkin={props.onAddWalkin}
            onQueueAction={props.onQueueAction}
            queueAlert={props.queueAlert}
            onSaveStaff={props.onSaveStaff}
            onSaveOffers={props.onSaveOffers}
          />

      </main>
    </div>
  );
};
