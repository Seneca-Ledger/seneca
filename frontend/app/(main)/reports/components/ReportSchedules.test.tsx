// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({ labels: {} }),
  useLocale: () => ({ locale: 'de' }),
}));

const schedules = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: vi.fn(async () => schedules.rows),
}));

const post = vi.fn(async (_url: string, _body: unknown) => ({}));
vi.mock('@/app/lib/api', () => ({
  default: { post: (url: string, body: unknown) => post(url, body) },
}));

const templates = [
  { id: 'pnl', name: 'P&L', formats: ['pdf' as const, 'excel' as const, 'csv' as const] },
  { id: 'balance-sheet', name: 'Balance Sheet', formats: ['pdf' as const, 'excel' as const] },
];

function openSelect(index: number): HTMLElement {
  fireEvent.mouseDown(screen.getAllByRole('combobox')[index]);
  return screen.getByRole('listbox');
}

describe('ReportSchedules', () => {
  it("offers only the formats the chosen template can be written in, and sends the reader's language", async () => {
    const { ReportSchedules } = await import('./ReportSchedules');
    render(<ReportSchedules templates={templates} />);

    // Report, frequency, format — in that order.
    fireEvent.click(within(openSelect(0)).getByRole('option', { name: 'Balance Sheet' }));
    const formats = within(openSelect(2))
      .getAllByRole('option')
      .map(option => option.textContent);
    expect(formats).toEqual(['PDF', 'EXCEL']);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /schedule|save|add/i }));

    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({
      templateId: 'balance-sheet',
      format: 'pdf',
      locale: 'de',
    });
  });

  it('names the on/off switch of each schedule', async () => {
    schedules.rows = [
      {
        id: 's1',
        templateId: 'pnl',
        format: 'pdf',
        cadence: 'weekly',
        recipients: ['a@example.com'],
        walletIds: [],
        categoryIds: [],
        groupBy: null,
        locale: null,
        isActive: true,
        lastRunAt: null,
        nextRunAt: '2026-10-20T08:00:00.000Z',
        lastError: null,
        createdAt: '2026-10-01T08:00:00.000Z',
      },
    ];
    const { ReportSchedules } = await import('./ReportSchedules');
    render(<ReportSchedules templates={templates} />);

    expect(await screen.findByRole('switch', { name: 'Active' })).toBeChecked();
    schedules.rows = [];
  });
});
