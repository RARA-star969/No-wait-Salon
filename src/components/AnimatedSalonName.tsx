import React from 'react';

const NBSP = '\u00A0';

/**
 * The salon name, revealed letter-by-letter left to right on mount — a
 * subtle one-time premium flourish (not a distracting loop). Screen readers
 * get the plain name via aria-label; the animated letters are hidden from
 * the accessibility tree so nothing is announced twice.
 */
export const AnimatedSalonName: React.FC<{ name: string; className?: string }> = ({ name, className = '' }) => (
  <h1 aria-label={name} className={className}>
    <span aria-hidden="true">
      {name.split('').map((letter, index) => (
        <span
          key={index}
          className="name-wave-letter"
          style={{ '--wave-delay': `${index * 28}ms` } as React.CSSProperties}
        >
          {letter === ' ' ? NBSP : letter}
        </span>
      ))}
    </span>
  </h1>
);
