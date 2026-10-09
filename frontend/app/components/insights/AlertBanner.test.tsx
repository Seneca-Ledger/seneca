import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({
  default: { get: apiMocks.get, post: apiMocks.post },
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'workspace-1' } }),
}));

vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: 'en' }),
  useIntlayer: () => ({
    dismiss: { value: 'Dismiss' },
    openLabel: { value: 'Open' },
  }),
}));

import { renderWithQuery } from '../../test/query-wrapper';
import { AlertBanner } from './AlertBanner';

function insight(overrides: Record<string, unknown> = {}) {
  return {
    id: 'insight-1',
    type: 'trend.spending_up',
    category: 'trend',
    severity: 'warn',
    title: 'Category is rising',
    message: 'Spending on "Marketing and advertising" is 118% above its 3-month average',
    messageKey: 'trend.category_rising',
    messageParams: { category: 'Marketing and advertising', percent: 118 },
    data: { categoryId: 'cat-1', categoryName: 'Marketing and advertising' },
    createdAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('AlertBanner', () => {
  beforeEach(() => {
    apiMocks.get.mockReset();
    apiMocks.post.mockReset();
    apiMocks.post.mockResolvedValue({ data: {} });
  });

  it('links the banner body to where the problem can be looked at', async () => {
    apiMocks.get.mockResolvedValue({ data: { items: [insight()] } });

    renderWithQuery(<AlertBanner />);

    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute(
      'href',
      '/reports?tab=cash-flow&focus=category%3Amarketing%20and%20advertising',
    );
    expect(link).toHaveTextContent('Category is rising');
  });

  it('keeps the link off ButtonBase, so the light-theme hover fill does not cover the banner', async () => {
    apiMocks.get.mockResolvedValue({ data: { items: [insight()] } });

    renderWithQuery(<AlertBanner />);

    // _globals.scss paints every non-contained .MuiButtonBase-root on hover
    // with an !important muted fill that sx cannot override.
    expect(await screen.findByRole('link')).not.toHaveClass('MuiButtonBase-root');
  });

  it('leaves an insight with no destination as a plain notice', async () => {
    apiMocks.get.mockResolvedValue({
      data: { items: [insight({ type: 'ai.summary', data: null })] },
    });

    renderWithQuery(<AlertBanner />);

    await screen.findByText('Category is rising');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('keeps dismiss outside the link, so closing does not navigate', async () => {
    apiMocks.get.mockResolvedValue({ data: { items: [insight()] } });

    renderWithQuery(<AlertBanner />);

    const dismiss = await screen.findByRole('button', { name: 'Dismiss' });
    expect(screen.getByRole('link')).not.toContainElement(dismiss);

    await userEvent.click(dismiss);

    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith('/insights/insight-1/dismiss'));
  });
});
