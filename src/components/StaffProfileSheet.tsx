import React, { useEffect, useState } from 'react';
import { Award, Briefcase, Calendar, Check, ChevronRight, Clock, Heart, LoaderCircle, Scissors, Sparkles, Star, Ticket, User, X } from 'lucide-react';
import type { Barber, ServiceItem } from '../types';
import { LIVE_QUEUE_GRADIENT, LIVE_QUEUE_RIM_FULL } from '../shared/liveQueueVisual';

type Props = {
  open: boolean;
  barber: Barber | null;
  allServices: ServiceItem[];
  selectable: boolean;
  isSelected: boolean;
  busy?: boolean;
  onSelectAndConfirm: (barberId: string) => void;
  onClose: () => void;
};

const STATUS_LABEL: Record<Barber['status'], string> = {
  available: 'Available Now',
  busy: 'In Chair',
  unavailable: 'Off Duty',
};

const STATUS_PILL: Record<Barber['status'], string> = {
  available: 'bg-[#E7F5F2] text-[#0F766E] border border-[#0F766E]/20',
  busy: 'bg-[#FAF0E6] text-[#A66020] border border-[#A66020]/20',
  unavailable: 'bg-[#EEF3F2] text-[#6F7C7A] border border-[#6F7C7A]/20',
};

const STATUS_DOT: Record<Barber['status'], string> = {
  available: 'bg-[#0F766E]',
  busy: 'bg-[#A66020]',
  unavailable: 'bg-[#9AA6A3]',
};

