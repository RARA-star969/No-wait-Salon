import React from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  label: string;
  eyebrow?: string;
  title?: string;
  icon?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  z?: number;
};

/**
 * Shared bottom-sheet shell for the salon page's quick-action and info
 * sheets, so every one of them enters/exits identically and none reinvents
 * the backdrop, drag handle or close button.
 */
export const BottomSheet: React.FC<Props> = ({ open, onClose, label, eyebrow, title, icon, id, children, footer, z = 90 }) => {
  if (!open) return null;
  return (
    <div className={`fixed inset-0 flex items-end justify-center bg-slate-950/55 sm:items-center`} style={{ zIndex: z }}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        id={id}
        className="relative flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-[#F8FAFA] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-16px_rgba(6,26,24,0.35)] [animation:sheet-reveal_260ms_cubic-bezier(0.22,1,0.36,1)] sm:max-w-md sm:rounded-3xl sm:pb-4"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[#D7E0DE] sm:hidden" />
        <div className="flex items-start justify-between gap-3 px-5 pt-3.5">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#E6F3F1] text-[#0F766E]">{icon}</span>
            )}
            <div className="min-w-0">
              {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0F766E]">{eyebrow}</p>}
              {title && <h2 className="mt-0.5 truncate text-lg font-bold tracking-[-0.02em] text-[#17201F]">{title}</h2>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#42524F] ring-1 ring-[#E2EAE9]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-5">{children}</div>

        {footer && <div className="px-5 pt-3">{footer}</div>}
      </div>
    </div>
  );
};

/** Honest "not wired up yet" notice for structural placeholder sheets. */
export const ComingSoonNotice: React.FC<{ text?: string }> = ({ text }) => (
  <div className="mt-4 rounded-2xl border border-dashed border-[#D7E2E0] bg-white p-4 text-center text-[11px] leading-5 text-[#788582]">
    {text || 'This is a preview of the layout. Live data connects here soon.'}
  </div>
);
