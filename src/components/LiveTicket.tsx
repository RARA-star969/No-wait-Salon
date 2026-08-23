import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Scissors } from 'lucide-react';

export type JourneyStage = 'joined' | 'in-queue' | 'upcoming' | 'your-turn';

export type TicketPerson = {
  id: string;
  label: string;
  positionNumber?: number;
  relLabel?: string;
  photoUrl?: string;
  isMe?: boolean;
};

type Props = {
  salonName: string;
  token: string;
  position: number;
  waitLabel: string;
  stage: JourneyStage;
  acknowledgeEnabled: boolean;
  acknowledgeBusy?: boolean;
  onAcknowledge: () => void;
  onCancel: () => void;
  peopleAround: TicketPerson[];
  joinedAtTimeLabel?: string;
  calledAtTimeLabel?: string;
  callTimerRemainingLabel?: string;
  isCalledState?: boolean;
  isUpcomingState?: boolean;
  isServingState?: boolean;
  isAcknowledged?: boolean;
  callExpired?: boolean;
  upcomingPeopleAhead?: number;
  upcomingApproxTimeLabel?: string;
  totalPriceInr?: number;
  discountInr?: number;
  servicesList?: string[];
  paymentStatus?: 'unpaid' | 'cash_pending' | 'paid' | 'waived';
  paymentMethod?: 'cash' | 'online' | 'upi' | 'card';
  onPayOnline?: () => void;
  onPayCash?: () => void;
};

