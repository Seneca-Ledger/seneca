import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoice } from './contracts';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));

import { invoicesApi } from './invoices-api';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

// What GET /invoices/:id answers: the client, the amounts and the lines filled in.
const whole: Invoice = {
  id: 'inv-1',
  workspaceId: 'workspace-1',
  clientId: 'client-1',
  client: {
    id: 'client-1',
    workspaceId: 'workspace-1',
    name: 'Acme GmbH',
    email: 'billing@acme.example',
    billingAddress: null,
    taxId: null,
    currency: 'USD',
    locale: null,
    remindersEnabled: true,
    paymentTermsDays: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  },
  invoiceNumber: 'INV-0001',
  pricesIncludeTax: false,
  viewedAt: null,
  status: 'sent',
  issueDate: '2026-01-05',
  dueDate: '2026-02-04',
  currency: 'USD',
  subtotal: '301.00',
  taxTotal: '0.00',
  total: '301.00',
  amountPaid: 0,
  amountCredited: 0,
  amountDue: 301,
  notes: null,
  payableId: 'payable-1',
  journalEntryId: null,
  isRecurring: false,
  recurrenceInterval: null,
  nextIssueDate: null,
  recurrenceEndDate: null,
  lineItems: [],
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};

describe('invoicesApi writes', () => {
  beforeEach(() => {
    api.get.mockReset().mockResolvedValue({ data: whole });
    api.post.mockReset();
    api.put.mockReset();
  });

  // The write itself answers with the bare row: no client, no amounts.
  const bare = { id: 'inv-1', status: 'sent', total: 301 };

  it('reads the invoice back after creating it', async () => {
    api.post.mockResolvedValue({ data: bare });

    await expect(
      invoicesApi.create({ clientId: 'client-1', issueDate: '', dueDate: '', lineItems: [] }),
    ).resolves.toEqual(whole);
    expect(api.get).toHaveBeenCalledWith('/invoices/inv-1');
  });

  it.each([
    ['update', () => invoicesApi.update('inv-1', { notes: 'x' })],
    ['send', () => invoicesApi.send('inv-1')],
    ['void', () => invoicesApi.void('inv-1')],
  ])('reads the invoice back after %s', async (_name, write) => {
    api.put.mockResolvedValue({ data: bare });

    const result = await write();

    expect(result.client.email).toBe('billing@acme.example');
    expect(result.amountDue).toBe(301);
    expect(api.get).toHaveBeenCalledWith('/invoices/inv-1');
  });
});
