// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();

vi.mock('@/app/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));

import type { TaxRateItem } from '@/app/lib/contracts';
import { categoryItem } from '@/app/test/fixtures/contracts';
import { TaxRulesSection } from './TaxRulesSection';

const CATEGORIES = [
  categoryItem({ id: 'cat-rent', name: 'Аренда' }),
  categoryItem({ id: 'cat-food', name: 'Материалы' }),
];

// The wire format (packages/contracts TaxRateItem).
const taxRate = (fields: Pick<TaxRateItem, 'id' | 'code' | 'name' | 'rate'>): TaxRateItem => ({
  isDefault: false,
  isEnabled: true,
  jurisdictionId: null,
  kind: 'standard',
  validFrom: '1900-01-01',
  validTo: null,
  isInclusive: false,
  isReverseCharge: false,
  ...fields,
});

const RATES = [
  taxRate({ id: 'r1', code: 'KZ_STANDARD', name: 'НДС 16%', rate: '16.00' }),
  taxRate({ id: 'r2', code: 'KZ_ZERO', name: 'НДС 0%', rate: '0.00' }),
  // Hand-made rates have no code, so a rule cannot name one.
  taxRate({ id: 'r3', code: null, name: 'Custom 7%', rate: '7.00' }),
];

function mockApi({ rules = [] as unknown[], rates = RATES } = {}) {
  get.mockImplementation(async (url: string) => {
    if (url === '/tax/rules') return { data: rules };
    if (url === '/categories') return { data: CATEGORIES };
    if (url === '/tax/settings/rates') return { data: rates };
    throw new Error(`unexpected ${url}`);
  });
}

describe('TaxRulesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockResolvedValue({ data: {} });
    del.mockResolvedValue({ data: {} });
  });

  it('explains the default when there are no rules', async () => {
    mockApi();
    render(<TaxRulesSection />);

    expect(await screen.findByText(/uses the workspace default rate/)).toBeInTheDocument();
  });

  it('asks for a jurisdiction before rules can point anywhere', async () => {
    mockApi({ rates: [] });
    render(<TaxRulesSection />);

    expect(await screen.findByText(/Pick a tax jurisdiction first/)).toBeInTheDocument();
  });

  it('offers only rates that carry a code', async () => {
    mockApi();
    render(<TaxRulesSection />);

    await userEvent.click(await screen.findByLabelText('Rate'));
    const listbox = within(await screen.findByRole('listbox'));

    expect(listbox.getByText('НДС 16%')).toBeInTheDocument();
    // A rule stores a code, so a code-less rate could never be resolved.
    expect(listbox.queryByText('Custom 7%')).not.toBeInTheDocument();
  });

  it('lists an existing rule against its category', async () => {
    mockApi({
      rules: [
        {
          id: 'rule-1',
          categoryId: 'cat-rent',
          taxRateCode: 'KZ_ZERO',
          priority: 0,
          direction: 'expense',
          isEnabled: true,
        },
      ],
    });
    render(<TaxRulesSection />);

    expect(await screen.findByText('Аренда')).toBeInTheDocument();
    expect(screen.getByText('KZ_ZERO')).toBeInTheDocument();
  });

  it('describes a catch-all rule as covering any category', async () => {
    mockApi({
      rules: [
        {
          id: 'rule-1',
          categoryId: null,
          taxRateCode: 'KZ_STANDARD',
          priority: 0,
          direction: 'both',
          isEnabled: true,
        },
      ],
    });
    render(<TaxRulesSection />);

    // Scoped to the list: the category picker also displays "Any category" as
    // its empty value, so an unscoped query matches twice.
    const list = within(await screen.findByRole('list', { name: 'Tax rules' }));
    expect(list.getByText('Any category')).toBeInTheDocument();
  });

  it('cannot add a rule without a rate', async () => {
    mockApi();
    render(<TaxRulesSection />);

    expect(await screen.findByRole('button', { name: 'Add rule' })).toBeDisabled();
  });

  it('adds a rule', async () => {
    mockApi();
    render(<TaxRulesSection />);

    await userEvent.click(await screen.findByLabelText('Rate'));
    await userEvent.click(within(await screen.findByRole('listbox')).getByText('НДС 0%'));
    await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/tax/rules', {
        categoryId: undefined,
        taxRateCode: 'KZ_ZERO',
        direction: 'both',
      }),
    );
  });

  it('surfaces the server’s reason for rejecting a rule', async () => {
    mockApi();
    post.mockRejectedValue({
      response: { data: { error: { message: 'A rule for this category already exists.' } } },
    });
    render(<TaxRulesSection />);

    await userEvent.click(await screen.findByLabelText('Rate'));
    await userEvent.click(within(await screen.findByRole('listbox')).getByText('НДС 0%'));
    await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));

    // The server says which constraint failed; a generic line would hide it.
    expect(await screen.findByText('A rule for this category already exists.')).toBeInTheDocument();
  });

  it('deletes a rule', async () => {
    mockApi({
      rules: [
        {
          id: 'rule-1',
          categoryId: 'cat-rent',
          taxRateCode: 'KZ_ZERO',
          priority: 0,
          direction: 'expense',
          isEnabled: true,
        },
      ],
    });
    render(<TaxRulesSection />);

    await userEvent.click(await screen.findByRole('button', { name: /Delete rule for Аренда/ }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/tax/rules/rule-1'));
  });

  it('reports a failure to load rather than showing an empty editor', async () => {
    get.mockRejectedValue(new Error('offline'));
    render(<TaxRulesSection />);

    expect(await screen.findByText('Could not load tax rules.')).toBeInTheDocument();
  });
});
