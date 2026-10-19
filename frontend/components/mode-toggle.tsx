'use client';

import { useTheme } from 'next-themes';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Clock3, MoonStar, Sparkles, Sun } from '@/app/components/icons';
import {
  getScheduledTheme,
  getStoredThemePreference,
  getStoredThemeTimeZone,
  type ThemePreference,
} from '@/app/lib/theme-preference';
import { cn } from '@/app/lib/utils';

type ModeToggleProps = {
  className?: string;
  value?: ThemePreference;
  onThemeChange?: (theme: ThemePreference) => void;
  showPreview?: boolean;
  labels?: {
    light: string;
    dark: string;
    auto: string;
    active: string;
    followsSystem: string;
  };
};

const DEFAULT_LABELS = {
  light: 'Light',
  dark: 'Dark',
  auto: 'Auto',
  active: 'Active theme',
  followsSystem: 'Light theme turns on at 07:00, dark theme at 19:00',
} as const;

function ThemePreviewCard({
  selectedTheme,
  currentTheme,
  copy,
}: {
  selectedTheme: ThemePreference;
  currentTheme: 'dark' | 'light';
  copy: NonNullable<ModeToggleProps['labels']>;
}) {
  const isDark = currentTheme === 'dark';
  const themeLabel =
    selectedTheme === 'auto'
      ? `${copy.auto} · ${isDark ? copy.dark : copy.light}`
      : selectedTheme === 'dark'
        ? copy.dark
        : copy.light;
  const cardBg = isDark
    ? 'border-sky-400/25 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900'
    : 'border-slate-300/80 bg-gradient-to-br from-slate-100 via-white to-sky-50';
  const barBg = isDark ? 'bg-slate-700' : 'bg-slate-300';
  const boxBg1 = isDark ? 'border-sky-300/20 bg-slate-800' : 'border-slate-200 bg-white';
  const boxBg2 = isDark ? 'border-emerald-300/20 bg-slate-800' : 'border-slate-200 bg-white';

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {copy.active}
        </p>
        <div className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{themeLabel}</span>
        </div>
      </div>
      <div className={cn('rounded-xl border p-3 transition-all duration-200', cardBg)}>
        <div className={cn('mb-2 h-2.5 w-24 rounded-full', barBg)} />
        <div className="grid grid-cols-2 gap-2">
          <div className={cn('h-10 rounded-md border', boxBg1)} />
          <div className={cn('h-10 rounded-md border', boxBg2)} />
        </div>
      </div>
      {selectedTheme === 'auto' && (
        <p className="mt-2 text-xs text-muted-foreground">{copy.followsSystem}</p>
      )}
    </div>
  );
}

// eslint-disable-next-line max-lines-per-function, complexity
export function ModeToggle({
  className,
  labels,
  onThemeChange,
  showPreview = true,
  value,
}: ModeToggleProps): React.JSX.Element {
  const { setTheme, resolvedTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const copy = labels ?? DEFAULT_LABELS;
  const selectedTheme =
    value ?? getStoredThemePreference() ?? ((theme as ThemePreference) || 'auto');
  const currentTheme: Exclude<ThemePreference, 'auto'> =
    mounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  const handleChange = (nextTheme: ThemePreference): void => {
    onThemeChange?.(nextTheme);
    setTheme(nextTheme === 'auto' ? getScheduledTheme(getStoredThemeTimeZone()) : nextTheme);
  };

  const options = useMemo(
    () => [
      { key: 'light' as const, label: copy.light, icon: Sun },
      { key: 'dark' as const, label: copy.dark, icon: MoonStar },
      { key: 'auto' as const, label: copy.auto, icon: Clock3 },
    ],
    [copy.auto, copy.dark, copy.light],
  );
  const activeIndex = Math.max(
    0,
    options.findIndex(option => option.key === selectedTheme),
  );

  return (
    <div className={cn('space-y-4', className)}>
      <div
        className="seneca-theme-toggle"
        role="group"
        aria-label={copy.active}
        style={{ '--theme-toggle-index': activeIndex } as React.CSSProperties}
      >
        <span className="seneca-theme-toggle__thumb" aria-hidden="true" />
        {options.map(option => {
          const Icon = option.icon;
          const active = selectedTheme === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => handleChange(option.key)}
              aria-pressed={active}
              className={cn(
                'seneca-theme-toggle__option',
                `seneca-theme-toggle__option--${option.key}`,
                active && 'seneca-theme-toggle__option--active',
              )}
            >
              <span className="seneca-theme-toggle__icon">
                <Icon />
              </span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {showPreview ? (
        <ThemePreviewCard selectedTheme={selectedTheme} currentTheme={currentTheme} copy={copy} />
      ) : null}
    </div>
  );
}