export const StaffProfileSheet: React.FC<Props> = ({
  open,
  barber,
  allServices,
  selectable,
  isSelected,
  busy,
  onSelectAndConfirm,
  onClose,
}) => {
  const [mounted, setMounted] = useState(open);
  const [active, setActive] = useState(open);

  useEffect(() => {
    if (open && barber) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setActive(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setActive(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open, barber]);

  const handleClose = () => {
    setActive(false);
    setTimeout(() => {
      onClose();
    }, 280);
  };

  if (!mounted || !barber) return null;

  const rating = barber.rating ?? 4.8;
  const reviewCount = barber.reviewCount ?? 85;
  const experienceYears = barber.experienceYears ?? 4;
  const role = barber.role || 'Barber & Stylist';
  const bio = barber.bio || `${barber.name} is a dedicated grooming professional at No-Wait Salon specializing in precision haircuts, beard styling, and personalized customer care.`;

  // Services this stylist is configured to perform
  const matchedServices = (barber.serviceIds || []).length > 0
    ? allServices.filter((s) => barber.serviceIds?.includes(s.id))
    : allServices;

  const specialties = barber.specialties && barber.specialties.length > 0
    ? barber.specialties
    : ['Precision Haircut', 'Beard Styling', 'Scalp Care', 'Classic Grooming'];

  const handleChoose = () => {
    if (selectable && !busy) {
      onSelectAndConfirm(barber.id);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[105] flex items-end justify-center bg-slate-950/60 transition-opacity duration-300 ease-out sm:items-center motion-reduce:transition-none ${
        active ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <button type="button" aria-label="Close" onClick={handleClose} className="absolute inset-0 cursor-default" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Stylist Profile - ${barber.name}`}
        id="staff-profile-sheet"
        className={`relative flex max-h-[calc(100dvh-4.5rem)] w-full flex-col rounded-t-3xl bg-[#F8FAFA] shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:max-h-[85vh] sm:max-w-md sm:rounded-3xl motion-reduce:transition-none motion-reduce:transform-none ${
          active ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-full opacity-90 sm:translate-y-4 sm:scale-95'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2EAE9] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#E5F3F1] text-[#0F766E]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0F766E]">Stylist Profile</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close profile"
            className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#42524F] ring-1 ring-[#E2EAE9] transition hover:bg-[#F0F6F5]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Stylist Hero Card */}
          <div className="rounded-2xl border border-[#E1E7E6] bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="relative shrink-0">
                {barber.photoUrl ? (
                  <img src={barber.photoUrl} alt={barber.name} className="h-16 w-16 rounded-2xl object-cover ring-2 ring-[#0F766E]/20" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#173B38] to-[#3F746D] text-xl font-bold text-white shadow-inner">
                    {barber.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${STATUS_DOT[barber.status]}`} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <h3 className="truncate text-lg font-bold text-[#17201F]">{barber.name}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_PILL[barber.status]}`}>
                    {STATUS_LABEL[barber.status]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs font-medium text-[#657572]">{role}</p>

                {/* Rating Bar */}
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="flex items-center gap-1 rounded-md bg-[#FEF9C3] px-2 py-0.5">
                    <Star className="h-3 w-3 fill-[#CA8A04] text-[#CA8A04]" />
                    <span className="text-xs font-bold text-[#854D0E]">{rating.toFixed(1)}</span>
                  </div>
                  <span className="text-[11px] font-medium text-[#7A8B88]">
                    ({reviewCount} verified reviews)
                  </span>
                </div>
              </div>
            </div>

            {/* Live Availability Banner - Customer Privacy Compliant */}
            <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-[#F4F9F8] px-3 py-2 text-xs text-[#20403B]">
              <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[barber.status]}`} />
              <span className="font-semibold">
                {barber.status === 'available'
                  ? 'Free right now — ready for immediate service'
                  : barber.status === 'busy'
                    ? 'Currently serving a customer in chair'
                    : 'Currently off duty for today'}
              </span>
            </div>
          </div>

          {/* Key Facts Metrics Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#E2EAE9] bg-white p-2.5 text-center">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#7E8F8C]">Experience</span>
              <span className="mt-1 block text-sm font-extrabold text-[#17201F]">{experienceYears}+ Years</span>
            </div>
            <div className="rounded-xl border border-[#E2EAE9] bg-white p-2.5 text-center">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#7E8F8C]">Rating</span>
              <span className="mt-1 flex items-center justify-center gap-0.5 text-sm font-extrabold text-[#17201F]">
                {rating.toFixed(1)} <Star className="h-3 w-3 fill-[#CA8A04] text-[#CA8A04]" />
              </span>
            </div>
            <div className="rounded-xl border border-[#E2EAE9] bg-white p-2.5 text-center">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#7E8F8C]">Services</span>
              <span className="mt-1 block text-sm font-extrabold text-[#17201F]">{matchedServices.length} Types</span>
            </div>
          </div>

          {/* About / Bio */}
          <section className="rounded-2xl border border-[#E1E7E6] bg-white p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#73827F]">About Stylist</h4>
            <p className="mt-1.5 text-xs leading-relaxed text-[#455351]">{bio}</p>
          </section>

          {/* Specialties */}
          <section className="rounded-2xl border border-[#E1E7E6] bg-white p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#73827F]">Specialties & Expertise</h4>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {specialties.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5E4E1] bg-[#F2F8F7] px-2.5 py-1 text-xs font-semibold text-[#184640]"
                >
                  <Scissors className="h-3 w-3 text-[#0F766E]" />
                  {item}
                </span>
              ))}
            </div>
          </section>

          {/* Services Performed */}
          {matchedServices.length > 0 && (
            <section className="rounded-2xl border border-[#E1E7E6] bg-white p-4">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#73827F]">Services Offered</h4>
              <div className="mt-2 divide-y divide-[#EEF3F2]">
                {matchedServices.map((service) => (
                  <div key={service.id} className="flex items-center justify-between py-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#17201F]">{service.name}</p>
                      <p className="flex items-center gap-1 text-[11px] text-[#73827F]">
                        <Clock className="h-3 w-3 text-[#0F766E]" /> {service.durationMin} min
                      </p>
                    </div>
                    <span className="font-bold text-[#135F58]">₹{service.priceInr}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Bottom CTA Action Bar - Unified with Approved Get Token Mirror/Lens Design */}
        <div className="border-t border-[#E2EAE9] bg-white px-5 py-4 pb-[max(1.2rem,calc(env(safe-area-inset-bottom)+0.5rem))]">
          <button
            type="button"
            id="choose-stylist-cta"
            onClick={handleChoose}
            disabled={!selectable || busy}
            className="relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-[15px] font-bold text-white shadow-[0_16px_32px_-16px_rgba(6,44,40,0.6)] transition active:scale-[0.99] disabled:opacity-60"
            style={{ background: LIVE_QUEUE_GRADIENT }}
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-2xl p-px"
              style={{
                background: LIVE_QUEUE_RIM_FULL,
                WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
              aria-hidden="true"
            />
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/[0.14] to-transparent" aria-hidden="true" />
            <span className="relative flex items-center gap-2">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
              Get Token for {barber.name}
            </span>
          </button>
          <p className="mt-2 text-center text-[11px] text-[#788582]">
            You can cancel any time before you are called.
          </p>
        </div>
      </div>
    </div>
  );
};
