// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateInvoiceInput } from '@/app/lib/invoices-api';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';

/** Every dictionary read answers its own path, so assertions name keys, not translations. */
function dictionary(path: string[] = []): unknown {
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === 'value' || key === Symbol.toPrimitive || key === 'toString') {
          const text = path.join('.');
          return key === 'value' ? text : () => text;
        }
        return dictionary([...path, String(key)]);
      },
    },
  );
}

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => dictionary(),
  useLocale: () => ({ locale: 'en' }),
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { currency: 'EUR' } }),
}));

const clientsList = vi.fn();
vi.mock('@/app/lib/invoices-api', () => ({
  clientsApi: { list: () => clientsList(), create: vi.fn() },
  invoicesApi: { lateFeeQuote: vi.fn() },
}));

vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: async () => [
    { id: 'vat19', name: 'VAT', rate: '19' },
    { id: 'vat7', name: 'Reduced', rate: '7' },
  ],
}));

import { InvoiceWizard } from './InvoiceWizard';
import { useInvoiceForm } from './useInvoiceForm';

function Harness({
  startAtReview = false,
  onSave,
}: {
  startAtReview?: boolean;
  onSave: (payload: CreateInvoiceInput) => void;
}) {
  const form = useInvoiceForm(true);
  return (
    <InvoiceWizard
      form={form}
      startAtReview={startAtReview}
      saving={false}
      onSave={() => onSave(form.buildPayload())}
    />
  );
}

const next = () => screen.getByRole('button', { name: 'next' });
const heading = () => screen.getByRole('heading', { level: 2 }).textContent;

async function pickClient(): Promise<void> {
  const trigger = await screen.findByRole('combobox');
  selectOption(trigger, 'Acme GmbH');
}

describe('InvoiceWizard', () => {
  beforeEach(() => {
    clientsList.mockResolvedValue([{ id: 'c1', name: 'Acme GmbH', paymentTermsDays: 30 }]);
  });

  it('asks for a client before anything else', async () => {
    renderWithQuery(<Harness onSave={vi.fn()} />);
    expect(heading()).toBe('client.title');
    expect(next()).toBeDisabled();
    await pickClient();
    expect(next()).toBeEnabled();
    fireEvent.click(next());
    expect(heading()).toBe('items.title');
  });

  it('offers to add the first client when there are none', async () => {
    clientsList.mockResolvedValue([]);
    renderWithQuery(<Harness onSave={vi.fn()} />);
    expect(await screen.findByText('client.empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'client.add' })).toBeInTheDocument();
  });

  it('holds the items step until every line says what it is for', async () => {
    renderWithQuery(<Harness onSave={vi.fn()} />);
    await pickClient();
    fireEvent.click(next());
    expect(next()).toBeDisabled();
    fireEvent.change(screen.getByLabelText('detail.description'), {
      target: { value: 'Design work' },
    });
    expect(next()).toBeEnabled();
  });

  it('saves what the steps collected, with one tax rate on every line', async () => {
    const onSave = vi.fn();
    renderWithQuery(<Harness onSave={onSave} />);
    await pickClient();
    fireEvent.click(next());

    fireEvent.change(screen.getByLabelText('detail.description'), {
      target: { value: 'Design work' },
    });
    fireEvent.change(screen.getByLabelText('detail.unitPrice'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'items.addLine' }));
    fireEvent.change(screen.getAllByLabelText('detail.description')[1], {
      target: { value: 'Hosting' },
    });
    fireEvent.click(next());

    expect(heading()).toBe('tax.title');
    fireEvent.click(screen.getByRole('radio', { name: /tax\.inclusiveTitle/ }));
    selectOption(screen.getByRole('combobox', { name: 'detail.taxRate' }), 'VAT (19%)');
    fireEvent.click(next());

    expect(heading()).toBe('dates.title');
    fireEvent.click(next());
    expect(heading()).toBe('extras.title');
    fireEvent.click(screen.getByRole('button', { name: 'skip' }));

    expect(heading()).toBe('review.title');
    fireEvent.click(screen.getByRole('button', { name: 'saveDraft' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0] as CreateInvoiceInput;
    expect(payload).toMatchObject({
      clientId: 'c1',
      pricesIncludeTax: true,
      lineItems: [
        { description: 'Design work', quantity: 1, unitPrice: 100, taxRateId: 'vat19' },
        { description: 'Hosting', quantity: 1, unitPrice: 0, taxRateId: 'vat19' },
      ],
    });
    // The client's 30-day terms set the due date.
    const days =
      (Date.parse(payload.dueDate) - Date.parse(payload.issueDate)) / (24 * 60 * 60 * 1000);
    expect(days).toBe(30);
  });

  it('opens a saved draft on the review and returns there after an edit', async () => {
    renderWithQuery(<Harness startAtReview onSave={vi.fn()} />);
    expect(heading()).toBe('review.title');
    fireEvent.click(screen.getByRole('button', { name: 'edit: review.dates' }));
    expect(heading()).toBe('dates.title');
    fireEvent.click(screen.getByRole('button', { name: 'backToReview' }));
    await waitFor(() => expect(heading()).toBe('review.title'));
  });
});
