'use client';

import type { LucideIcon } from '@/app/components/icons';

export type IconToggleOption<T extends string> = { value: T; label: string; Icon: LucideIcon };

type Props<T extends string> = {
  options: IconToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  groupLabel: string;
};

/** A segmented control of icons; the label lives in aria-label and the tooltip. */
export function AnalyticsIconToggle<T extends string>({
  options,
  value,
  onChange,
  groupLabel,
}: Props<T>): React.JSX.Element {
  return (
    <div className="lumio-view-page__period-tabs" role="group" aria-label={groupLabel}>
      {options.map(({ value: optionValue, label, Icon }) => {
        const active = optionValue === value;
        return (
          <button
            key={optionValue}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            className={`lumio-view-page__period-tab${active ? ' lumio-view-page__period-tab--active' : ''}`}
            style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px' }}
            onClick={() => onChange(optionValue)}
          >
            <Icon size={16} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
