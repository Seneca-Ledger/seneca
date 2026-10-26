import { Circle } from '@/app/components/icons';
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const EmptyIcon = Circle;

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    labels: {
      dateFrom: { value: 'Date de debut' },
      dateTo: { value: 'Date de fin' },
      format: { value: 'Format localise' },
      generating: { value: 'Generation...' },
      generateAndDownload: { value: 'Generer et telecharger' },
      cancel: { value: 'Annuler' },
    },
  }),
  useLocale: () => ({ locale: 'fr' }),
}));

// The MUI X picker needs a LocalizationProvider; the form only needs its label.
vi.mock('@/app/components/CustomDatePicker', () => ({
  default: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('ReportGenerator', () => {
  it('renders localized form labels and actions', async () => {
    const onGenerate = vi.fn(async () => undefined);
    const onClose = vi.fn();
    const { ReportGenerator } = await import('./ReportGenerator');

    render(
      <ReportGenerator
        template={{
          id: 'pnl',
          name: 'PnL localise',
          description: 'Description locale',
          icon: EmptyIcon,
          category: 'financial',
          formats: ['excel', 'pdf'],
        }}
        onClose={onClose}
        onGenerate={onGenerate}
      />,
    );

    expect(screen.getByText('Date de debut')).toBeInTheDocument();
    expect(screen.getByText('Date de fin')).toBeInTheDocument();
    expect(screen.getByText('Format localise')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generer et telecharger' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('ReportGenerator per template', () => {
  const base = {
    name: 'Report',
    description: 'Description',
    icon: EmptyIcon,
    category: 'financial' as const,
    formats: ['excel' as const],
  };

  it('hides the period for a snapshot and still sends the reader\'s language', async () => {
    const onGenerate = vi.fn(async () => undefined);
    const { ReportGenerator } = await import('./ReportGenerator');

    render(
      <ReportGenerator
        template={{
          ...base,
          id: 'investment-holdings',
          period: 'none',
          scopeFilters: false,
          hint: 'A snapshot of today',
        }}
        onClose={vi.fn()}
        onGenerate={onGenerate}
      />,
    );

    expect(screen.queryByText('Date de debut')).not.toBeInTheDocument();
    expect(screen.getByText('A snapshot of today')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Generer et telecharger' }));
    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'investment-holdings', locale: 'fr' }),
    );
  });

  it('offers the period by default', async () => {
    const { ReportGenerator } = await import('./ReportGenerator');

    render(
      <ReportGenerator
        template={{ ...base, id: 'category-by-month', scopeFilters: false }}
        onClose={vi.fn()}
        onGenerate={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText('Date de debut')).toBeInTheDocument();
  });
});

describe('PERIOD_PRESETS', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // A mid-quarter day, deliberately late in a 31-day month.
    vi.setSystemTime(new Date(2026, 4, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes each range against the current date', async () => {
    const { PERIOD_PRESETS, presetRangeValues } = await import('./report-period-presets');

    const ranges = Object.fromEntries(
      PERIOD_PRESETS.map(preset => [preset.labelKey, presetRangeValues(preset)]),
    );

    expect(ranges.presetThisMonth).toEqual(['2026-05-01', '2026-05-20']);
    // April has 30 days: the end date must be the real last day, not the 31st.
    expect(ranges.presetLastMonth).toEqual(['2026-04-01', '2026-04-30']);
    expect(ranges.presetThisQuarter).toEqual(['2026-04-01', '2026-05-20']);
    expect(ranges.presetYearToDate).toEqual(['2026-01-01', '2026-05-20']);
  });
});
