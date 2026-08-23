import React from 'react';

/**
 * Splits a duration label like "8 min" or "1 hr 15 min" into a dominant
 * leading number and a smaller trailing unit, so "8" always reads larger
 * than "min" while staying on one line. Falls back to the plain label for
 * anything that isn't "number + unit" shaped (e.g. "Now", "Ready now").
 */
export const TimeValue: React.FC<{ label: string }> = ({ label }) => {
  const match = label.match(/^(\S+)\s*(.*)$/);
  const unit = match?.[2];
  if (!match || !unit) return <>{label}</>;
  return (
    <>
      {match[1]}
      <span className="ml-1 text-[0.5em] font-bold text-white/80">{unit}</span>
    </>
  );
};
