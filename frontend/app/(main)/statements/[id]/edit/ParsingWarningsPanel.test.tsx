// @vitest-environment jsdom
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParsingWarningsPanel, formatDroppedSample } from './ParsingWarningsPanel';

describe('ParsingWarningsPanel', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  // DroppedSampleForm держит MUI-пикер даты: в приложении его контекст даёт providers.tsx.
  const renderPanel = (ui: React.ReactElement) =>
    root.render(<LocalizationProvider dateAdapter={AdapterDateFns}>{ui}</LocalizationProvider>);

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows each parsing warning as an actionable visible list item', async () => {
    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel
          warnings={[
            'Row 14: amount could not be matched confidently',
            'Row 27: ambiguous payment purpose detected',
          ]}
          title="Parsing warnings"
          helperText="Review the flagged rows before submitting this statement."
        />,
      );
    });

    expect(container.textContent).toContain('Parsing warnings');
    expect(container.textContent).toContain(
      'Review the flagged rows before submitting this statement.',
    );
    expect(container.textContent).toContain('Row 14: amount could not be matched confidently');
    expect(container.textContent).toContain('Row 27: ambiguous payment purpose detected');
  });

  it('renders nothing when there are no warnings', async () => {
    await act(async () => {
      renderPanel(<ParsingWarningsPanel warnings={[]} />);
    });

    expect(container.textContent).toBe('');
  });

  it('formats structured dropped samples into readable text', () => {
    expect(
      formatDroppedSample({
        reason: 'tx#14: skipped (invalid date)',
        transaction: {
          counterpartyName: 'Kaspi Pay',
          paymentPurpose: 'Payment for services',
        },
      }),
    ).toBe('tx#14: skipped (invalid date): Kaspi Pay - Payment for services');
  });

  it('enables convert action only after required dropped-row fields are filled', async () => {
    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel
          warnings={['tx#207: skipped (no debit/credit amount)']}
          droppedSamples={[
            {
              reason: 'tx#207: skipped (no debit/credit amount)',
              transaction: {
                transactionDate: '2026-03-17',
                counterpartyName: 'Kaspi Pay',
                paymentPurpose: 'Service payment',
              },
            },
          ]}
        />,
      );
    });

    const rowButton = Array.from(container.querySelectorAll('button')).find(button =>
      /#207Skipped \(no debit\/credit amount\)/.test(button.textContent ?? ''),
    ) as HTMLButtonElement | undefined;

    expect(rowButton).toBeTruthy();

    await act(async () => {
      rowButton?.click();
    });

    const convertButton = Array.from(document.body.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Convert to transaction'),
    ) as HTMLButtonElement | undefined;

    expect(convertButton).toBeTruthy();
    expect(convertButton?.disabled).toBe(true);
  });

  it('opens dropped-row editor in a modal after clicking the row', async () => {
    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel
          warnings={['tx#207: skipped (no debit/credit amount)']}
          droppedSamples={[
            {
              reason: 'tx#207: skipped (no debit/credit amount)',
              transaction: {
                transactionDate: '2026-03-17',
                counterpartyName: 'Kaspi Pay',
                paymentPurpose: 'Service payment',
              },
            },
          ]}
        />,
      );
    });

    const rowButton = Array.from(container.querySelectorAll('button')).find(button =>
      /#207Skipped \(no debit\/credit amount\)/.test(button.textContent ?? ''),
    ) as HTMLButtonElement | undefined;

    expect(rowButton).toBeTruthy();

    await act(async () => {
      rowButton?.click();
    });

    expect(document.body.textContent).toContain('Convert dropped row');
    const counterpartyInput = Array.from(document.body.querySelectorAll('input')).find(input =>
      (input.getAttribute('name') || '').includes('counterpartyName'),
    ) as HTMLInputElement | undefined;
    const purposeInput = Array.from(document.body.querySelectorAll('input')).find(input =>
      (input.getAttribute('name') || '').includes('paymentPurpose'),
    ) as HTMLInputElement | undefined;

    expect(counterpartyInput?.value).toBe('Kaspi Pay');
    expect(purposeInput?.value).toBe('Service payment');
  });

  it('opens editor for negative amount warnings too', async () => {
    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel
          warnings={['tx#189: skipped (negative amount)']}
          droppedSamples={[
            {
              reason: 'tx#189: skipped (negative amount)',
              transaction: {
                transactionDate: '2026-03-17',
                counterpartyName: 'Kaspi Pay',
                paymentPurpose: 'Service payment',
                debit: -1500,
              },
            },
          ]}
          fixTooltipLabel="Fix"
        />,
      );
    });

    const rowButton = Array.from(container.querySelectorAll('button')).find(button =>
      /#189Skipped \(negative amount\)/.test(button.textContent ?? ''),
    ) as HTMLButtonElement | undefined;

    expect(rowButton).toBeTruthy();

    await act(async () => {
      rowButton?.click();
    });

    expect(document.body.textContent).toContain('Convert dropped row');
  });

  it('opens currency picker drawer when currency field is clicked in dropped-row modal', async () => {
    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel
          warnings={['tx#203: skipped (negative amount)']}
          droppedSamples={[
            {
              reason: 'tx#203: skipped (negative amount)',
              transaction: {
                transactionDate: '2026-03-17',
                counterpartyName: 'CASPKZKA',
                paymentPurpose: 'Service payment',
                currency: 'KZT',
              },
            },
          ]}
        />,
      );
    });

    const rowButton = Array.from(container.querySelectorAll('button')).find(button =>
      /#203Skipped \(negative amount\)/.test(button.textContent ?? ''),
    ) as HTMLButtonElement | undefined;

    expect(rowButton).toBeTruthy();

    await act(async () => {
      rowButton?.click();
    });

    const currencyInput = Array.from(document.body.querySelectorAll('input')).find(input =>
      (input.getAttribute('name') || '').includes('currency'),
    ) as HTMLInputElement | undefined;

    expect(currencyInput).toBeTruthy();
    expect(document.body.textContent).not.toContain('Select a currency');

    await act(async () => {
      currencyInput?.click();
    });

    expect(document.body.textContent).toContain('Select a currency');
    expect(document.body.textContent).toContain('Recents');
    expect(document.body.textContent).toContain('All');

    // Тёмная тема у CurrencyDrawer теперь из токенов (sx + CSS-переменные), а не из
    // dark:bg-[#…] классов — проверяем, что поиск в шторке есть.
    const searchInput = Array.from(document.body.querySelectorAll('input')).find(
      input => input.getAttribute('placeholder') === 'Search',
    );
    expect(searchInput).toBeTruthy();
  });

  it('matches editable warning rows by transaction number, not only full reason text', async () => {
    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel
          warnings={['tx#209: skipped (negative amount) [review]']}
          droppedSamples={[
            {
              reason: 'tx#209: skipped (negative amount)',
              transaction: {
                transactionDate: '2026-03-17',
                counterpartyName: 'Kaspi Pay',
                paymentPurpose: 'Service payment',
                debit: -1500,
              },
            },
          ]}
          fixTooltipLabel="Fix"
        />,
      );
    });

    const rowButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('#209Skipped (negative amount) [review]'),
    ) as HTMLButtonElement | undefined;

    expect(rowButton).toBeTruthy();

    await act(async () => {
      rowButton?.click();
    });

    expect(document.body.textContent).toContain('Convert dropped row');
  });

  it('opens editor for repairable warning rows even when dropped sample payload is missing', async () => {
    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel
          warnings={[
            'tx#243: skipped (negative amount)',
            'tx#245: skipped (no debit/credit amount)',
          ]}
          fixTooltipLabel="Fix"
        />,
      );
    });

    const rowButton = Array.from(container.querySelectorAll('button')).find(button =>
      /#245Skipped \(no debit\/credit amount\)/.test(button.textContent ?? ''),
    ) as HTMLButtonElement | undefined;

    expect(rowButton).toBeTruthy();

    await act(async () => {
      rowButton?.click();
    });

    expect(document.body.textContent).toContain('Convert dropped row');
  });

  it('renders balance mismatch warning as an actionable item', async () => {
    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel
          warnings={['Balance mismatch: expected 1000.00 got 800.00 (diff 200.00)']}
          fixTooltipLabel="Fix"
        />,
      );
    });

    const rowButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Balance mismatch: expected 1000.00 got 800.00 (diff 200.00)'),
    ) as HTMLButtonElement | undefined;

    expect(rowButton).toBeTruthy();
  });

  it('names the balance check on a balance mismatch row', async () => {
    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel
          warnings={['Balance mismatch: expected 1000.00 got 800.00 (diff 200.00)']}
          resolveBalanceTooltipLabel="Check balance"
        />,
      );
    });

    const row = container.querySelector('.seneca-parse-warnings__item--action');
    expect(row?.textContent).toContain('Balance mismatch: expected 1000.00 got 800.00');
    expect(row?.querySelector('.seneca-parse-warnings__fix')?.textContent).toBe('Check balance');
  });

  it('names the fix on a fixable row, in the label it was given', async () => {
    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel
          warnings={['tx#207: skipped (no debit/credit amount)']}
          droppedSamples={[
            {
              reason: 'tx#207: skipped (no debit/credit amount)',
              transaction: {
                transactionDate: '2026-03-17',
                counterpartyName: 'Kaspi Pay',
                paymentPurpose: 'Service payment',
              },
            },
          ]}
          fixTooltipLabel="Fix"
        />,
      );
    });

    const row = container.querySelector('.seneca-parse-warnings__item--action');
    expect(row?.textContent).toContain('Skipped (no debit/credit amount)');
    expect(row?.querySelector('.seneca-parse-warnings__fix')?.textContent).toBe('Fix');
  });

  it('does not render a separate dropped-rows list under warnings', async () => {
    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel
          warnings={['tx#207: skipped (no debit/credit amount)']}
          droppedSamples={[
            {
              reason: 'tx#207: skipped (no debit/credit amount)',
              transaction: {
                transactionDate: '2026-03-17',
                counterpartyName: 'Kaspi Pay',
                paymentPurpose: 'Service payment',
              },
            },
          ]}
          fixTooltipLabel="Fix"
        />,
      );
    });

    const text = container.textContent || '';
    const matches = text.match(/Skipped \(no debit\/credit amount\)/g) || [];

    expect(matches).toHaveLength(1);
  });

  it('converts a dropped row after a valid amount is entered', async () => {
    const onConvertDroppedSample = vi.fn();

    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel
          warnings={['tx#207: skipped (no debit/credit amount)']}
          droppedSamples={[
            {
              reason: 'tx#207: skipped (no debit/credit amount)',
              transaction: {
                transactionDate: '2026-03-17',
                counterpartyName: 'Kaspi Pay',
                paymentPurpose: 'Service payment',
              },
            },
          ]}
          onConvertDroppedSample={onConvertDroppedSample}
        />,
      );
    });

    const rowButton = Array.from(container.querySelectorAll('button')).find(button =>
      /#207Skipped \(no debit\/credit amount\)/.test(button.textContent ?? ''),
    ) as HTMLButtonElement | undefined;

    expect(rowButton).toBeTruthy();

    await act(async () => {
      rowButton?.click();
    });

    const amountInput = Array.from(document.body.querySelectorAll('input')).find(input =>
      (input.getAttribute('name') || '').includes('debit'),
    ) as HTMLInputElement | undefined;

    expect(amountInput).toBeTruthy();
    if (!amountInput) {
      throw new Error('Expected debit input to exist');
    }

    await act(async () => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(amountInput, '1250');
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      amountInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const convertButton = Array.from(document.body.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Convert to transaction'),
    ) as HTMLButtonElement | undefined;

    expect(convertButton?.disabled).toBe(false);

    await act(async () => {
      convertButton?.click();
    });

    expect(onConvertDroppedSample).toHaveBeenCalledWith({
      index: 0,
      warning: 'tx#207: skipped (no debit/credit amount)',
      sample: expect.objectContaining({
        reason: 'tx#207: skipped (no debit/credit amount)',
        transaction: expect.objectContaining({
          transactionDate: '2026-03-17',
          debit: 1250,
          counterpartyName: 'Kaspi Pay',
          paymentPurpose: 'Service payment',
        }),
      }),
    });
  });
  it('puts the row number in its own column and folds a long list', async () => {
    const reason = 'skipped (no debit/credit amount)';
    const warnings = Array.from({ length: 20 }, (_, index) => `tx#${index + 1}: ${reason}`);
    await act(async () => {
      renderPanel(<ParsingWarningsPanel warnings={warnings} />);
    });

    const rows = () => container.querySelectorAll('.seneca-parse-warnings__row');
    expect(rows()).toHaveLength(5);
    expect(rows()[0].textContent).toBe('#1');
    expect(container.querySelector('.seneca-parse-warnings__message')?.textContent).toBe(
      'Skipped (no debit/credit amount)',
    );

    const more = container.querySelector<HTMLButtonElement>('.seneca-parse-warnings__more');
    expect(more?.textContent).toBe(`Show all ${warnings.length}`);
    await act(async () => {
      more?.click();
    });
    expect(rows()).toHaveLength(warnings.length);
  });

  it('does not fold a list only one line too long', async () => {
    await act(async () => {
      renderPanel(
        <ParsingWarningsPanel warnings={Array.from({ length: 6 }, (_, i) => `Row ${i}: odd`)} />,
      );
    });
    expect(container.querySelectorAll('.seneca-parse-warnings__item')).toHaveLength(6);
    expect(container.querySelector('.seneca-parse-warnings__more')).toBeNull();
  });
});
