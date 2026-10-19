// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Insight } from '@/app/hooks/useInsights';
import AdvicePage from './page';

const insight = (overrides: Partial<Insight>): Insight => ({
  id: 'i',
  type: 'workflow.tip',
  category: 'workflow',
  severity: 'info',
  title: 'Title',
  message: 'Message',
  messageKey: null,
  messageParams: null,
  data: null,
  createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  ...overrides,
});

const dismiss = vi.fn();
const items = [
  insight({ id: 'savings', type: 'trend.savings_rate', title: 'Savings rate is up' }),
  insight({ id: 'figma', type: 'pattern.detected', title: 'Figma now costs 25% more' }),
  insight({ id: 'august', type: 'workflow.tip', title: 'All August statements are reconciled' }),
];

const refresh = vi.hoisted(() => ({ mutate: vi.fn(), workspaceId: 'ws-1' as string | null }));

vi.mock('@/app/hooks/useInsights', () => ({
  useInsights: () => ({ items, isPending: false, dismiss }),
  useRefreshInsights: () => ({ mutate: refresh.mutate }),
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => refresh.workspaceId }));
vi.mock('@/app/components/insights/insight-href', () => ({ insightHref: () => '/somewhere' }));
// Every dictionary entry renders as its own key.
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_, key: string) => ({ value: key, toString: () => key }) }),
  useLocale: () => ({ locale: 'en' }),
}));

describe('AdvicePage', () => {
  it('puts what asks for something first, with an ochre dot, and the rest after', () => {
    const { container } = render(<AdvicePage />);

    const [attention, info] = screen.getAllByRole('heading').map(heading => heading.parentElement);
    expect(screen.getAllByRole('heading').map(heading => heading.textContent)).toEqual([
      'needsAttention',
      'forYourInfo',
    ]);
    expect(within(attention as HTMLElement).getByText('Figma now costs 25% more')).toBeTruthy();
    expect(within(info as HTMLElement).getByText('Savings rate is up')).toBeTruthy();
    expect(container.querySelectorAll('.lumio-advice__dot')).toHaveLength(1);
    expect(screen.getAllByText('2 days ago')).toHaveLength(3);
  });

  it('recomputes on open, but only once the workspace is known', () => {
    refresh.mutate.mockReset();
    refresh.workspaceId = null;
    const { rerender } = render(<AdvicePage />);
    // Without a workspace the server answers 403 (a fresh browser's first load).
    expect(refresh.mutate).not.toHaveBeenCalled();

    refresh.workspaceId = 'ws-1';
    rerender(<AdvicePage />);
    expect(refresh.mutate).toHaveBeenCalledWith('en');
  });

  it('lets a line be dismissed', () => {
    render(<AdvicePage />);

    fireEvent.click(screen.getByRole('button', { name: 'dismiss: Figma now costs 25% more' }));
    expect(dismiss).toHaveBeenCalledWith('figma');
  });
});
