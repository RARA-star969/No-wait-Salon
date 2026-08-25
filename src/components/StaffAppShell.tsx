import React, { useState, useEffect } from 'react';
import { StaffDashboard } from './StaffDashboard';
import { GymDashboardView } from './GymDashboardView';
import { Salon, QueueItem, Barber, SalonOffer } from '../types';

interface StaffSession {
  token: string;
  staff: { id: string; email: string; name: string; role: string };
  business: { id: string; name: string; mainCategoryId: string; onboarded: boolean };
}

interface StaffAppShellProps {
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
}

export const StaffAppShell: React.FC<StaffAppShellProps> = (props) => {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  
  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Onboarding form state
  const [setupForm, setSetupForm] = useState({
    name: '',
    description: '',
    address: '',
    opening_hours: 'Mon-Sun 6:00 AM-10:00 PM',
  });
  const [setupSubmitting, setSetupSubmitting] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const token = localStorage.getItem('no_wait_salon_staff_token') || '';
      const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/staff/session`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('no_wait_salon_staff_token', data.token);
        setSession(data);
        setSetupForm(prev => ({ ...prev, name: data.business.name }));
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
  };

  const handleSetupComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupSubmitting(true);
    try {
      const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api/staff/business/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token}`
        },
        body: JSON.stringify(setupForm)
      });
      if (res.ok) {
        await checkSession();
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
    return <div className="flex h-screen items-center justify-center bg-[#F4F7F6] text-[#5C6E6B]">Loading Staff App...</div>;
  }

  // 1. Staff Login Flow
  if (!session) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#F4F7F6] p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[#17201F]">Staff Login</h1>
            <p className="mt-2 text-sm text-[#5C6E6B]">Sign in to manage your business</p>
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
          <div className="mt-6 text-center text-[11px] text-[#778481]">
            Don't have an account? Your Admin must invite you.
          </div>
        </div>
      </div>
    );
  }

  // 2. Business Onboarding Flow (First-login setup)
  if (!session.business.onboarded) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#F4F7F6] p-4">
        <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-[#17201F]">Complete your setup</h1>
            <p className="mt-2 text-sm text-[#5C6E6B]">Please provide the public details for {session.business.name} before accessing the dashboard.</p>
          </div>
          <form onSubmit={handleSetupComplete} className="space-y-4">
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
            <button 
              type="submit" 
              disabled={setupSubmitting}
              className="w-full rounded-xl bg-[#0F766E] py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              {setupSubmitting ? 'Saving...' : 'Complete Setup & Go to Dashboard'}
            </button>
          </form>
          <div className="mt-6 border-t border-[#EAEFEF] pt-4 text-center">
            <button onClick={handleLogout} className="text-xs font-bold text-red-600">Sign Out</button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Normal Authorized Staff Dashboard
  const isGym = session.business.mainCategoryId === 'gym';

  return (
    <div className="flex h-full w-full flex-col bg-[#F4F7F6]">
      {/* Top Header Shell */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#DDE5E3] bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#0F766E] text-white font-bold">
            {session.business.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#17201F]">{session.business.name}</h1>
            <p className="text-[10px] text-[#5C6E6B]">{session.staff.name} ({session.staff.role})</p>
          </div>
        </div>
        <button onClick={handleLogout} className="rounded-lg bg-gray-100 px-3 py-1.5 text-[11px] font-bold text-gray-700">
          Sign Out
        </button>
      </header>
      
      {/* Dynamic Category Render */}
      <main className="flex-1 overflow-y-auto">
        {isGym ? (
          <GymDashboardView 
            gymId={session.business.id}
            gymName={session.business.name}
            role={session.staff.role as any}
            staffName={session.staff.name}
            activeModule="overview"
            onModuleSelect={() => {}}
          />
        ) : (
          <StaffDashboard 
            salon={props.salon}
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
        )}
      </main>
    </div>
  );
};
