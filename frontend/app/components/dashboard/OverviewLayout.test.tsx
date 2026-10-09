// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { DEFAULT_OVERVIEW_ROWS, type OverviewSectionId } from './overview-layout';
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
      }),
  };
});

function sections(overrides: Partial<Record<OverviewSectionId, React.ReactNode>> = {}) {
  const all = Object.fromEntries(
    DEFAULT_OVERVIEW_ROWS.flat().map(id => [id, <div key={id}>{id} card</div>]),
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
      data: { state: { overviewRows: [['net-worth', 'kpis'], ['goals']] } },
    });

    renderWithQuery(<OverviewLayout sections={sections()} />);

    await waitFor(() => expect(order().slice(0, 3)).toEqual(['net-worth', 'kpis', 'goals']));
    expect(api.get).toHaveBeenCalledWith('/view-preferences/dashboard', expect.anything());
    expect(sectionOf('net-worth card')).not.toHaveClass('lumio-overview__section--wide');
    expect(sectionOf('kpis card')).not.toHaveClass('lumio-overview__section--wide');
    expect(sectionOf('goals card')).toHaveClass('lumio-overview__section--wide');
  });

  it('lets a half take the whole row when its partner has nothing to show', async () => {
    api.get.mockResolvedValue({ data: { state: null } });

    renderWithQuery(<OverviewLayout sections={sections({ budgets: null })} />);

    await waitFor(() =>
      expect(sectionOf('cash-runway card')).toHaveClass('lumio-overview__section--wide'),
    );
    expect(sectionOf('top-categories card')).not.toHaveClass('lumio-overview__section--wide');
  });

  it('gives every section a grip to drag it by', async () => {
    api.get.mockResolvedValue({ data: { state: null } });

    renderWithQuery(<OverviewLayout sections={sections()} />);

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Drag to move' })).toHaveLength(
        DEFAULT_OVERVIEW_ROWS.flat().length,
      ),
    );
  });

  it('offers a way back to the shipped layout only once it was changed', async () => {
    api.get.mockResolvedValue({ data: { state: { overviewRows: [['activity'], ['kpis']] } } });

    renderWithQuery(<OverviewLayout sections={sections()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reset layout' }));

    expect(api.put).toHaveBeenCalledWith('/view-preferences/dashboard', {
      state: { overviewRows: DEFAULT_OVERVIEW_ROWS },
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Reset layout' })).not.toBeInTheDocument(),
    );
    expect(order()[0]).toBe('kpis');
  });
});
