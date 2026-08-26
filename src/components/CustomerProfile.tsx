import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BadgeCheck, CalendarDays, Camera, CheckCircle2, ChevronRight, CircleUserRound, Dumbbell, LoaderCircle, LogOut, Mail, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react';
import type { CustomerAuthSession, CustomerProfile } from '../types';
import { customerAccountService } from '../services/customerAccountService';
import { gymCustomerService, GymMembershipView } from '../services/gymCustomerService';

type Props = {
  mode: 'profile' | 'edit';
  auth: CustomerAuthSession | null;
  profile: CustomerProfile | null;
  loading: boolean;
  error: string;
  onBack: () => void;
  onEdit: () => void;
  onLogin: () => void;
  onSaved: (profile: CustomerProfile) => void;
  onLogout: () => void;
};

const fieldsComplete = (profile: CustomerProfile | null) => profile
  ? [profile.name, profile.profilePhotoUrl, profile.email, profile.dateOfBirth].filter(Boolean).length
  : 0;

const Avatar: React.FC<{ profile: CustomerProfile | null; editable?: boolean; onClick?: () => void }> = ({ profile, editable, onClick }) => {
  const [photoSrc, setPhotoSrc] = useState('');
  const initials = profile?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '';
  useEffect(() => {
    let objectUrl = '';
    if (!profile?.profilePhotoUrl) { setPhotoSrc(''); return; }
    customerAccountService.getPhotoObjectUrl().then((url) => { objectUrl = url; setPhotoSrc(url); }).catch(() => setPhotoSrc(''));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [profile?.profilePhotoUrl, profile?.updatedAt]);
  return (
    <button type="button" onClick={onClick} disabled={!editable} aria-label={editable ? 'Change profile photo' : 'Profile photo'}
      className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#DFF0ED] text-2xl font-bold text-[#0F766E] ring-1 ring-[#C6DEDA] disabled:cursor-default">
      {photoSrc ? <img src={photoSrc} alt="Customer profile" className="h-full w-full object-cover" />
        : initials || <UserRound className="h-10 w-10" />}
      {editable && <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#0F766E] text-white ring-2 ring-white"><Camera className="h-4 w-4" /></span>}
    </button>
  );
};

export const CustomerProfileScreen: React.FC<Props> = ({ mode, auth, profile, loading, error, onBack, onEdit, onLogin, onSaved, onLogout }) => {
  const [form, setForm] = useState({ name: '', email: '', dateOfBirth: '', gender: '', anniversary: '', city: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [gymMemberships, setGymMemberships] = useState<{ gymId: string; gymName: string; membership: GymMembershipView }[] | null>(null);
  const [gymMembershipsOpen, setGymMembershipsOpen] = useState(false);
  const [gymMembershipsLoading, setGymMembershipsLoading] = useState(false);

  const toggleGymMemberships = async () => {
    if (gymMembershipsOpen) { setGymMembershipsOpen(false); return; }
    setGymMembershipsOpen(true);
    if (gymMemberships) return;
    setGymMembershipsLoading(true);
    try {
      const data = await gymCustomerService.getMyGymMemberships();
      setGymMemberships(data.memberships);
    } catch {
      setGymMemberships([]);
    } finally {
      setGymMembershipsLoading(false);
    }
  };

  useEffect(() => {
    if (!profile) return;
    setForm({ name: profile.name, email: profile.email, dateOfBirth: profile.dateOfBirth, gender: profile.gender, anniversary: profile.anniversary, city: profile.city });
  }, [profile]);

  const completed = fieldsComplete(profile);
  const percentage = completed * 25;
  const title = completed === 4 ? 'Profile complete' : profile?.name ? 'Update your profile' : 'Complete your profile';
  const maxBirthDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 13);
    return date.toISOString().slice(0, 10);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.name && form.name.trim().length < 2) return setFormError('Enter at least 2 characters for your name.');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setFormError('Enter a valid email address.');
    setSaving(true); setFormError('');
    try { onSaved(await customerAccountService.updateProfile({ ...form, name: form.name.trim(), email: form.email.trim() })); }
    catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Unable to save your profile.'); }
    finally { setSaving(false); }
  };

  const uploadPhoto = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setFormError('Choose a JPEG, PNG, or WebP image.');
    if (file.size > 256 * 1024) return setFormError('Profile photo must be smaller than 256 KB.');
    const reader = new FileReader();
    reader.onload = async () => {
      setPhotoUploading(true); setFormError('');
      try { onSaved(await customerAccountService.uploadPhoto(String(reader.result))); }
      catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Unable to upload the photo.'); }
      finally { setPhotoUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  if (!auth) return (
    <div id="customer-profile-screen" className="min-h-full bg-[#F8FAFA] px-5 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE5E3] bg-white" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
      <div className="mx-auto flex max-w-sm flex-col items-center px-3 pt-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#E2F2EF] text-[#0F766E]"><CircleUserRound className="h-9 w-9" /></div>
        <h1 className="mt-5 text-2xl font-bold tracking-[-0.035em]">Your personal salon account</h1>
        <p className="mt-2 text-sm leading-6 text-[#6B7977]">Verify your mobile number to view bookings and keep your profile safely synced.</p>
        <button onClick={onLogin} className="mt-7 h-12 w-full rounded-xl bg-[#0F766E] text-sm font-bold text-white">Verify mobile number</button>
      </div>
    </div>
  );

  if (loading || !profile) return <div className="flex min-h-full items-center justify-center bg-[#F8FAFA]"><LoaderCircle className="h-6 w-6 animate-spin text-[#0F766E]" /></div>;

  if (mode === 'edit') return (
    <form id="customer-edit-profile-screen" onSubmit={submit} className="min-h-full bg-[#F8FAFA] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[#E2E8E7] bg-white/95 px-4 py-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur">
        <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE5E3]" aria-label="Back to profile"><ArrowLeft className="h-4 w-4" /></button>
        <div><h1 className="text-lg font-bold">Edit profile</h1><p className="text-[10px] text-[#71807E]">Keep your details up to date</p></div>
      </div>
      <div className="mx-auto max-w-md space-y-5 px-4 py-6">
        <div className="flex flex-col items-center">
          <Avatar profile={profile} editable onClick={() => fileRef.current?.click()} />
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} />
          <p className="mt-2 text-[10px] text-[#788582]">JPEG, PNG or WebP · Max 256 KB</p>
          {photoUploading && <p className="mt-1 text-xs font-semibold text-[#0F766E]">Uploading photo…</p>}
        </div>
        <div className="space-y-4 rounded-2xl border border-[#E0E7E6] bg-white p-4">
          <ProfileInput label="Full name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="Your full name" icon={<UserRound />} autoComplete="name" />
          <ProfileInput label="Verified mobile number" value={`+91 ${profile.phoneNumber}`} icon={<Phone />} disabled helper="Verified with OTP. Contact support to change this number." />
          <ProfileInput label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} placeholder="you@example.com" icon={<Mail />} type="email" autoComplete="email" />
          <ProfileInput label="Date of birth" value={form.dateOfBirth} onChange={(value) => setForm({ ...form, dateOfBirth: value })} icon={<CalendarDays />} type="date" max={maxBirthDate} />
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Gender <span className="font-normal text-[#8A9694]">(optional)</span></label>
            <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} className="h-12 w-full rounded-xl border border-[#DCE5E3] bg-white px-3 text-sm outline-none focus:border-[#62AAA3]">
              <option value="">Prefer not to say</option><option value="Woman">Woman</option><option value="Man">Man</option><option value="Non-binary">Non-binary</option>
            </select>
          </div>
          <ProfileInput label="Anniversary (optional)" value={form.anniversary} onChange={(value) => setForm({ ...form, anniversary: value })} icon={<CalendarDays />} type="date" max={new Date().toISOString().slice(0, 10)} />
          <ProfileInput label="City or area (optional)" value={form.city} onChange={(value) => setForm({ ...form, city: value })} placeholder="Indiranagar, Bengaluru" icon={<MapPin />} autoComplete="address-level2" />
        </div>
        {(formError || error) && <div role="alert" className="rounded-xl border border-[#F0D6D1] bg-[#FFF7F5] p-3 text-xs text-[#8A3E35]">{formError || error}</div>}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E0E7E6] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button disabled={saving || photoUploading} className="mx-auto flex h-12 w-full max-w-md items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-sm font-bold text-white disabled:opacity-60">
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  );

  return (
    <div id="customer-profile-screen" className="min-h-full bg-[#F8FAFA] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="bg-gradient-to-b from-[#DFF1EE] to-[#F8FAFA] px-4 pb-7 pt-[max(1rem,env(safe-area-inset-top))]">
        <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white/80" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
        <div className="mt-5 flex flex-col items-center text-center">
          <Avatar profile={profile} />
          <h1 className="mt-3 text-2xl font-bold tracking-[-0.035em]">{profile.name || 'Welcome to No-Wait Salon'}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#58706D]"><ShieldCheck className="h-3.5 w-3.5 text-[#0F766E]" />+91 {profile.phoneNumber} · Verified</p>
        </div>
      </div>
      <div className="mx-auto -mt-2 max-w-md space-y-4 px-4">
        <button onClick={onEdit} className="w-full rounded-2xl border border-[#CBE0DD] bg-white p-4 text-left">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs text-[#71807E]">{completed === 4 ? 'All essential details added' : `${completed} / 4 steps completed`}</p></div><ChevronRight className="h-5 w-5 text-[#0F766E]" /></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E6EEEC]"><div className="h-full rounded-full bg-[#0F766E] transition-all" style={{ width: `${percentage}%` }} /></div>
        </button>
        <div className="overflow-hidden rounded-2xl border border-[#E0E7E6] bg-white">
          <ProfileRow icon={<UserRound />} label="My profile" onClick={onEdit} />
          <ProfileRow icon={<CalendarDays />} label="My bookings & history" secondary="Linked to your verified account" />
          <ProfileRow icon={<Dumbbell />} label="My Memberships" secondary="Gym plans linked to your account" onClick={toggleGymMemberships} />
        </div>
        {gymMembershipsOpen && (
          <div className="rounded-2xl border border-[#E0E7E6] bg-white p-4">
            {gymMembershipsLoading ? (
              <div className="flex items-center justify-center py-4"><LoaderCircle className="h-5 w-5 animate-spin text-[#0F766E]" /></div>
            ) : !gymMemberships || gymMemberships.length === 0 ? (
              <p className="text-xs text-[#71807E]">No gym memberships linked to this account yet.</p>
            ) : (
              <div className="space-y-3">
                {gymMemberships.map((entry) => (
                  <div key={entry.gymId} className="rounded-xl border border-[#E0E7E6] p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <BadgeCheck className="h-3.5 w-3.5 text-[#0F766E]" />
                        <span className="text-xs font-bold text-[#17201F]">{entry.gymName}</span>
                      </div>
                      <span className={`rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                        entry.membership.displayStatus === 'expired' ? 'bg-rose-50 text-rose-700'
                        : entry.membership.displayStatus === 'expires_today' || entry.membership.displayStatus === 'expiring_soon' ? 'bg-amber-50 text-amber-800'
                        : 'bg-[#E7F5F2] text-[#0F766E]'
                      }`}>
                        {entry.membership.displayStatus === 'expired' ? 'Expired' : entry.membership.displayStatus === 'expires_today' ? 'Expires today' : entry.membership.displayStatus === 'expiring_soon' ? 'Expiring soon' : 'Active'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#71807E]">{entry.membership.planName} · Joined {new Date(entry.membership.joinedDate).toLocaleDateString()}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#17201F]">
                      {entry.membership.displayStatus === 'expired'
                        ? `Expired on ${new Date(entry.membership.expiryDate).toLocaleDateString()}`
                        : `${entry.membership.daysRemaining} day${entry.membership.daysRemaining === 1 ? '' : 's'} left · valid till ${new Date(entry.membership.expiryDate).toLocaleDateString()}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {error && <div role="alert" className="rounded-xl border border-[#F0D6D1] bg-[#FFF7F5] p-3 text-xs text-[#8A3E35]">{error}</div>}
        <button onClick={onLogout} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#E7D6D3] bg-white text-sm font-bold text-[#934A40]"><LogOut className="h-4 w-4" />Log out</button>
      </div>
    </div>
  );
};

const ProfileRow: React.FC<{ icon: React.ReactElement; label: string; secondary?: string; onClick?: () => void }> = ({ icon, label, secondary, onClick }) => (
  <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 border-b border-[#EDF1F0] px-4 text-left last:border-0">
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E9F4F2] text-[#0F766E] [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span>{secondary && <span className="block truncate text-[10px] text-[#7A8785]">{secondary}</span>}</span>
    <ChevronRight className="h-4 w-4 text-[#9AA6A4]" />
  </button>
);

type InputProps = { label: string; value: string; onChange?: (value: string) => void; placeholder?: string; icon: React.ReactElement; type?: string; disabled?: boolean; helper?: string; autoComplete?: string; max?: string };
const ProfileInput: React.FC<InputProps> = ({ label, value, onChange, placeholder, icon, type = 'text', disabled, helper, autoComplete, max }) => (
  <div><label className="mb-1.5 block text-xs font-semibold">{label}</label><div className={`flex min-h-12 items-center gap-2.5 rounded-xl border border-[#DCE5E3] px-3 ${disabled ? 'bg-[#F3F6F5]' : 'bg-white focus-within:border-[#62AAA3]'}`}><span className="text-[#71908C] [&>svg]:h-4 [&>svg]:w-4">{icon}</span><input value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} type={type} disabled={disabled} autoComplete={autoComplete} max={max} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9AA6A4] disabled:text-[#60706E]" /></div>{helper && <p className="mt-1 text-[10px] leading-4 text-[#7A8785]">{helper}</p>}</div>
);
