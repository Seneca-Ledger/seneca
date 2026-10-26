import type { Mock } from 'vitest';
import { createRepoMock } from '../../../helpers/create-repo-mock';
import { TaxRuleDirection } from '@/entities/tax-rule.entity';
import { TaxSource, type Transaction, TransactionType } from '@/entities/transaction.entity';
import { VatStatus } from '@/entities/workspace.entity';
import { TaxAssignmentService } from '@/modules/tax/tax-assignment.service';

describe('TaxAssignmentService', () => {
  let service: TaxAssignmentService;
  let ruleRepo: ReturnType<typeof createRepoMock>;
  let ratesService: {
    findOne: Mock;
    findByCodeForDate: Mock;
    findDefaultForDate: Mock;
  };
  let workspaceRepo: ReturnType<typeof createRepoMock> & { manager: { query: Mock } };
  let transactionRepo: ReturnType<typeof createRepoMock>;
  let workspace: { id: string; vatStatus: VatStatus; taxJurisdiction: { code: string; isEu: boolean } };

  const STANDARD_RATE = {
    id: 'rate-standard',
    code: 'KZ_STANDARD',
    rate: 12,
    isInclusive: true,
    isReverseCharge: false,
  };

  const REDUCED_RATE = {
    id: 'rate-reduced',
    code: 'KZ_REDUCED',
    rate: 0,
    isInclusive: true,
    isReverseCharge: false,
  };

  const base = {
    workspaceId: 'ws-1',
    transactionDate: '2025-06-01',
    amountMinor: 10000,
    categoryId: 'cat-1',
    transactionType: TransactionType.EXPENSE,
    transactionNature: 'goods',
  };

  const rule = (over: Partial<Record<string, unknown>> = {}) => ({
    id: 'rule-1',
    workspaceId: 'ws-1',
    categoryId: 'cat-1',
    taxRateCode: 'KZ_STANDARD',
    priority: 0,
    direction: TaxRuleDirection.BOTH,
    isEnabled: true,
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    ruleRepo = createRepoMock();
    ruleRepo.find.mockResolvedValue([]);
    ratesService = {
      findOne: vi.fn(),
      findByCodeForDate: vi.fn(),
      findDefaultForDate: vi.fn().mockResolvedValue(null),
    };
    workspace = {
      id: 'ws-1',
      vatStatus: VatStatus.REGISTERED,
      taxJurisdiction: { code: 'DE', isEu: true },
    };
    workspaceRepo = Object.assign(createRepoMock(), {
      manager: { query: vi.fn().mockResolvedValue([]) },
    });
    workspaceRepo.findOne.mockImplementation(async () => workspace);
    transactionRepo = createRepoMock();
    service = new TaxAssignmentService(
      ruleRepo,
      workspaceRepo as never,
      transactionRepo as never,
      ratesService as never,
    );
  });

  // ─── operations that are never a taxable supply ────────────

  describe('non-taxable operations', () => {
    it.each(['transfer', 'salary', 'loan', 'tax'])(
      'assesses nothing when the nature is %s',
      async nature => {
        ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);
        ruleRepo.find.mockResolvedValue([rule()]);

        const result = await service.resolve({ ...base, transactionNature: nature });

        expect(result.taxAmount).toBeNull();
        expect(result.taxSource).toBeNull();
        // A default rate being available must not override the exclusion.
        expect(ratesService.findDefaultForDate).not.toHaveBeenCalled();
      },
    );

    it('still taxes ordinary natures', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);

      for (const nature of ['goods', 'services', 'rent', 'commission', 'subscription']) {
        const result = await service.resolve({ ...base, transactionNature: nature });
        expect(result.taxSource).toBe(TaxSource.DEFAULT);
      }
    });
  });

  describe('uncategorised transactions', () => {
    it('assesses nothing, rather than guessing with the default rate', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);

      const result = await service.resolve({ ...base, categoryId: null });

      // An unclassified transfer the AI failed to label would otherwise be
      // taxed silently.
      expect(result.taxAmount).toBeNull();
      expect(ratesService.findDefaultForDate).not.toHaveBeenCalled();
    });

    it('does not apply to an explicitly chosen rate', async () => {
      ratesService.findOne.mockResolvedValue(STANDARD_RATE);

      const result = await service.resolve({
        ...base,
        categoryId: null,
        explicitTaxRateId: 'rate-standard',
      });

      expect(result.taxSource).toBe(TaxSource.MANUAL);
    });
  });

  // ─── precedence ────────────────────────────────────────────

  describe('an explicit rate', () => {
    it('wins over every rule and default', async () => {
      ruleRepo.find.mockResolvedValue([rule()]);
      ratesService.findOne.mockResolvedValue(REDUCED_RATE);
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);

      const result = await service.resolve({ ...base, explicitTaxRateId: 'rate-reduced' });

      expect(result).toMatchObject({ taxRateId: 'rate-reduced', taxSource: TaxSource.MANUAL });
      expect(ratesService.findByCodeForDate).not.toHaveBeenCalled();
    });

    it('assesses nothing when the rate is not the workspace’s', async () => {
      ratesService.findOne.mockRejectedValue(new Error('not found'));
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);

      const result = await service.resolve({ ...base, explicitTaxRateId: 'someone-elses-rate' });

      // Falling back here would tax the row at a rate the user did not choose.
      expect(result.taxAmount).toBeNull();
      expect(ratesService.findDefaultForDate).not.toHaveBeenCalled();
    });
  });

  describe('rules', () => {
    it('applies a rule matching the category', async () => {
      ruleRepo.find.mockResolvedValue([rule()]);
      ratesService.findByCodeForDate.mockResolvedValue(STANDARD_RATE);

      const result = await service.resolve(base);

      expect(result).toMatchObject({
        taxRateId: 'rate-standard',
        taxRuleId: 'rule-1',
        taxSource: TaxSource.RULE,
      });
    });

    it('resolves the rate code against the transaction date, not today', async () => {
      ruleRepo.find.mockResolvedValue([rule()]);
      ratesService.findByCodeForDate.mockResolvedValue(STANDARD_RATE);

      await service.resolve({ ...base, transactionDate: '2025-06-01' });

      expect(ratesService.findByCodeForDate).toHaveBeenCalledWith(
        'ws-1',
        'KZ_STANDARD',
        '2025-06-01',
      );
    });

    it('ignores a rule for the other direction', async () => {
      ruleRepo.find.mockResolvedValue([rule({ direction: TaxRuleDirection.INCOME })]);
      ratesService.findDefaultForDate.mockResolvedValue(REDUCED_RATE);

      const result = await service.resolve({ ...base, transactionType: TransactionType.EXPENSE });

      expect(result.taxSource).toBe(TaxSource.DEFAULT);
    });

    it('ignores a rule for another category', async () => {
      ruleRepo.find.mockResolvedValue([rule({ categoryId: 'cat-other' })]);
      ratesService.findDefaultForDate.mockResolvedValue(REDUCED_RATE);

      const result = await service.resolve(base);

      expect(result.taxSource).toBe(TaxSource.DEFAULT);
    });

    it('falls back to a catch-all rule', async () => {
      ruleRepo.find.mockResolvedValue([rule({ id: 'catch-all', categoryId: null })]);
      ratesService.findByCodeForDate.mockResolvedValue(STANDARD_RATE);

      const result = await service.resolve(base);

      expect(result.taxRuleId).toBe('catch-all');
    });

    it('prefers the higher priority', async () => {
      ruleRepo.find.mockResolvedValue([
        rule({ id: 'low', priority: 1 }),
        rule({ id: 'high', priority: 9 }),
      ]);
      ratesService.findByCodeForDate.mockResolvedValue(STANDARD_RATE);

      const result = await service.resolve(base);

      expect(result.taxRuleId).toBe('high');
    });

    it('prefers a category rule over a catch-all at equal priority', async () => {
      ruleRepo.find.mockResolvedValue([
        rule({ id: 'catch-all', categoryId: null }),
        rule({ id: 'specific', categoryId: 'cat-1' }),
      ]);
      ratesService.findByCodeForDate.mockResolvedValue(STANDARD_RATE);

      const result = await service.resolve(base);

      expect(result.taxRuleId).toBe('specific');
    });

    it('assesses nothing when the rule names a code with no version in force', async () => {
      ruleRepo.find.mockResolvedValue([rule()]);
      ratesService.findByCodeForDate.mockResolvedValue(null);
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);

      const result = await service.resolve(base);

      // Substituting a different rate would tax the row at a figure nobody
      // configured, and it would look deliberate afterwards.
      expect(result.taxAmount).toBeNull();
      expect(ratesService.findDefaultForDate).not.toHaveBeenCalled();
    });
  });

  describe('the workspace default', () => {
    it('applies when no rule matches', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);

      const result = await service.resolve(base);

      expect(result).toMatchObject({ taxSource: TaxSource.DEFAULT, taxRuleId: null });
    });

    it('assesses nothing when the workspace has no default for that date', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(null);

      const result = await service.resolve(base);

      expect(result.taxAmount).toBeNull();
      expect(result.taxSource).toBeNull();
    });
  });

  // ─── the figures ───────────────────────────────────────────

  describe('computed figures', () => {
    it('extracts 12% from a gross 100.00', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);

      const result = await service.resolve({ ...base, amountMinor: 10000 });

      expect(result.taxAmount).toBe(10.71);
      expect(result.taxNetAmount).toBe(89.29);
    });

    it('mirrors the figures for a refund', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);

      const result = await service.resolve({ ...base, amountMinor: -10000 });

      expect(result.taxAmount).toBe(-10.71);
      expect(result.taxNetAmount).toBe(-89.29);
    });

    it('charges nothing on a reverse-charge rate but keeps the flag', async () => {
      ratesService.findDefaultForDate.mockResolvedValue({
        ...STANDARD_RATE,
        isReverseCharge: true,
      });

      const result = await service.resolve(base);

      expect(result.taxAmount).toBe(0);
      expect(result.taxNetAmount).toBe(100);
      expect(result.taxReverseCharge).toBe(true);
    });

    it('accepts a rate arriving as a decimal string from the database', async () => {
      ratesService.findDefaultForDate.mockResolvedValue({ ...STANDARD_RATE, rate: '12.00' });

      const result = await service.resolve(base);

      expect(result.taxAmount).toBe(10.71);
    });
  });

  // ─── reverse charge ────────────────────────────────────────

  describe('reverse charge', () => {
    const b2bInPoland = {
      ...base,
      counterpartyCountry: 'PL',
      counterpartyVatId: 'PL1234567890',
    };

    beforeEach(() => {
      ratesService.findDefaultForDate.mockResolvedValue({ ...STANDARD_RATE, rate: 19 });
    });

    it('charges nothing but records what the tax would have been', async () => {
      const result = await service.resolve({ ...b2bInPoland, amountMinor: 100000 });

      expect(result.taxReverseCharge).toBe(true);
      expect(result.taxAmount).toBe(0);
      // Reported on both sides of the return, where the entries cancel.
      expect(result.taxNotionalAmount).toBe(190);
      expect(result.taxNetAmount).toBe(1000);
    });

    it('does not apply to a domestic supply', async () => {
      const result = await service.resolve({
        ...b2bInPoland,
        counterpartyCountry: 'DE',
      });

      expect(result.taxReverseCharge).toBe(false);
      expect(result.taxAmount).not.toBe(0);
    });

    it('does not apply without a VAT id, since that party is a consumer', async () => {
      const result = await service.resolve({ ...b2bInPoland, counterpartyVatId: null });
      expect(result.taxReverseCharge).toBe(false);
    });

    it('treats a blank VAT id as absent', async () => {
      const result = await service.resolve({ ...b2bInPoland, counterpartyVatId: '   ' });
      expect(result.taxReverseCharge).toBe(false);
    });

    it('does not apply when the counterparty is outside the EU', async () => {
      const result = await service.resolve({ ...b2bInPoland, counterpartyCountry: 'US' });
      expect(result.taxReverseCharge).toBe(false);
    });

    it('does not apply when the workspace itself is outside the EU', async () => {
      workspace.taxJurisdiction = { code: 'KZ', isEu: false };

      const result = await service.resolve(b2bInPoland);
      expect(result.taxReverseCharge).toBe(false);
    });

    it('recognises an EU country the jurisdiction catalogue does not carry', async () => {
      // France is a member state but not a country anyone files in here, so
      // deciding from the catalogue would tax this supply the ordinary way.
      const result = await service.resolve({ ...b2bInPoland, counterpartyCountry: 'FR' });
      expect(result.taxReverseCharge).toBe(true);
    });

    it('applies to a hand-picked rate too', async () => {
      ratesService.findOne.mockResolvedValue({ ...STANDARD_RATE, rate: 19 });

      const result = await service.resolve({
        ...b2bInPoland,
        explicitTaxRateId: 'rate-standard',
        amountMinor: 100000,
      });

      expect(result.taxSource).toBe(TaxSource.MANUAL);
      expect(result.taxReverseCharge).toBe(true);
      expect(result.taxAmount).toBe(0);
    });

    it('skips the payee lookup when nothing names the counterparty', async () => {
      await service.resolve(base);
      const sql = workspaceRepo.manager.query.mock.calls.map(([text]) => String(text));
      expect(sql.some(text => text.includes('payee'))).toBe(false);
    });

    it("uses the payee's country and VAT id when the row has none", async () => {
      ratesService.findDefaultForDate.mockResolvedValue({ ...STANDARD_RATE, rate: 19 });
      workspaceRepo.manager.query.mockImplementation(async (text: string) =>
        text.includes('FROM payees') ? [{ country_code: 'PL', vat_id: 'PL123' }] : [],
      );

      const result = await service.resolve({ ...base, payeeId: 'payee-1', amountMinor: 119000 });

      expect(workspaceRepo.manager.query).toHaveBeenCalledWith(expect.stringContaining('payees'), [
        'payee-1',
        'ws-1',
      ]);
      expect(result.taxReverseCharge).toBe(true);
      expect(result.taxAmount).toBe(0);
    });

    it('does not reverse-charge a payee whose VAT id VIES called invalid', async () => {
      ratesService.findDefaultForDate.mockResolvedValue({ ...STANDARD_RATE, rate: 19 });
      workspaceRepo.manager.query.mockImplementation(async (text: string) =>
        text.includes('FROM payees')
          ? [{ country_code: 'PL', vat_id: 'PL123', vat_id_status: 'invalid' }]
          : [],
      );

      const result = await service.resolve({ ...base, payeeId: 'payee-1', amountMinor: 119000 });

      expect(result.taxReverseCharge).toBe(false);
      expect(result.taxAmount).toBe(190);
    });

    it('still reverse-charges a VAT id VIES could not answer for', async () => {
      ratesService.findDefaultForDate.mockResolvedValue({ ...STANDARD_RATE, rate: 19 });
      workspaceRepo.manager.query.mockImplementation(async (text: string) =>
        text.includes('FROM payees')
          ? [{ country_code: 'PL', vat_id: 'PL123', vat_id_status: null }]
          : [],
      );

      const result = await service.resolve({ ...base, payeeId: 'payee-1', amountMinor: 119000 });

      expect(result.taxReverseCharge).toBe(true);
    });

    it('finds the payee by the descriptor when the row has no payee yet', async () => {
      ratesService.findDefaultForDate.mockResolvedValue({ ...STANDARD_RATE, rate: 19 });
      workspaceRepo.manager.query.mockImplementation(async (text: string) =>
        text.includes('payee_aliases')
          ? [{ payee_id: 'payee-9' }]
          : text.includes('FROM payees')
            ? [{ country_code: 'PL', vat_id: 'PL123' }]
            : [],
      );

      const result = await service.resolve({ ...base, counterpartyName: 'Acme Sp. z o.o.' });

      const payeeCall = workspaceRepo.manager.query.mock.calls.find(([text]) =>
        String(text).includes('FROM payees'),
      );
      expect(payeeCall?.[1]).toEqual(['payee-9', 'ws-1']);
      expect(result.taxReverseCharge).toBe(true);
    });

    it("prefers the row's own counterparty over the payee's", async () => {
      ratesService.findDefaultForDate.mockResolvedValue({ ...STANDARD_RATE, rate: 19 });

      const result = await service.resolve({
        ...base,
        payeeId: 'payee-1',
        counterpartyCountry: 'DE',
        counterpartyVatId: 'DE999',
      });

      const sql = workspaceRepo.manager.query.mock.calls.map(([text]) => String(text));
      expect(sql.some(text => text.includes('FROM payees'))).toBe(false);
      expect(result.taxReverseCharge).toBe(false);
    });

    it('fills the notional figure on ordinary supplies too', async () => {
      const result = await service.resolve({ ...base, amountMinor: 10000 });
      expect(result.taxNotionalAmount).toBe(result.taxAmount);
    });
  });

  // ─── outside VAT ───────────────────────────────────────────

  describe('system categories outside VAT', () => {
    const categorySql = (rows: Array<{ name: string; is_system: boolean }>) => async (text: string) =>
      text.includes('c.is_system') ? rows : [];

    it.each(['Interest income', 'Interest', 'Payroll', 'Benefits and compensation', 'Insurance'])(
      'assesses no default VAT on %s',
      async name => {
        ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);
        workspaceRepo.manager.query.mockImplementation(categorySql([{ name, is_system: true }]));

        expect((await service.resolve(base)).taxAmount).toBeNull();
      },
    );

    it('nor on a subcategory of one', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);
      workspaceRepo.manager.query.mockImplementation(
        categorySql([
          { name: 'Bank interest', is_system: false },
          { name: 'Interest', is_system: true },
        ]),
      );

      expect((await service.resolve(base)).taxAmount).toBeNull();
    });

    it('charges VAT on insurance in the UAE, where general insurance is taxable', async () => {
      workspace.taxJurisdiction = { code: 'AE', isEu: false };
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);
      workspaceRepo.manager.query.mockImplementation(categorySql([{ name: 'Insurance', is_system: true }]));

      expect((await service.resolve(base)).taxSource).toBe(TaxSource.DEFAULT);
    });

    it('goes by system categories only: a user category of the same name is taxed', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);
      workspaceRepo.manager.query.mockImplementation(categorySql([{ name: 'Interest', is_system: false }]));

      expect((await service.resolve(base)).taxSource).toBe(TaxSource.DEFAULT);
    });

    it("lets the user's own rule for the category win", async () => {
      ruleRepo.find.mockResolvedValue([rule()]);
      ratesService.findByCodeForDate.mockResolvedValue(STANDARD_RATE);
      workspaceRepo.manager.query.mockImplementation(categorySql([{ name: 'Insurance', is_system: true }]));

      expect((await service.resolve(base)).taxSource).toBe(TaxSource.RULE);
    });
  });

  // ─── tax payments ──────────────────────────────────────────

  describe('payments to the tax office', () => {
    const settingsSql = (config: unknown) => async (text: string) =>
      text.includes('workspace_service_settings') ? [{ config }] : [];

    it('assesses no VAT on the configured tax payments category', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);
      workspaceRepo.manager.query.mockImplementation(settingsSql({ paymentsCategoryId: 'cat-1' }));

      const result = await service.resolve(base);

      expect(result.taxAmount).toBeNull();
    });

    it('nor on its subcategories', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);
      workspaceRepo.manager.query.mockImplementation(async (text: string) =>
        text.includes('workspace_service_settings')
          ? [{ config: { paymentsCategoryId: 'cat-taxes' } }]
          : text.includes('parent_id FROM categories')
            ? [{ parent_id: 'cat-taxes' }]
            : [],
      );

      expect((await service.resolve(base)).taxAmount).toBeNull();
    });

    it('falls back to the seeded "Taxes" category until one is chosen', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);
      workspaceRepo.manager.query.mockImplementation(async (text: string) =>
        text.includes("LOWER(name) = 'taxes'") ? [{ id: 'cat-1' }] : [],
      );

      expect((await service.resolve(base)).taxAmount).toBeNull();
    });

    it('still taxes other categories', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);
      workspaceRepo.manager.query.mockImplementation(settingsSql({ paymentsCategoryId: 'cat-9' }));

      expect((await service.resolve(base)).taxSource).toBe(TaxSource.DEFAULT);
    });

    it('taxes everything when the user cleared the payments category', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);
      workspaceRepo.manager.query.mockImplementation(async (text: string) =>
        text.includes('workspace_service_settings')
          ? [{ config: { paymentsCategoryId: null } }]
          : text.includes("LOWER(name) = 'taxes'")
            ? [{ id: 'cat-1' }]
            : [],
      );

      expect((await service.resolve(base)).taxSource).toBe(TaxSource.DEFAULT);
    });
  });

  // ─── VAT status ────────────────────────────────────────────

  describe('workspaces that do not charge VAT', () => {
    it.each([VatStatus.NOT_REGISTERED, VatStatus.SMALL_BUSINESS])(
      'assesses nothing for %s, not even a hand-picked rate',
      async status => {
        workspace.vatStatus = status;
        ratesService.findOne.mockResolvedValue(STANDARD_RATE);
        ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);

        const byDefault = await service.resolve(base);
        const byHand = await service.resolve({ ...base, explicitTaxRateId: 'rate-standard' });

        expect(byDefault.taxAmount).toBeNull();
        expect(byHand.taxAmount).toBeNull();
        expect(byHand.taxRateId).toBeNull();
      },
    );
  });

  // ─── reassess ──────────────────────────────────────────────

  describe('reassess', () => {
    const stored = (over: Partial<Transaction> = {}): Transaction =>
      ({
        id: 'tx-1',
        workspaceId: 'ws-1',
        transactionDate: '2025-06-01',
        amount: 112,
        debit: 112,
        credit: null,
        categoryId: 'cat-1',
        transactionType: TransactionType.EXPENSE,
        transactionNature: null,
        counterpartyCountry: null,
        counterpartyVatId: null,
        payeeId: null,
        counterpartyName: '',
        paymentPurpose: '',
        taxRateId: null,
        taxRuleId: null,
        taxSource: null,
        taxAmount: null,
        taxNetAmount: null,
        taxReverseCharge: false,
        taxNotionalAmount: null,
        taxLocked: false,
        ...over,
      }) as unknown as Transaction;

    it('writes the new figures, and only for rows that change', async () => {
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);
      transactionRepo.find.mockResolvedValueOnce([
        stored({ id: 'tx-new' }),
        stored({
          id: 'tx-same',
          taxRateId: 'rate-standard',
          taxSource: TaxSource.DEFAULT,
          taxAmount: '12.00' as never,
          taxNetAmount: '100.00' as never,
          taxNotionalAmount: '12.00' as never,
        }),
      ]);

      const changed = await service.reassess('ws-1');

      expect(changed).toBe(1);
      expect(transactionRepo.update).toHaveBeenCalledTimes(1);
      expect(transactionRepo.update).toHaveBeenCalledWith(
        { id: 'tx-new', workspaceId: 'ws-1', taxLocked: false },
        expect.objectContaining({ taxRateId: 'rate-standard', taxAmount: 12, taxNetAmount: 100 }),
      );
    });

    it('only ever reads unlocked rows of the workspace', async () => {
      transactionRepo.find.mockResolvedValueOnce([]);

      await service.reassess('ws-1', { payeeId: 'payee-1' });

      expect(transactionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspaceId: 'ws-1', taxLocked: false, payeeId: 'payee-1' }),
        }),
      );
    });

    it('clears figures once the workspace stops charging VAT', async () => {
      workspace.vatStatus = VatStatus.NOT_REGISTERED;
      transactionRepo.find.mockResolvedValueOnce([
        stored({ taxRateId: 'rate-standard', taxSource: TaxSource.DEFAULT, taxAmount: 12 as never }),
      ]);

      await service.reassess('ws-1');

      expect(transactionRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ taxRateId: null, taxAmount: null }),
      );
    });

    it('keeps a rate the user picked by hand', async () => {
      ratesService.findOne.mockResolvedValue({ ...REDUCED_RATE, id: 'rate-hand', rate: 7 });
      ratesService.findDefaultForDate.mockResolvedValue(STANDARD_RATE);
      transactionRepo.find.mockResolvedValueOnce([
        stored({ taxRateId: 'rate-hand', taxSource: TaxSource.MANUAL, amount: 107 as never }),
      ]);

      await service.reassess('ws-1');

      expect(transactionRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ taxRateId: 'rate-hand', taxSource: TaxSource.MANUAL, taxAmount: 7 }),
      );
    });

    it('does nothing for an empty id list', async () => {
      expect(await service.reassess('ws-1', { ids: [] })).toBe(0);
      expect(transactionRepo.find).not.toHaveBeenCalled();
    });
  });
});
