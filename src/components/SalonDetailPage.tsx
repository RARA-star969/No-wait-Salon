import React, { useMemo, useState } from 'react';
import { ArrowLeft, Bookmark, CalendarDays, Check, ChevronRight, Clock3, MapPin, Navigation, Phone, Scissors, Share2, Sparkles, Store, Users, X } from 'lucide-react';
import type { Barber, NearbySalon, QueueItem, Salon } from '../types';
import { toSalonProfile, waitLabel as sharedWaitLabel } from '../shared/salonProfile';
import {
  SalonAbout,
  SalonGallery,
  SalonLocationHours,
  SalonServiceMenu,
  SalonOffers,
  SalonStylists,
} from './SalonSections';

type Props = {
  salon: Salon;
  nearbySalons: NearbySalon[];
  queue: QueueItem[];
  barbers: Barber[];
  selectedService: string;
  setSelectedService: (service: string) => void;
  onBack: () => void;
  onJoin: () => void;
  onReserve: () => void;
  userEntry: QueueItem | null;
};

const serviceCategory = (name: string) => {
  const value = name.toLocaleLowerCase();
  if (value.includes('beard')) return 'Beard';
  if (value.includes('massage') || value.includes('spa')) return 'Massage & Spa';
  if (value.includes('colour')) return 'Hair Colour';
  if (value.includes('facial')) return 'Facial';
  return 'Hair Care';
};

