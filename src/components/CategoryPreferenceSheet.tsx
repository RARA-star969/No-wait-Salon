import React, { useState } from 'react';
import { X, Check, RotateCcw, Pin, PinOff, Sparkles } from 'lucide-react';
import { CategoryItemConfig, getCategoryIcon, customerHomeAccent } from './CustomerHomeComponents';

interface CategoryPreferenceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  allCategories: CategoryItemConfig[];
  pinnedIds: string[];
  onSavePinned: (pinnedIds: string[]) => void;
  onResetDefault: () => void;
}

export const CategoryPreferenceSheet: React.FC<CategoryPreferenceSheetProps> = ({
  isOpen,
  onClose,
  allCategories,
  pinnedIds,
  onSavePinned,
  onResetDefault,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(pinnedIds);

  // Sync state if modal opens with fresh props
  React.useEffect(() => {
    setSelectedIds(pinnedIds);
  }, [pinnedIds, isOpen]);

  if (!isOpen) return null;

  const togglePin = (id: string) => {
    setSelectedIds((prev) => {
      const lowerId = id.toLowerCase();
      const exists = prev.some((p) => p.toLowerCase() === lowerId);
      if (exists) {
        // Unpin
        return prev.filter((p) => p.toLowerCase() !== lowerId);
      } else {
        // Pin
        return [...prev, lowerId];
      }
    });
  };

  const handleSave = () => {
    onSavePinned(selectedIds);
    onClose();
  };

  const handleReset = () => {
    onResetDefault();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Customize Home Category Preferences"
        className="relative w-full max-w-md rounded-t-[28px] border border-[var(--noq-glass-border)] bg-[var(--noq-surface-soft)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-[var(--noq-ink)] shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom duration-300"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(245,247,255,0.92) 100%)',
          boxShadow: '0 -10px 40px -15px var(--noq-glow), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        {/* Drag handle pill */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--noq-tint-20)]" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--noq-accent)]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Personalize Home</span>
            </div>
            <h2 className="mt-0.5 text-lg font-black tracking-tight text-[var(--noq-ink)]">
              Pinned Categories
            </h2>
            <p className="mt-0.5 text-xs text-[var(--noq-muted)]">
              Choose which category cards appear on your Home deck first.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/60 text-[var(--noq-muted)] transition hover:bg-white active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category List */}
        <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
          {allCategories.map((category) => {
            const isPinned = selectedIds.some((id) => id.toLowerCase() === category.id.toLowerCase());
            const Icon = getCategoryIcon(category.iconName);
            const accent = customerHomeAccent(category);

            return (
              <div
                key={category.id}
                onClick={() => togglePin(category.id)}
                className={`group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 transition-all duration-200 active:scale-[0.98] ${
                  isPinned
                    ? 'border-[var(--noq-accent)]/30 bg-[var(--noq-accent)]/[0.06] shadow-sm'
                    : 'border-[var(--noq-glass-border)] bg-white/60 hover:bg-white/90'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl transition"
                    style={{
                      backgroundColor: isPinned ? 'var(--noq-tint-10)' : 'rgba(0,0,0,0.03)',
                      color: isPinned ? accent : '#7E8B9F',
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-[var(--noq-ink)]">
                        {category.name}
                      </span>
                      {isPinned && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--noq-accent)]/15 px-1.5 py-0.2 text-[9px] font-bold text-[var(--noq-accent)]">
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-[var(--noq-muted)]">
                      {category.tagline || category.description || `${category.businessCount ?? 0} nearby`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(category.id);
                  }}
                  aria-label={isPinned ? `Unpin ${category.name}` : `Pin ${category.name}`}
                  className={`flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-bold transition active:scale-95 ${
                    isPinned
                      ? 'bg-[var(--noq-accent)] text-white shadow-sm'
                      : 'border border-[var(--noq-glass-border)] bg-white text-[var(--noq-muted)] hover:text-[var(--noq-ink)]'
                  }`}
                >
                  {isPinned ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Pinned</span>
                    </>
                  ) : (
                    <>
                      <Pin className="h-3.5 w-3.5" />
                      <span>Pin</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--noq-glass-border)] pt-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--noq-glass-border)] bg-white/70 px-3.5 py-2 text-xs font-semibold text-[var(--noq-muted)] hover:text-[var(--noq-ink)] active:scale-95 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Default</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--noq-accent)] px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-[var(--noq-accent-hover)] active:scale-95"
            style={{
              boxShadow: '0 8px 20px -6px var(--noq-accent)',
            }}
          >
            <span>Done</span>
          </button>
        </div>
      </section>
    </div>
  );
};
