'use client';

import type React from 'react';

/**
 * Text tabs without frames: the picked one in ink with a sage underline, the
 * rest grey. For switches that change what a card shows (period, cut).
 */
export function TextTabs<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: React.ReactNode }>;
  ariaLabel: string;
}): React.JSX.Element {
  return (
    <div role="tablist" aria-label={ariaLabel} className="lumio-text-tabs">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className="lumio-text-tabs__tab"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