export const SalonDetailPage: React.FC<Props> = ({ salon, nearbySalons, queue, barbers, selectedService, setSelectedService, onBack, onJoin, onReserve, userEntry }) => {
  const [saved, setSaved] = useState(false);
  const [visited, setVisited] = useState(false);
  const [payBillOpen, setPayBillOpen] = useState(false);
  const waiting = queue.filter((item) => ['Waiting', 'Called'].includes(item.status));
  const activeBarbers = barbers.filter((barber) => barber.status !== 'unavailable').length;
  const availableBarbers = barbers.filter((barber) => barber.status === 'available').length;
  const waitMinutes = activeBarbers ? Math.ceil(waiting.length * 15 / activeBarbers) : 0;
  // Shared with the public web page so the same salon never reads differently.
  const profile = useMemo(
    () => toSalonProfile(salon, { liveWaitMinutes: waitMinutes, waitingCustomers: waiting.length }),
    [salon, waitMinutes, waiting.length],
  );
  const waitLabel = sharedWaitLabel(waitMinutes);
  const categories = useMemo(() => Array.from(new Set(profile.services.map((service) => serviceCategory(service.name)))), [profile.services]);
  const branches = nearbySalons.filter((item) => item.id !== salon.id && salon.brandKey && item.brandKey === salon.brandKey);

  const directionsUrl = `https://maps.google.com/?q=${salon.latitude},${salon.longitude}`;
  const shareSalon = async () => {
    const shareData = { title: salon.name, text: `${salon.name}\n${salon.address}`, url: directionsUrl };
    if (navigator.share) await navigator.share(shareData).catch(() => undefined);
    else await navigator.clipboard?.writeText(`${shareData.text}\n${shareData.url}`).catch(() => undefined);
  };

  return (
    <div id="customer-salon-screen" className="relative min-h-full bg-[#F5F7F6] pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-[#17201F] animate-in fade-in duration-200">
      <section className="relative min-h-[270px] overflow-hidden bg-[#173B38] text-white">
        {salon.coverImageUrl ? <img src={salon.coverImageUrl} alt={`${salon.name} interior`} className="absolute inset-0 h-full w-full object-cover opacity-80" /> : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_22%,#4A7C76_0,transparent_38%),linear-gradient(145deg,#102B28,#224C47_58%,#C3A66A)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-[#102725]/95" />
        <div className="relative z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button onClick={onBack} id="back-to-salons-btn" aria-label="Back to nearby salons" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex gap-2">
            <button onClick={() => setSaved((value) => !value)} aria-label={saved ? 'Remove saved salon' : 'Save salon'} className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md ${saved ? 'bg-white text-[#0F766E]' : 'bg-black/35 text-white'}`}><Bookmark className={`h-[18px] w-[18px] ${saved ? 'fill-current' : ''}`} /></button>
            <button onClick={shareSalon} aria-label="Share salon" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md"><Share2 className="h-[18px] w-[18px]" /></button>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-5">
          <div className="flex items-end gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/80 bg-[#E3F1EF] text-[#0F766E] shadow-lg">
              {salon.logoImageUrl ? <img src={salon.logoImageUrl} alt={`${salon.name} logo`} className="h-full w-full object-cover" /> : <Scissors className="h-7 w-7" />}
            </div>
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${salon.isOpen ? 'bg-[#5EE0B4]' : 'bg-[#E58C82]'}`} /><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{salon.isOpen ? 'Open now' : 'Closed'}</span></div>
              <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.04em] [overflow-wrap:anywhere]">{salon.name}</h1>
              <p className="mt-1 text-xs font-medium text-white/75">{salon.category || 'Salon & grooming'} · {salon.distanceKm} km away</p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-white/75"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{salon.address}</p>
        </div>
      </section>

      <div className="space-y-5 px-4 py-4">
        <section className="grid grid-cols-4 gap-2">
          <QuickAction icon={<Clock3 />} label={salon.isOpen ? 'Open' : 'Closed'} secondary={salon.openingHours.split('·')[1]?.trim()} />
          <QuickAction icon={<Navigation />} label="Directions" href={directionsUrl} />
          {salon.phoneNumber ? <QuickAction icon={<Phone />} label="Call" href={`tel:${salon.phoneNumber}`} /> : <QuickAction icon={<Store />} label="Branches" disabled={branches.length === 0} secondary={branches.length ? `${branches.length} nearby` : undefined} />}
          <QuickAction icon={<Check />} label={visited ? 'Visited' : 'Been here'} onClick={() => setVisited((value) => !value)} active={visited} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#BFDAD6] bg-[#E6F3F1]">
          <div className="flex items-center justify-between gap-3 p-4">
            <div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#4E7772]">No-Wait live queue</p><h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#125B54]">{waitLabel}</h2><p className="mt-1 text-[11px] text-[#5C7773]">{waiting.length} {waiting.length === 1 ? 'person' : 'people'} ahead · {availableBarbers} of {activeBarbers} chairs ready</p></div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#0F766E] ring-1 ring-[#C6E0DC]"><Users className="h-5 w-5" /></span>
          </div>
          <button onClick={onReserve} className="flex w-full items-center justify-between border-t border-[#C9E2DE] bg-white/45 px-4 py-3 text-xs font-semibold text-[#235E58]"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />Reserve a future queue window</span><ChevronRight className="h-4 w-4" /></button>
        </section>

        <section className="relative aspect-[2.4/1] min-h-[128px] overflow-hidden rounded-2xl bg-gradient-to-r from-[#173E3A] to-[#3F746D] p-5 text-white">
          <div className="max-w-[72%]"><span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider"><Sparkles className="h-3 w-3" />At {salon.name}</span><h2 className="mt-3 text-lg font-bold leading-tight">Your next grooming visit, without the waiting room.</h2></div>
          <Scissors className="absolute -bottom-4 -right-2 h-28 w-28 rotate-[-12deg] text-white/10" />
        </section>

        {/* Shared with the public QR web page. Both render these sections from
            the same salon profile, so an Admin edit lands identically on each
            and neither can drift in layout or hierarchy. */}
        <SalonOffers profile={profile} />

        <section><SectionTitle eyebrow="Explore" title="Services" /><div className="flex gap-2 overflow-x-auto pb-1">{categories.map((category) => <a key={category} href="#salon-service-menu" className="flex min-w-[104px] flex-col items-center rounded-2xl border border-[#E0E7E6] bg-white px-3 py-4 text-center"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E7F3F1] text-[#0F766E]"><Scissors className="h-4 w-4" /></span><span className="mt-2 text-[11px] font-bold">{category}</span></a>)}</div></section>

        <SalonServiceMenu
          profile={profile}
          selectedServiceName={selectedService}
          onSelect={(_id, name) => setSelectedService(name)}
        />

        <SalonStylists barbers={barbers} />

        <SalonGallery profile={profile} />

        <SalonAbout profile={profile} />

        <SalonLocationHours profile={profile} />

        {!!branches.length && <section><SectionTitle eyebrow="More nearby" title="Other branches near you" /><div className="space-y-2">{branches.map((branch) => <div key={branch.id} className="rounded-2xl border border-[#E0E7E6] bg-white p-4"><p className="text-sm font-bold">{branch.name}</p><p className="mt-1 text-[10px] text-[#788582]">{branch.distanceKm} km · {branch.liveWaitMinutes ? `${branch.liveWaitMinutes} min wait` : 'No wait'}</p></div>)}</div></section>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#DDE5E3] bg-white/95 px-3 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto grid max-w-xl grid-cols-[1fr_auto] gap-2">
          <button id="join-live-queue-btn" onClick={onJoin} className="min-h-13 min-w-0 rounded-xl bg-[#0F766E] px-3 text-xs font-bold text-white sm:text-sm">{userEntry ? 'View live queue' : `Join Queue · ${selectedService}`}</button>
          <button onClick={() => setPayBillOpen(true)} className="min-h-13 rounded-xl border border-[#BFD6D2] bg-white px-4 text-xs font-bold text-[#0F766E]">Pay Bill</button>
        </div>
      </div>
      {payBillOpen && <PayBillSheet salonName={salon.name} onClose={() => setPayBillOpen(false)} />}
    </div>
  );
};

const QuickAction: React.FC<{ icon: React.ReactElement; label: string; secondary?: string; href?: string; onClick?: () => void; active?: boolean; disabled?: boolean }> = ({ icon, label, secondary, href, onClick, active, disabled }) => {
  const content = <><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-[#B9E4DC] text-[#075E55]' : 'bg-white/10 text-white'} [&>svg]:h-4 [&>svg]:w-4`}>{icon}</span><span className="mt-2 text-[10px] font-bold leading-tight">{label}</span>{secondary && <span className="mt-0.5 line-clamp-1 text-[8px] text-white/55">{secondary}</span>}</>;
  const classes = `flex min-h-[92px] flex-col items-center rounded-2xl bg-[#1D3734] px-1.5 py-2.5 text-center text-white ${disabled ? 'opacity-45' : ''}`;
  return href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={classes}>{content}</a> : <button type="button" onClick={onClick} disabled={disabled} className={classes}>{content}</button>;
};

const SectionTitle: React.FC<{ eyebrow: string; title: string; secondary?: string }> = ({ eyebrow, title, secondary }) => <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#73827F]">{eyebrow}</p><h2 className="mt-0.5 text-lg font-bold tracking-[-0.025em]">{title}</h2></div>{secondary && <span className="text-[10px] font-semibold text-[#0F766E]">{secondary}</span>}</div>;

const PayBillSheet: React.FC<{ salonName: string; onClose: () => void }> = ({ salonName, onClose }) => {
  const [amount, setAmount] = useState('');
  return <div className="fixed inset-0 z-50 flex items-end bg-black/55" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label="Pay salon bill" className="w-full rounded-t-3xl bg-[#F8FAFA] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"><div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#C9D2D0]" /><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-wider text-[#0F766E]">Pay Bill</p><h2 className="mt-1 text-xl font-bold">{salonName}</h2></div><button onClick={onClose} aria-label="Close Pay Bill" className="flex h-9 w-9 items-center justify-center rounded-full bg-white"><X className="h-4 w-4" /></button></div><label className="mt-5 block text-xs font-semibold">Bill amount</label><div className="mt-2 flex h-14 items-center rounded-xl border border-[#D8E2E0] bg-white px-4"><span className="text-lg font-bold">₹</span><input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, '').slice(0, 7))} inputMode="numeric" placeholder="0" className="h-full min-w-0 flex-1 bg-transparent px-2 text-xl font-bold outline-none" /></div><div className="mt-4 rounded-xl border border-[#DCE5E3] bg-white p-3 text-[11px] leading-5 text-[#647370]">Secure payment provider is not connected yet. No payment will be processed or marked successful from this preview.</div><button disabled className="mt-4 h-12 w-full rounded-xl bg-[#0F766E] text-sm font-bold text-white opacity-45">Continue to secure payment</button></section></div>;
};
