// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import {
  DEFAULT_OVERVIEW_ROWS,
  OVERVIEW_SECTION_IDS,
  type OverviewSectionId,
} from './overview-layout';
import { OverviewLayout } from './OverviewLayout';

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import('./__tests__/intlayer-mock');
  return {
    useIntlayer: () =>
      autoDictionary({
        layoutDragHandle: value('Drag to move'),
        layoutReset: value('Reset layout'),
        pickerButton: value('Widgets'),
      }),
  };
});

function sections(overrides: Partial<Record<OverviewSectionId, React.ReactNode>> = {}) {
  const all = Object.fromEntries(
    OVERVIEW_SECTION_IDS.map(id => [id, <div key={id}>{id} card</div>]),
  ) as Record<OverviewSectionId, React.ReactNode>;
  return { ...all, ...overrides };
}

function sectionOf(text: string): HTMLElement {
  const section = screen.getByText(text).closest<HTMLElement>('[data-overview-section]');
  if (!section) {
    throw new Error(`no section around ${text}`);
  }
  return section;
}

/** Columns of the twelve a section spans. */
function spanOf(text: string): string {
  return sectionOf(text).style.getPropertyValue('--overview-span');
}

function order(): string[] {
  return [...document.querySelectorAll('[data-overview-section]')].map(
    node => node.getAttribute('data-overview-section') ?? '',
  );
}

describe('OverviewLayout', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.put.mockReset().mockResolvedValue({ data: {} });
  });

  it('lays the sections out as this person left them', async () => {
    api.get.mockResolvedValue({
      data: {
        state: {
          overviewRows: [
            ['getting-started'],
            ['net-worth', 'kpi-income', 'kpi-net'],
            ['goals'],
          ],
        },
      },
    });

    renderWithQuery(<OverviewLayout sections={sections()} />);

    await waitFor(() =>
      expect(order().slice(0, 5)).toEqual([
        'getting-started',
        'net-worth',
        'kpi-income',
        'kpi-net',
        'goals',
      ]),
    );
    expect(api.get).toHaveBeenCalledWith('/view-preferences/dashboard', expect.anything());
    expect(spanOf('net-worth card')).toBe('6');
    expect(spanOf('kpi-income card')).toBe('3');
    expect(spanOf('kpi-net card')).toBe('3');
    expect(spanOf('goals card')).toBe('12');
  });

  it('opens a layout saved before the tiles moved apart with the four tiles in its place', async () => {
    api.get.mockResolvedValue({
      data: { state: { overviewRows: [['getting-started'], ['goals'], ['kpis']] } },
    });

    renderWithQuery(<OverviewLayout sections={sections()} />);

    await waitFor(() =>
      expect(order().slice(0, 6)).toEqual([
        'getting-started',
        'goals',
        'kpi-income',
        'kpi-spent',
        'kpi-net',
        'kpi-savings',
      ]),
    );
    expect(spanOf('kpi-savings card')).toBe('3');
  });

  it('lets a half take the whole row when its partner has nothing to show', async () => {
    api.get.mockResolvedValue({ data: { state: null } });

    renderWithQuery(<OverviewLayout sections={sections({ 'recent-transactions': null })} />);

    await waitFor(() => expect(spanOf('top-categories card')).toBe('12'));
    expect(spanOf('cash-runway card')).toBe('6');
  });

  it('gives every section, each KPI tile included, a grip to drag it by', async () => {
    api.get.mockResolvedValue({ data: { state: null } });

    renderWithQuery(<OverviewLayout sections={sections()} />);

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Drag to move' })).toHaveLength(
        DEFAULT_OVERVIEW_ROWS.flat().length,
      ),
    );
  });

  it('offers a way back to the shipped layout only once it was changed', async () => {
    api.get.mockResolvedValue({ data: { state: { overviewRows: [['activity'], ['crypto']] } } });

    renderWithQuery(<OverviewLayout sections={sections()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reset layout' }));

    expect(api.put).toHaveBeenCalledWith('/view-preferences/dashboard', {
      state: { overviewRows: DEFAULT_OVERVIEW_ROWS, hiddenSections: [] },
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Reset layout' })).not.toBeInTheDocument(),
    );
    expect(order().slice(0, 2)).toEqual(['getting-started', 'kpi-income']);
  });

  it('switches on a widget that is off by default from the picker', async () => {
    api.get.mockResolvedValue({ data: { state: null } });

    renderWithQuery(<OverviewLayout sections={sections()} />);

    expect(screen.queryByText('taxes card')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /Widgets/ }));
    const taxes = screen.getByRole('menuitemcheckbox', { name: 'sections.taxes' });
    expect(taxes).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(taxes);

    expect(api.put).toHaveBeenCalledWith('/view-preferences/dashboard', {
      state: { overviewRows: [...DEFAULT_OVERVIEW_ROWS, ['taxes']], hiddenSections: [] },
    });
    expect(await screen.findByText('taxes card')).toBeInTheDocument();
  });

  it('hides a section from the picker and keeps it hidden', async () => {
    api.get.mockResolvedValue({ data: { state: null } });

    renderWithQuery(<OverviewLayout sections={sections()} />);

    fireEvent.click(await screen.findByRole('button', { name: /Widgets/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'sections.netWorth' }));

    await waitFor(() => expect(screen.queryByText('net-worth card')).toBeNull());
    const saved = api.put.mock.calls[0][1].state;
    expect(saved.hiddenSections).toEqual(['net-worth']);
    expect(saved.overviewRows.flat()).not.toContain('net-worth');
    expect(screen.getByRole('menuitemcheckbox', { name: 'sections.netWorth' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
