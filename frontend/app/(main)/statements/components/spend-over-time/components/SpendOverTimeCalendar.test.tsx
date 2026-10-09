import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpendOverTimeRecord } from '@/app/(main)/statements/components/spend-over-time.utils';
import { SpendOverTimeCalendar } from './SpendOverTimeCalendar';

const createRecord = (overrides: Partial<SpendOverTimeRecord> = {}): SpendOverTimeRecord => ({
  id: 'record-1',
  source: 'statement',
  fileName: 'Kaspi',
  subject: null,
  sender: null,
  status: 'completed',
  fileType: 'expense',
  createdAt: '2025-12-08T00:00:00Z',
  statementDateFrom: '2025-12-08',
  statementDateTo: null,
  bankName: 'Kaspi',
  totalDebit: 100,
  totalCredit: null,
  currency: 'KZT',
  exported: null,
  paid: null,
  parsingDetails: null,
  user: null,
  receivedAt: null,
  parsedData: null,
  sourceType: 'statement',
  sourceChannel: 'bank',
  flowType: 'expense',
  amount: 100,
  currencyValue: 'KZT',
  dateValue: '2025-12-08',
  transactionId: 'tx-1',
  workspaceId: 'ws-1',
  workspaceName: 'Main workspace',
  merchant: 'Kaspi',
  paymentPurpose: 'Payment',
  ...overrides,
});

describe('SpendOverTimeCalendar', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders the month it is given and opens the day that has records', () => {
    const onDayClick = vi.fn();
    act(() => {
      root.render(
        <SpendOverTimeCalendar
          records={[createRecord()]}
          month={new Date(2025, 11, 1)}
          currency="KZT"
          onDayClick={onDayClick}
          labels={{ emptyMonth: 'Empty month', operations: 'operations' }}
        />,
      );
    });

    const day = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.lumio-spend-calendar__day--active'),
    );
    expect(day).toHaveLength(1);
    expect(day[0].textContent).toContain('8');

    act(() => {
      day[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onDayClick).toHaveBeenCalledWith('2025-12-08');
  });

  it('shows the empty label for a month without records', () => {
    act(() => {
      root.render(
        <SpendOverTimeCalendar
          records={[createRecord()]}
          month={new Date(2025, 10, 1)}
          currency="KZT"
          onDayClick={vi.fn()}
          labels={{ emptyMonth: 'Empty month', operations: 'operations' }}
        />,
      );
    });

    expect(container.textContent).toContain('Empty month');
    expect(container.querySelectorAll('.lumio-spend-calendar__day--active')).toHaveLength(0);
  });
});