const JOURNEY_STEPS: { key: JourneyStage; label: string }[] = [
  { key: 'joined', label: 'Joined' },
  { key: 'in-queue', label: 'In Queue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'your-turn', label: 'Your Turn' },
];
const STAGE_ORDER: JourneyStage[] = ['joined', 'in-queue', 'upcoming', 'your-turn'];

export const LiveTicket: React.FC<Props> = ({
  salonName,
  token,
  position,
  waitLabel,
  stage,
  acknowledgeEnabled,
  acknowledgeBusy,
  onAcknowledge,
  onCancel,
  peopleAround,
  joinedAtTimeLabel,
  calledAtTimeLabel,
  callTimerRemainingLabel,
  isCalledState,
  isUpcomingState,
  isServingState,
  isAcknowledged,
  callExpired,
  upcomingPeopleAhead = 1,
  upcomingApproxTimeLabel = '5–10 min',
  totalPriceInr = 250,
  discountInr = 0,
  servicesList = [],
  paymentStatus = 'unpaid',
  paymentMethod,
  onPayOnline,
  onPayCash,
}) => {
  const ticketRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const brakingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [floating, setFloating] = useState(false);
  const [entrySpinning, setEntrySpinning] = useState(true);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduceMotion) {
      setFloating(false);
      setEntrySpinning(false);
      return;
    }
    setEntrySpinning(true);
    setFloating(false);
    const timer = setTimeout(() => {
      setEntrySpinning(false);
      if (!draggingRef.current) setFloating(true);
    }, 1350);
    return () => clearTimeout(timer);
  }, [token, reduceMotion]);

  const setAngle = (deg: number) => {
    angleRef.current = deg;
    if (ticketRef.current) ticketRef.current.style.transform = `rotateY(${deg}deg)`;
  };

  const stopMomentum = () => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  const momentumStep = () => {
    angleRef.current += velocityRef.current;
    velocityRef.current *= brakingRef.current ? 0.9 : 0.965;
    setAngle(angleRef.current);
    if (Math.abs(velocityRef.current) < 0.05) {
      velocityRef.current = 0;
      rafRef.current = null;
      brakingRef.current = false;
      if (!reduceMotion && !draggingRef.current) setFloating(true);
      return;
    }
    rafRef.current = requestAnimationFrame(momentumStep);
  };

  useEffect(() => () => stopMomentum(), []);

  const pointerDown = (event: React.PointerEvent) => {
    setEntrySpinning(false);
    setFloating(false);
    if (ticketRef.current) ticketRef.current.style.transform = `rotateY(${angleRef.current}deg)`;
    if (rafRef.current !== null && Math.abs(velocityRef.current) > 0.3) {
      brakingRef.current = true;
    } else {
      stopMomentum();
      velocityRef.current = 0;
    }
    draggingRef.current = true;
    lastXRef.current = event.clientX;
    lastTRef.current = performance.now();
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const pointerMove = (event: React.PointerEvent) => {
    if (!draggingRef.current) return;
    brakingRef.current = false;
    stopMomentum();
    const now = performance.now();
    const dx = event.clientX - lastXRef.current;
    const dt = Math.max(1, now - lastTRef.current);
    angleRef.current += dx * 0.6;
    velocityRef.current = (dx / dt) * 14;
    lastXRef.current = event.clientX;
    lastTRef.current = now;
    setAngle(angleRef.current);
  };

  const pointerUp = (event: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (event.target as Element).releasePointerCapture?.(event.pointerId);
    if (Math.abs(velocityRef.current) > 0.4) {
      stopMomentum();
      rafRef.current = requestAnimationFrame(momentumStep);
    } else {
      velocityRef.current = 0;
      if (!reduceMotion) setTimeout(() => { if (!draggingRef.current) setFloating(true); }, 250);
    }
  };

  const stageIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div className="lt-root w-full">
      <style>{`
        .lt-stage{position:relative;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;perspective:1200px;touch-action:pan-y;padding:10px 0 16px 0;filter:drop-shadow(0 28px 40px rgba(4,38,35,.46)) drop-shadow(0 10px 18px rgba(15,118,110,.25));}
        .lt-ticket{position:relative;width:290px;height:172px;transform-style:preserve-3d;cursor:grab;will-change:transform;}
        .lt-ticket.lt-entry-spin{animation:lt-entry 1.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;}
        .lt-ticket.lt-floating{animation:lt-float 4.5s ease-in-out infinite;}
        .lt-ticket:active{cursor:grabbing;}
        @keyframes lt-entry{0%{transform:scale(0.55) rotateY(-720deg) rotateZ(-14deg) translateY(-32px);opacity:0;}45%{transform:scale(1.06) rotateY(-180deg) rotateZ(5deg) translateY(-10px);opacity:1;}75%{transform:scale(0.98) rotateY(15deg) rotateZ(-2deg) translateY(3px);}100%{transform:scale(1) rotateY(0deg) rotateZ(0deg) translateY(0);opacity:1;}}
        @keyframes lt-float{0%,100%{transform:translateY(0) rotateZ(-0.6deg);}50%{transform:translateY(-9px) rotateZ(0.6deg);}}
        .lt-ground-glow{position:absolute;bottom:0;width:210px;height:16px;border-radius:50%;background:radial-gradient(ellipse at center, rgba(15,118,110,.36) 0%, rgba(11,74,68,.16) 55%, transparent 75%);filter:blur(7px);pointer-events:none;transition:opacity .4s ease;}
        .lt-ground-glow.lt-floating-glow{animation:lt-glow-float 4.5s ease-in-out infinite;}
        @keyframes lt-glow-float{0%,100%{transform:scale(1);opacity:.65;}50%{transform:scale(0.82);opacity:.32;}}
        .lt-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform-style:preserve-3d;}
        .lt-face.lt-front{transform:rotateY(0deg);}
        .lt-face.lt-back{transform:rotateY(180deg);}
        .lt-clipped{position:absolute;inset:0;clip-path:url(#liveTicketClip);}
        .lt-face.lt-back .lt-clipped{clip-path:url(#liveTicketClipBack);}
        .lt-mirror{position:absolute;inset:0;background:radial-gradient(120px 90px at 82% -10%, rgba(94,224,180,.35), transparent 60%),radial-gradient(140px 100px at -10% 115%, rgba(15,107,98,.4), transparent 60%),linear-gradient(135deg,#0B4A44 0%,#0F6B62 55%,#0F766E 100%);}
        .lt-noise{position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
        .lt-rim-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
        .lt-content{position:relative;height:100%;display:flex;}
        .lt-main{flex:1;min-width:0;padding:16px 14px 14px 22px;display:flex;flex-direction:column;color:#fff;}
        .lt-stub{width:68px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-left:2px dashed rgba(255,255,255,.32);color:#fff;padding:10px 0;}
        .lt-stub-icon{width:22px;height:22px;border-radius:8px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;}
        .lt-stub-token{writing-mode:vertical-rl;font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.12em;color:rgba(255,255,255,.88);}
        .lt-eyebrow{font-size:8.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.62);}
        .lt-salon{font-size:11.5px;font-weight:700;margin-top:2px;color:rgba(255,255,255,.92);}
        .lt-token{font-family:'JetBrains Mono',monospace;font-size:29px;font-weight:700;letter-spacing:.02em;margin-top:9px;line-height:1;}
        .lt-token-label{font-size:8px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-top:3px;}
        .lt-stats{margin-top:auto;display:flex;gap:20px;padding-top:8px;}
        .lt-stat-l{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.55);}
        .lt-stat-v{font-size:14px;font-weight:800;margin-top:2px;}
        .lt-back-content{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:6px;}
        .lt-back-mark{width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;}
        .lt-back-word{font-family:inherit;font-weight:800;font-size:13px;letter-spacing:.03em;}
        .lt-back-tag{font-size:9px;color:rgba(255,255,255,.6);letter-spacing:.04em;}
        .lt-back-token{position:absolute;bottom:10px;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.1em;color:rgba(255,255,255,.4);}
        @media (prefers-reduced-motion: reduce){.lt-ticket.lt-floating,.lt-ticket.lt-entry-spin{animation:none;}}
      `}</style>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <clipPath id="liveTicketClip" clipPathUnits="userSpaceOnUse">
            <path d="M 14,0 H 210 A 12,12 0 0,0 234,0 H 276 A 14,14 0 0,0 290,14 V 71 A 15,15 0 0,0 290,101 V 158 A 14,14 0 0,0 276,172 H 234 A 12,12 0 0,0 210,172 H 14 A 14,14 0 0,0 0,158 V 101 A 15,15 0 0,0 0,71 V 14 A 14,14 0 0,0 14,0 Z" />
          </clipPath>
          <clipPath id="liveTicketClipBack" clipPathUnits="userSpaceOnUse">
            <path d="M 14,0 H 56 A 12,12 0 0,0 80,0 H 276 A 14,14 0 0,0 290,14 V 71 A 15,15 0 0,0 290,101 V 158 A 14,14 0 0,0 276,172 H 80 A 12,12 0 0,0 56,172 H 14 A 14,14 0 0,0 0,158 V 101 A 15,15 0 0,0 0,71 V 14 A 14,14 0 0,0 14,0 Z" />
          </clipPath>
          <linearGradient id="liveTicketRimGrad" x1="0" y1="0" x2="290" y2="172" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.65" />
            <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.2" />
            <stop offset="1" stopColor="#2DD4BF" stopOpacity="0.4" />
          </linearGradient>
        </defs>
      </svg>

      <div className="lt-stage">
        <div
          ref={ticketRef}
          id="live-ticket-chip"
          className={`lt-ticket${entrySpinning ? ' lt-entry-spin' : floating ? ' lt-floating' : ''}`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
        >
          <div className="lt-face lt-front">
            <div className="lt-clipped">
              <div className="lt-mirror" /><div className="lt-noise" />
              <div className="lt-content">
                <div className="lt-main">
                  <span className="lt-eyebrow">No-Wait Token</span>
                  <span className="lt-salon">{salonName}</span>
                  <span className="lt-token" id="live-ticket-token">{token}</span>
                  <span className="lt-token-label">Your token</span>
                  <div className="lt-stats">
                    {isServingState ? (
                      <>
                        <div>
                          <div className="lt-stat-l">Status</div>
                          <div className="lt-stat-v text-[#5EE0B4]">In Chair</div>
                        </div>
                        <div>
                          <div className="lt-stat-l">Bill Total</div>
                          <div className="lt-stat-v text-white font-mono tracking-wider">₹{totalPriceInr}</div>
                        </div>
                      </>
                    ) : isCalledState ? (
                      <>
                        <div>
                          <div className="lt-stat-l">Called At</div>
                          <div className="lt-stat-v text-[#5EE0B4]">{calledAtTimeLabel || 'Just now'}</div>
                        </div>
                        <div>
                          <div className="lt-stat-l">Time Left</div>
                          <div className="lt-stat-v text-amber-300 font-mono tracking-wider">{callTimerRemainingLabel || '05:00'}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div><div className="lt-stat-l">Position</div><div className="lt-stat-v">{position <= 0 ? 'Now' : `#${position}`}</div></div>
                        <div><div className="lt-stat-l">Est. wait</div><div className="lt-stat-v">{waitLabel}</div></div>
                      </>
                    )}
                  </div>
                </div>
                <div className="lt-stub">
                  <span className="lt-stub-icon"><Scissors className="h-3 w-3 text-white" /></span>
                  <span className="lt-stub-token">{token}</span>
                </div>
              </div>
            </div>
            <svg className="lt-rim-svg" viewBox="0 0 290 172" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M 14,0 H 210 A 12,12 0 0,0 234,0 H 276 A 14,14 0 0,0 290,14 V 71 A 15,15 0 0,0 290,101 V 158 A 14,14 0 0,0 276,172 H 234 A 12,12 0 0,0 210,172 H 14 A 14,14 0 0,0 0,158 V 101 A 15,15 0 0,0 0,71 V 14 A 14,14 0 0,0 14,0 Z"
                stroke="url(#liveTicketRimGrad)"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <div className="lt-face lt-back">
            <div className="lt-clipped">
              <div className="lt-mirror" /><div className="lt-noise" />
              <div className="lt-back-content">
                <span className="lt-back-mark"><Scissors className="h-4 w-4 text-white" /></span>
                <span className="lt-back-word">NO-WAIT</span>
                <span className="lt-back-tag">Skip the wait. Not the cut.</span>
                <span className="lt-back-token">{token}</span>
              </div>
            </div>
            <svg className="lt-rim-svg" viewBox="0 0 290 172" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M 14,0 H 56 A 12,12 0 0,0 80,0 H 276 A 14,14 0 0,0 290,14 V 71 A 15,15 0 0,0 290,101 V 158 A 14,14 0 0,0 276,172 H 80 A 12,12 0 0,0 56,172 H 14 A 14,14 0 0,0 0,158 V 101 A 15,15 0 0,0 0,71 V 14 A 14,14 0 0,0 14,0 Z"
                stroke="url(#liveTicketRimGrad)"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </div>
        <div className={`lt-ground-glow${floating ? ' lt-floating-glow' : ''}`} aria-hidden="true" />
      </div>

      {/* Status journey */}
      <div className="mt-5 flex w-full items-start gap-0" role="list" aria-label="Booking status">
        {JOURNEY_STEPS.map((step, index) => {
          const done = index < stageIndex || (step.key === 'joined');
          const active = index === stageIndex;
          return (
            <div key={step.key} role="listitem" className="relative flex flex-1 flex-col items-center gap-1">
              {index > 0 && (
                <span
                  className={`absolute left-[-50%] top-[5px] h-0.5 w-full ${done || active ? 'bg-[#0F766E]' : 'bg-[#E1E7E6]'}`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-[1] flex items-center justify-center rounded-full border-2 border-white transition-all ${
                  active
                    ? 'h-[13px] w-[13px] bg-[#0F766E] shadow-[0_0_0_4px_rgba(15,118,110,0.28)] animate-pulse'
                    : done
                      ? 'h-[11px] w-[11px] bg-[#0F766E] shadow-[0_0_0_1px_#0F766E]'
                      : 'h-[11px] w-[11px] bg-[#E1E7E6] shadow-[0_0_0_1px_#E1E7E6]'
                }`}
              />
              <span className={`text-center text-[9px] font-bold uppercase tracking-wide ${active ? 'text-[#17201F]' : done ? 'text-[#0F766E]' : 'text-[#6F7C7A]'}`}>
                {step.label}
              </span>
              {step.key === 'joined' && joinedAtTimeLabel && (
                <span className="text-[9px] font-semibold text-[#0F766E]/90">{joinedAtTimeLabel}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Realtime Preparation / Calling Module */}
      {isCalledState ? (
        <div className="mt-5 flex w-full flex-col items-center rounded-[18px] border border-amber-200/80 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-white p-4 shadow-[0_12px_28px_-10px_rgba(217,119,6,0.18)]">
          <div className="flex items-center gap-2 text-amber-700">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-600" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider">Salon is calling you</span>
          </div>
          <p className="mt-1 text-center text-xs font-bold text-[#17201F]">It&rsquo;s time to head in</p>

          {callExpired ? (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-1.5 text-center text-[11px] font-semibold text-rose-700">
              Call window expired &mdash; the salon may move to the next customer.
            </p>
          ) : (
            <div className="mt-3 flex flex-col items-center">
              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-800/70">Arrive Within</span>
              <span className="font-mono text-2xl font-black text-amber-900">{callTimerRemainingLabel || '05:00'}</span>
            </div>
          )}
        </div>
      ) : isUpcomingState ? (
        <div className="mt-5 flex w-full flex-col items-center rounded-[18px] border border-[#0F766E]/20 bg-gradient-to-b from-[#0F766E]/10 via-[#0F766E]/5 to-white p-4 shadow-[0_12px_28px_-10px_rgba(15,118,110,0.15)]">
          <div className="flex items-center gap-2 text-[#0F766E]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#0F766E]" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider">You&rsquo;re Almost Up</span>
          </div>
          <p className="mt-1 text-center text-xs font-bold text-[#17201F]">
            {upcomingPeopleAhead <= 1 ? 'Next in line' : `${upcomingPeopleAhead} people ahead`} &middot; Approx. {upcomingApproxTimeLabel}
          </p>
          <div className="mt-2.5 rounded-xl bg-white/80 px-3 py-2 text-center text-[11px] font-semibold text-[#0B4A44] shadow-sm backdrop-blur-sm">
            Get ready to head over. Your turn is approaching. Stay nearby.
          </div>
        </div>
      ) : null}

      {/* Primary Action Buttons */}
      {!isServingState && (
        <div className="mt-5 flex w-full flex-col gap-2.5">
          {isAcknowledged ? (
            <div className="flex h-11 w-full items-center justify-center gap-2 rounded-[13px] border border-[#0F766E]/30 bg-[#0F766E]/10 text-[12.5px] font-bold text-[#0F766E] shadow-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0F766E] text-white">✓</span>
              Salon notified &mdash; you&rsquo;re on your way
            </div>
          ) : (
            <button
              id="im-on-my-way-btn"
              type="button"
              disabled={!acknowledgeEnabled || acknowledgeBusy}
              onClick={onAcknowledge}
              aria-disabled={!acknowledgeEnabled}
              className={`flex h-11 w-full items-center justify-center gap-2 rounded-[13px] text-[12.5px] font-bold transition-all ${
                acknowledgeEnabled
                  ? 'bg-[#0F766E] text-white shadow-[0_14px_26px_-10px_rgba(15,118,110,0.55)] active:scale-[0.98] cursor-pointer'
                  : 'bg-[#E1E7E6] text-[#6F7C7A] opacity-55 cursor-not-allowed'
              }`}
            >
              {acknowledgeBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              I&rsquo;m on my way
            </button>
          )}
          <button
            id="cancel-ticket-btn"
            type="button"
            onClick={onCancel}
            className="text-center text-[11px] font-bold text-rose-700 underline underline-offset-4 cursor-pointer"
          >
            Cancel your ticket
          </button>
        </div>
      )}

      {/* Service & Billing Module OR People Around You */}
      {isServingState ? (
        <div id="service-billing-module" className="mt-6 w-full space-y-3 rounded-[20px] border border-[#0F766E]/20 bg-gradient-to-b from-[#0F766E]/10 via-white to-white p-4 shadow-[0_14px_30px_-10px_rgba(15,118,110,0.22)]">
          <div className="flex items-center justify-between border-b border-[#E1E7E6] pb-2.5">
            <div className="flex items-center gap-2 text-[#0F766E]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
              </span>
              <span className="text-[11px] font-black uppercase tracking-wider">Service &amp; Billing</span>
            </div>
            <span className="text-[10px] font-bold text-[#0B4A44] bg-[#0F766E]/10 px-2 py-0.5 rounded-full">
              In Chair
            </span>
          </div>

          {/* Service & Breakdown */}
          <div className="space-y-1.5 text-xs text-[#17201F]">
            <div className="flex items-center justify-between font-medium">
              <span className="text-[#5E6C6A]">Services</span>
              <span className="font-bold">{servicesList.length ? servicesList.join(' + ') : 'Haircut'}</span>
            </div>
            {discountInr > 0 && (
              <div className="flex items-center justify-between text-emerald-700 text-[11px] font-semibold">
                <span>Offer Discount</span>
                <span>-₹{discountInr}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-[#E1E7E6]">
              <span className="font-bold text-[#17201F]">Total Payable</span>
              <span className="text-xl font-black text-[#0B4A44] font-mono">₹{totalPriceInr}</span>
            </div>
          </div>

          {/* Payment Actions */}
          <div className="pt-2">
            {paymentStatus === 'paid' ? (
              <div className="flex h-11 w-full items-center justify-center gap-2 rounded-[13px] border border-emerald-300 bg-emerald-50 text-[12.5px] font-bold text-emerald-800 shadow-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-xs">✓</span>
                Paid ₹{totalPriceInr} via {paymentMethod === 'online' ? 'Online Payment' : 'Cash'}
              </div>
            ) : paymentStatus === 'cash_pending' ? (
              <div className="flex flex-col items-center gap-1 rounded-[13px] border border-amber-300 bg-amber-50 p-3 text-center shadow-sm">
                <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Cash Payment Reported
                </span>
                <p className="text-[10px] font-medium text-amber-900">Waiting for salon staff to confirm cash collection.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  id="pay-online-btn"
                  type="button"
                  onClick={onPayOnline}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-[#0F766E] text-white text-[12.5px] font-bold shadow-[0_14px_26px_-10px_rgba(15,118,110,0.55)] active:scale-[0.98] transition cursor-pointer"
                >
                  Pay Bill (₹{totalPriceInr})
                </button>
                <button
                  id="pay-cash-btn"
                  type="button"
                  onClick={onPayCash}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-[13px] border border-[#E1E7E6] bg-white text-[11.5px] font-bold text-[#5E6C6A] hover:bg-[#F8FAFA] transition cursor-pointer"
                >
                  💵 Paid Cash to Salon
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        peopleAround.length > 0 && (
          <div className="mt-6 w-full">
            <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-wider text-[#6F7C7A]">People around you in queue</p>
            <div className="flex items-center justify-center gap-2.5 overflow-x-auto py-2">
              {peopleAround.map((person) => (
                <div
                  key={person.id}
                  className={`flex flex-col items-center justify-center rounded-[16px] p-2.5 transition-all ${
                    person.isMe
                      ? 'min-w-[88px] border-2 border-[#0F766E] bg-gradient-to-b from-[#0F766E]/15 via-white to-white shadow-[0_10px_22px_-8px_rgba(15,118,110,0.35)] scale-105 z-[2]'
                      : 'min-w-[72px] border border-[#E1E7E6] bg-white/90 shadow-sm'
                  }`}
                >
                  <span className={`text-[9px] font-extrabold uppercase ${person.isMe ? 'text-[#0F766E]' : 'text-[#8A9694]'}`}>
                    {person.positionNumber ? `#${person.positionNumber}` : ''}
                  </span>
                  <div className="my-1.5 flex items-center justify-center">
                    {person.photoUrl ? (
                      <img
                        src={person.photoUrl}
                        alt=""
                        className={`rounded-full border-2 border-white object-cover ${person.isMe ? 'h-[44px] w-[44px] shadow-[0_0_0_2px_#0F766E]' : 'h-[34px] w-[34px]'}`}
                      />
                    ) : (
                      <span
                        className={`flex items-center justify-center rounded-full font-bold ${
                          person.isMe
                            ? 'h-[44px] w-[44px] bg-[#0F766E] text-sm text-white shadow-[0_4px_12px_rgba(15,118,110,0.4)]'
                            : 'h-[34px] w-[34px] bg-[#E1E7E6] text-xs text-[#6F7C7A]'
                        }`}
                      >
                        {person.isMe ? 'You' : person.label.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-extrabold ${person.isMe ? 'text-[#0F766E]' : 'text-[#17201F]'}`}>
                    {person.isMe ? 'YOU' : person.label}
                  </span>
                  <span className="text-[8px] font-bold text-[#6F7C7A]">
                    {person.relLabel || (person.isMe ? 'Current token' : 'In queue')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
};
