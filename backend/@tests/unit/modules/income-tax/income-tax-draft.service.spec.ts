import { createRepoMock } from '../../../helpers/create-repo-mock';
import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { TransactionType } from '@/entities/transaction.entity';
import { IncomeTaxDraftService } from '@/modules/income-tax/income-tax-draft.service';
import { BadRequestException } from '@nestjs/common';

function queryBuilder(result: { many?: unknown[]; raw?: unknown[] }) {
  const builder: Record<string, jest.Mock> = {};
  for (const method of [
    'leftJoin',
    'leftJoinAndSelect',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'select',
    'addSelect',
    'groupBy',
  ]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.getMany = jest.fn().mockResolvedValue(result.many ?? []);
  builder.getRawMany = jest.fn().mockResolvedValue(result.raw ?? []);
  return builder;
}

describe('IncomeTaxDraftService', () => {
  const DE = { id: 'j-de', code: 'DE', name: 'Germany', currency: 'EUR' };

  let service: IncomeTaxDraftService;
  let profileRepo: ReturnType<typeof createRepoMock>;
  let mappingRepo: ReturnType<typeof createRepoMock> & { manager: { transaction: jest.Mock } };
  let categoryRepo: ReturnType<typeof createRepoMock>;
  let transactionRepo: ReturnType<typeof createRepoMock>;
  let adoption: { getCurrentJurisdiction: jest.Mock };
  let exchangeRates: { getRateOrNull: jest.Mock };
  let completeness: { check: jest.Mock };
  let nbpRates: { getYearRates: jest.Mock };
  let bdiRates: { getYearRates: jest.Mock };
  let auditService: { createEvent: jest.Mock };

  const tx = (over: Record<string, unknown>) => ({
    id: 'tx',
    transactionDate: '2025-03-10',
    counterpartyName: 'ACME',
    currency: 'EUR',
    transactionType: TransactionType.EXPENSE,
    amount: '100.00',
    categoryId: 'cat-rent',
    category: { name: 'Rent' },
    ...over,
  });

  beforeEach(() => {
    profileRepo = createRepoMock();
    mappingRepo = Object.assign(createRepoMock(), { manager: { transaction: jest.fn() } });
    categoryRepo = createRepoMock();
    transactionRepo = createRepoMock();
    adoption = { getCurrentJurisdiction: jest.fn().mockResolvedValue(DE) };
    exchangeRates = {
      getRateOrNull: jest.fn(async (from: string) => (from === 'USD' ? 0.9 : null)),
    };
    completeness = { check: jest.fn().mockResolvedValue({ score: 77, issues: [] }) };
    nbpRates = { getYearRates: jest.fn().mockResolvedValue(null) };
    bdiRates = { getYearRates: jest.fn().mockResolvedValue(null) };
    auditService = { createEvent: jest.fn().mockResolvedValue(undefined) };

    profileRepo.findOne.mockResolvedValue(null);
    mappingRepo.find.mockResolvedValue([
      { categoryId: 'cat-rent', lineKey: 'rent' },
      { categoryId: 'cat-sales', lineKey: 'revenue_vatable' },
      { categoryId: 'cat-private', lineKey: 'not_business' },
      { categoryId: 'cat-stale', lineKey: 'line_that_no_longer_exists' },
    ]);

    service = new IncomeTaxDraftService(
      profileRepo as never,
      mappingRepo as never,
      categoryRepo as never,
      transactionRepo as never,
      adoption as never,
      exchangeRates as never,
      completeness as never,
      nbpRates as never,
      bdiRates as never,
      auditService as never,
    );
  });

  it('refuses to build a draft without a tax country', async () => {
    adoption.getCurrentJurisdiction.mockResolvedValue(null);
    await expect(service.compute('ws-1', 2025)).rejects.toThrow(BadRequestException);
  });

  it('counts only confirmed lines, converts at the transaction date and reports what it left out', async () => {
    transactionRepo.createQueryBuilder.mockReturnValue(
      queryBuilder({
        many: [
          tx({
            id: 'sale',
            transactionType: TransactionType.INCOME,
            amount: '1000.00',
            categoryId: 'cat-sales',
            category: { name: 'Sales' },
          }),
          tx({ id: 'rent-usd', currency: 'USD', amount: '-100.00' }),
          tx({ id: 'rent-refund', transactionType: TransactionType.INCOME, amount: '10.00' }),
          tx({ id: 'rent-gbp', currency: 'GBP' }),
          tx({ id: 'private', categoryId: 'cat-private', category: { name: 'Private' } }),
          tx({ id: 'uncategorized', categoryId: null, category: null }),
          tx({ id: 'unmapped', categoryId: 'cat-other', category: { name: 'Hobby' } }),
          tx({ id: 'stale', categoryId: 'cat-stale', category: { name: 'Old' } }),
        ],
      }),
    );

    const draft = await service.compute('ws-1', 2025);
    const figure = (key: string) => draft.figures.find(f => f.key === key);

    expect(exchangeRates.getRateOrNull).toHaveBeenCalledWith('USD', 'EUR', '2025-03-10', 'ws-1');
    expect(figure('revenue_vatable')?.amount).toBe(1000);
    expect(figure('rent')).toMatchObject({ amount: 80, transactionCount: 2 });
    expect(figure('profit')?.amount).toBe(920);
    expect(draft.contributions.rent.map(c => [c.transactionId, c.amountConverted])).toEqual([
      ['rent-usd', 90],
      ['rent-refund', -10],
    ]);
    expect(draft.contributions.not_business).toBeUndefined();

    expect(completeness.check).toHaveBeenCalledWith('ws-1', 2025, {
      transactionCount: 8,
      uncategorizedCount: 1,
      unmappedTransactionCount: 2,
      unmappedCategories: [
        { categoryId: 'cat-other', name: 'Hobby', transactionCount: 1 },
        { categoryId: 'cat-stale', name: 'Old', transactionCount: 1 },
      ],
      missingFxCount: 1,
      missingFxCurrencies: ['GBP'],
    });
    expect(draft).toMatchObject({
      currency: 'EUR',
      pack: { formKey: 'de-euer', isGeneric: false },
      completeness: { score: 77 },
      disclaimerVersion: expect.any(String),
    });
  });

  it('builds the year from confirmed transactions only', async () => {
    const builder = queryBuilder({});
    transactionRepo.createQueryBuilder.mockReturnValue(builder);

    await service.compute('ws-1', 2026);

    // compute and countByCategory both go through yearTransactions.
    const built = transactionRepo.createQueryBuilder.mock.calls.length;
    const confirmed = builder.andWhere.mock.calls.filter(
      ([sql]) => sql === 't.isVerified = true',
    ).length;
    expect(built).toBeGreaterThan(0);
    expect(confirmed).toBe(built);
  });

  it('says so when the line numbers come from an earlier form edition', async () => {
    transactionRepo.createQueryBuilder.mockReturnValue(queryBuilder({}));

    const draft = await service.compute('ws-1', 2026);

    expect(draft.warnings[0]).toEqual({
      code: 'form_edition_older',
      params: { formEditionYear: 2025 },
    });
    expect(draft.taxEstimate).not.toBeNull();
  });

  it('falls back to the generic summary for a country without a verified form', async () => {
    adoption.getCurrentJurisdiction.mockResolvedValue({ ...DE, code: 'AT', name: 'Austria' });
    mappingRepo.find.mockResolvedValue([]);
    transactionRepo.createQueryBuilder.mockReturnValue(queryBuilder({}));

    const draft = await service.compute('ws-1', 2025);

    expect(draft.pack).toMatchObject({ formKey: 'generic-annual-summary', isGeneric: true });
    expect(draft.taxEstimate).toBeNull();
  });

  it('converts Polish amounts at the NBP rate of the previous business day, not the market rate', async () => {
    adoption.getCurrentJurisdiction.mockResolvedValue({
      id: 'j-pl',
      code: 'PL',
      name: 'Poland',
      currency: 'PLN',
    });
    profileRepo.findOne.mockResolvedValue({
      taxpayerType: 'self_employed',
      details: { regime: 'liniowy' },
    });
    mappingRepo.find.mockResolvedValue([{ categoryId: 'cat-sales', lineKey: 'revenue' }]);
    nbpRates.getYearRates.mockResolvedValue([
      { effectiveDate: '2025-01-03', mid: 4.28 },
      { effectiveDate: '2025-01-07', mid: 4.26 },
    ]);
    transactionRepo.createQueryBuilder.mockReturnValue(
      queryBuilder({
        many: [
          tx({
            id: 'invoice-eur',
            transactionDate: '2025-01-07',
            transactionType: TransactionType.INCOME,
            currency: 'EUR',
            amount: '100.00',
            categoryId: 'cat-sales',
            category: { name: 'Sales' },
          }),
        ],
      }),
    );

    const draft = await service.compute('ws-1', 2025);

    expect(nbpRates.getYearRates).toHaveBeenCalledWith('EUR', 2025);
    expect(exchangeRates.getRateOrNull).not.toHaveBeenCalled();
    expect(draft.contributions.revenue[0]).toMatchObject({
      exchangeRate: 4.28,
      rateDate: '2025-01-03',
      amountConverted: 428,
    });
    expect(draft).toMatchObject({
      fxRule: 'nbp_previous_business_day',
      pack: { formKey: 'pl-pit36l' },
      filingInfo: { formName: 'PIT-36L' },
    });
  });

  it("converts Italian amounts at Banca d'Italia's rate of the nearest earlier day", async () => {
    adoption.getCurrentJurisdiction.mockResolvedValue({
      id: 'j-it',
      code: 'IT',
      name: 'Italy',
      currency: 'EUR',
    });
    profileRepo.findOne.mockResolvedValue({ taxpayerType: 'self_employed', details: {} });
    mappingRepo.find.mockResolvedValue([{ categoryId: 'cat-sales', lineKey: 'income' }]);
    bdiRates.getYearRates.mockResolvedValue({
      daily: [{ date: '2025-03-07', perEuro: 1.0827 }],
      monthly: {},
    });
    transactionRepo.createQueryBuilder.mockReturnValue(
      queryBuilder({
        many: [
          tx({
            id: 'invoice-usd',
            transactionDate: '2025-03-09',
            transactionType: TransactionType.INCOME,
            currency: 'USD',
            amount: '100.00',
            categoryId: 'cat-sales',
            category: { name: 'Sales' },
          }),
        ],
      }),
    );

    const draft = await service.compute('ws-1', 2025);

    expect(bdiRates.getYearRates).toHaveBeenCalledWith('USD', 2025);
    expect(exchangeRates.getRateOrNull).not.toHaveBeenCalled();
    expect(draft.contributions.income[0]).toMatchObject({
      rateDate: '2025-03-07',
      amountConverted: 92.36,
    });
    expect(draft).toMatchObject({
      fxRule: 'bdi_reference_rate',
      filingInfo: { formName: 'Redditi Persone Fisiche 2026' },
    });
  });

  describe('getMappings', () => {
    it('marks confirmed, suggested and unmapped categories', async () => {
      categoryRepo.find.mockResolvedValue([
        { id: 'cat-rent', name: 'Rent', type: 'expense', isSystem: true },
        { id: 'cat-ads', name: 'Advertising', type: 'expense', isSystem: true },
        { id: 'cat-hobby', name: 'Hobby', type: 'expense', isSystem: false },
      ]);
      transactionRepo.createQueryBuilder.mockReturnValue(
        queryBuilder({ raw: [{ categoryId: 'cat-ads', count: '4' }] }),
      );

      const result = await service.getMappings('ws-1', 2025);

      expect(result.categories.map(c => [c.categoryId, c.lineKey, c.status, c.transactionCount])).toEqual([
        ['cat-rent', 'rent', 'confirmed', 0],
        ['cat-ads', 'advertising', 'suggested', 4],
        ['cat-hobby', null, 'unmapped', 0],
      ]);
    });
  });

  describe('saveMappings', () => {
    it('rejects a line the form does not have', async () => {
      await expect(
        service.saveMappings('ws-1', 'user-1', 2025, [{ categoryId: 'c1', lineKey: 'made_up' }]),
      ).rejects.toThrow(BadRequestException);
      expect(mappingRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('rejects categories from another workspace', async () => {
      categoryRepo.count.mockResolvedValue(1);

      await expect(
        service.saveMappings('ws-1', 'user-1', 2025, [
          { categoryId: 'mine', lineKey: 'rent' },
          { categoryId: 'theirs', lineKey: 'rent' },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(mappingRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('upserts confirmations and deletes withdrawals in one transaction', async () => {
      categoryRepo.count.mockResolvedValue(2);
      const manager = { delete: jest.fn(), upsert: jest.fn() };
      mappingRepo.manager.transaction.mockImplementation(async (work: (m: unknown) => unknown) =>
        work(manager),
      );
      categoryRepo.find.mockResolvedValue([]);
      transactionRepo.createQueryBuilder.mockReturnValue(queryBuilder({}));

      await service.saveMappings('ws-1', 'user-1', 2025, [
        { categoryId: 'c1', lineKey: 'advertising' },
        { categoryId: 'c2', lineKey: null },
        { categoryId: 'c1', lineKey: 'rent' },
      ]);

      expect(manager.delete).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ workspaceId: 'ws-1', formKey: 'de-euer' }),
      );
      expect(manager.upsert).toHaveBeenCalledWith(
        expect.anything(),
        [expect.objectContaining({ categoryId: 'c1', lineKey: 'rent', confirmedBy: 'user-1' })],
        ['workspaceId', 'formKey', 'categoryId'],
      );
    });

    it('audits only the assignments that changed', async () => {
      categoryRepo.count.mockResolvedValue(3);
      mappingRepo.manager.transaction.mockImplementation(async (work: (m: unknown) => unknown) =>
        work({ delete: jest.fn(), upsert: jest.fn() }),
      );
      categoryRepo.find.mockResolvedValue([]);
      transactionRepo.createQueryBuilder.mockReturnValue(queryBuilder({}));
      mappingRepo.find.mockResolvedValue([
        { categoryId: 'cat-rent', lineKey: 'rent' },
        { categoryId: 'cat-ads', lineKey: 'rent' },
      ]);

      await service.saveMappings('ws-1', 'user-1', 2025, [
        { categoryId: 'cat-rent', lineKey: 'rent' },
        { categoryId: 'cat-ads', lineKey: 'advertising' },
        { categoryId: 'cat-new', lineKey: null },
      ]);

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          actorId: 'user-1',
          entityType: EntityType.TAX_RETURN,
          entityId: 'ws-1',
          action: AuditAction.UPDATE,
          diff: { before: { 'cat-ads': 'rent' }, after: { 'cat-ads': 'advertising' } },
          meta: expect.objectContaining({ taxYear: 2025, changedCategoryIds: ['cat-ads'] }),
        }),
      );
    });

    it('does not fail the save when the audit log fails', async () => {
      categoryRepo.count.mockResolvedValue(1);
      mappingRepo.manager.transaction.mockImplementation(async (work: (m: unknown) => unknown) =>
        work({ delete: jest.fn(), upsert: jest.fn() }),
      );
      categoryRepo.find.mockResolvedValue([]);
      transactionRepo.createQueryBuilder.mockReturnValue(queryBuilder({}));
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(
        service.saveMappings('ws-1', 'user-1', 2025, [{ categoryId: 'c9', lineKey: 'rent' }]),
      ).resolves.toMatchObject({ formKey: 'de-euer' });
    });
  });

  describe('saveProfile', () => {
    it('audits the profile change with before and after', async () => {
      profileRepo.findOne.mockResolvedValue({ taxpayerType: 'self_employed', details: {} });
      profileRepo.upsert = jest.fn().mockResolvedValue(undefined);

      await service.saveProfile('ws-1', 2025, 'self_employed', { vatRegistered: true }, 'user-1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          actorId: 'user-1',
          entityType: EntityType.TAX_RETURN,
          entityId: 'ws-1',
          action: AuditAction.UPDATE,
          diff: {
            before: { taxpayerType: 'self_employed', details: {} },
            after: { taxpayerType: 'self_employed', details: { vatRegistered: true } },
          },
          meta: { kind: 'income_tax_profile', taxYear: 2025 },
        }),
      );
    });

    it('does not fail the save when the audit log fails', async () => {
      profileRepo.upsert = jest.fn().mockResolvedValue(undefined);
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(
        service.saveProfile('ws-1', 2025, 'self_employed', {}, 'user-1'),
      ).resolves.toMatchObject({ taxYear: 2025 });
    });
  });
});
