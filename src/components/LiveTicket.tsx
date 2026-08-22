import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Scissors } from 'lucide-react';

export type JourneyStage = 'joined' | 'in-queue' | 'upcoming' | 'your-turn';

export type TicketPerson = {
  id: string;
  label: string;
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
};

const JOURNEY_STEPS: { key: JourneyStage; label: string }[] = [
  { key: 'joined', label: 'Joined' },
  { key: 'in-queue', label: 'In Queue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'your-turn', label: 'Your Turn' },
];
const STAGE_ORDER: JourneyStage[] = ['joined', 'in-queue', 'upcoming', 'your-turn'];

/**
 * The customer's post-join Live Ticket: a two-portion digital chip in the
 * same teal mirror language as LiveQueueCard, draggable in 3D with momentum.
 * Shape is locked (do not redesign the silhouette) — see .lt-clip below.
 */
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
}) => {
  const ticketRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const brakingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [floating, setFloating] = useState(true);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
    setAngle(angleRef.current);
    lastXRef.current = event.clientX;
    lastTRef.current = now;
  };

  const pointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (Math.abs(velocityRef.current) > 0.3 && !reduceMotion) {
      rafRef.current = requestAnimationFrame(momentumStep);
    } else {
      velocityRef.current = 0;
      if (!reduceMotion) setTimeout(() => { if (!draggingRef.current) setFloating(true); }, 250);
    }
  };

  const stageIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div className="lt-root">
      <style>{`
        .lt-stage{width:100%;display:flex;justify-content:center;perspective:1200px;touch-action:pan-y;}
        .lt-ticket{position:relative;width:290px;height:172px;transform-style:preserve-3d;cursor:grab;will-change:transform;}
        .lt-ticket.lt-floating{animation:lt-float 4.5s ease-in-out infinite;}
        .lt-ticket:active{cursor:grabbing;}
        @keyframes lt-float{0%,100%{transform:translateY(0) rotateZ(-0.6deg);}50%{transform:translateY(-9px) rotateZ(0.6deg);}}
        .lt-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:18px;overflow:hidden;}
        .lt-face.lt-back{transform:rotateY(180deg);}
        .lt-clipped{position:absolute;inset:0;clip-path:url(#liveTicketClip);}
        .lt-mirror{position:absolute;inset:0;background:radial-gradient(120px 90px at 82% -10%, rgba(94,224,180,.35), transparent 60%),radial-gradient(140px 100px at -10% 115%, rgba(15,107,98,.4), transparent 60%),linear-gradient(135deg,#0B4A44 0%,#0F6B62 55%,#0F766E 100%);}
        .lt-noise{position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
        .lt-rim{position:absolute;inset:0;border-radius:18px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.22),inset 0 1px 0 rgba(255,255,255,.3),0 22px 40px -18px rgba(6,44,40,.6);pointer-events:none;}
        .lt-content{position:relative;height:100%;display:flex;}
        .lt-main{flex:1;min-width:0;padding:16px 14px 14px 24px;display:flex;flex-direction:column;color:#fff;}
        .lt-stub{width:66px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-left:2px dashed rgba(255,255,255,.32);color:#fff;padding:10px 0;}
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
        @media (prefers-reduced-motion: reduce){.lt-ticket.lt-floating{animation:none;}}
      `}</style>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <clipPath id="liveTicketClip" clipPathUnits="userSpaceOnUse">
            <path d="M26,0 H202 A22,22 0 0,0 246,0 H264 A26,26 0 0,1 290,26 V146 A26,26 0 0,1 264,172 H246 A22,22 0 0,0 202,172 H26 A26,26 0 0,1 0,146 V26 A26,26 0 0,1 26,0 Z" />
          </clipPath>
        </defs>
      </svg>

      <div className="lt-stage">
        <div
          ref={ticketRef}
          id="live-ticket-chip"
          className={`lt-ticket${floating ? ' lt-floating' : ''}`}
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
                    <div><div className="lt-stat-l">Position</div><div className="lt-stat-v">{position <= 0 ? 'Now' : `#${position}`}</div></div>
                    <div><div className="lt-stat-l">Est. wait</div><div className="lt-stat-v">{waitLabel}</div></div>
                  </div>
                </div>
                <div className="lt-stub">
                  <span className="lt-stub-icon"><Scissors className="h-3 w-3 text-white" /></span>
                  <span className="lt-stub-token">{token}</span>
                </div>
              </div>
            </div>
            <div className="lt-rim" />
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
            <div className="lt-rim" />
          </div>
        </div>
      </div>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#788582]">
        <span aria-hidden="true">&#8596;</span> drag to rotate &middot; flick to spin &middot; hold to brake
      </p>

      {/* Status journey */}
      <div className="mt-5 flex w-full items-start gap-0" role="list" aria-label="Booking status">
        {JOURNEY_STEPS.map((step, index) => {
          const done = index < stageIndex;
          const active = index === stageIndex;
          return (
            <div key={step.key} role="listitem" className="relative flex flex-1 flex-col items-center gap-1.5">
              {index > 0 && (
                <span
                  className={`absolute left-[-50%] top-[5px] h-0.5 w-full ${done || active ? 'bg-[#0F766E]' : 'bg-[#E1E7E6]'}`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-[1] h-[11px] w-[11px] rounded-full border-2 border-white ${
                  done ? 'bg-[#0F766E] shadow-[0_0_0_1px_#0F766E]' : active ? 'bg-[#0F766E] shadow-[0_0_0_4px_rgba(15,118,110,0.25)]' : 'bg-[#E1E7E6] shadow-[0_0_0_1px_#E1E7E6]'
                }`}
              />
              <span className={`text-center text-[9px] font-bold uppercase tracking-wide ${active ? 'text-[#17201F]' : done ? 'text-[#0F766E]' : 'text-[#6F7C7A]'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* CTAs */}
      <div className="mt-5 flex w-full flex-col gap-2">
        <button
          id="im-on-my-way-btn"
          type="button"
          disabled={!acknowledgeEnabled || acknowledgeBusy}
          onClick={onAcknowledge}
          aria-disabled={!acknowledgeEnabled}
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-[13px] text-[12.5px] font-bold transition-opacity ${
            acknowledgeEnabled ? 'bg-[#0F766E] text-white shadow-[0_12px_22px_-12px_rgba(15,118,110,0.6)]' : 'bg-[#E1E7E6] text-[#6F7C7A] opacity-55'
          }`}
        >
          {acknowledgeBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          I&rsquo;m on my way
        </button>
        <button
          id="cancel-ticket-btn"
          type="button"
          onClick={onCancel}
          className="text-center text-[11px] font-bold text-rose-700 underline underline-offset-4"
        >
          Cancel your ticket
        </button>
      </div>

      {/* People around you */}
      {peopleAround.length > 0 && (
        <div className="mt-5 w-full">
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#6F7C7A]">People around you in queue</p>
          <div className="flex items-end justify-center gap-3.5">
            {peopleAround.map((person, index) => (
              <React.Fragment key={person.id}>
                {index > 0 && <span className="mb-5 h-0.5 w-4 bg-[#DDE5E3]" aria-hidden="true" />}
                <div className="flex flex-col items-center gap-1.5">
                  {person.photoUrl ? (
                    <img
                      src={person.photoUrl}
                      alt=""
                      className={`rounded-full border-2 border-white object-cover shadow-[0_0_0_1px_#DDE5E3] ${person.isMe ? 'h-[52px] w-[52px] shadow-[0_0_0_3px_#0F766E]' : 'h-[38px] w-[38px]'}`}
                    />
                  ) : (
                    <span
                      className={`flex items-center justify-center rounded-full font-bold ${
                        person.isMe ? 'h-[52px] w-[52px] bg-[#0F766E] text-sm text-white shadow-[0_0_0_3px_#0F766E]' : 'h-[38px] w-[38px] bg-[#E1E7E6] text-xs text-[#6F7C7A]'
                      }`}
                    >
                      {person.isMe ? 'You' : person.label.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className={`text-[9px] font-bold uppercase tracking-wide ${person.isMe ? 'text-[#0F766E]' : 'text-[#6F7C7A]'}`}>
                    {person.isMe ? 'You' : person.label}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
