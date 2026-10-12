import { createRepoMock } from '../../../helpers/create-repo-mock';
import { TaxRatesService } from '@/modules/tax/tax-rates.service';
import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TaxRatesService', () => {
  let service: TaxRatesService;
  let repo: ReturnType<typeof createRepoMock>;
  let auditService: { createEvent: jest.Mock };

  /**
   * Default clearing is period-scoped, so it runs through a query builder
   * rather than a plain repository.update. This stubs the fluent chain and
   * hands back the spies for assertion.
   */
  const mockUpdateQueryBuilder = () => {
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    repo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createRepoMock();
    repo.create.mockImplementation((input: unknown) => input);
    repo.save.mockImplementation(async (input: unknown) => input);
    auditService = { createEvent: jest.fn().mockResolvedValue(undefined) };
    service = new TaxRatesService(repo, auditService as never);
  });

  // ─── findAll ───────────────────────────────────────────────

  describe('findAll', () => {
    it('returns tax rates for workspace ordered by default, rate, name', async () => {
      const mockRates = [{ id: '1', name: 'VAT', rate: 20 }];
      repo.find.mockResolvedValue(mockRates);

      const result = await service.findAll('ws-1');
      expect(result).toEqual(mockRates);
      expect(repo.find).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        order: { isDefault: 'DESC', rate: 'ASC', name: 'ASC' },
      });
    });
  });

  // ─── findOne ───────────────────────────────────────────────

  describe('findOne', () => {
    it('returns tax rate by id and workspaceId', async () => {
      const mockRate = { id: 'rate-1', workspaceId: 'ws-1', name: 'VAT' };
      repo.findOne.mockResolvedValue(mockRate);

      const result = await service.findOne('rate-1', 'ws-1');
      expect(result).toEqual(mockRate);
    });

    it('throws NotFoundException when tax rate not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', 'ws-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ────────────────────────────────────────────────

  describe('create', () => {
    it('creates a tax rate', async () => {
      repo.findOne.mockResolvedValue(null); // no duplicate
      const dto = { name: 'VAT 20%', rate: 20, isDefault: false };

      const result = await service.create('ws-1', dto);
      expect(result).toMatchObject({ workspaceId: 'ws-1', name: 'VAT 20%', rate: 20 });
    });

    it('trims the name', async () => {
      repo.findOne.mockResolvedValue(null);
      const dto = { name: '  VAT  ', rate: 10 };

      const result = await service.create('ws-1', dto);
      expect(result).toMatchObject({ name: 'VAT' });
    });

    it('throws BadRequestException for empty name', async () => {
      await expect(service.create('ws-1', { name: '   ', rate: 10 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for duplicate name', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing', name: 'VAT' });
      await expect(service.create('ws-1', { name: 'VAT', rate: 20 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('unsets defaults overlapping the new rate period', async () => {
      repo.findOne.mockResolvedValue(null);
      const qb = mockUpdateQueryBuilder();

      await service.create('ws-1', { name: 'New Default', rate: 15, isDefault: true });

      expect(qb.set).toHaveBeenCalledWith({ isDefault: false });
      // A hand-made rate spans the whole timeline, so it displaces every
      // default currently set.
      expect(qb.andWhere).toHaveBeenCalledWith('valid_from <= :newTo', { newTo: '9999-12-31' });
    });

    it('defaults isEnabled to true', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.create('ws-1', { name: 'VAT', rate: 20 });
      expect(result).toMatchObject({ isEnabled: true });
    });
  });

  // ─── update ────────────────────────────────────────────────

  describe('update', () => {
    it('updates tax rate fields', async () => {
      const existing = { id: 'rate-1', workspaceId: 'ws-1', name: 'Old', rate: 10 };
      repo.findOne
        .mockResolvedValueOnce(existing) // findOne in update
        .mockResolvedValueOnce(null); // duplicate check

      await service.update('rate-1', 'ws-1', { name: 'New Name', rate: 25 });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name', rate: 25 }),
      );
    });

    it('throws NotFoundException for nonexistent rate', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('nope', 'ws-1', { rate: 5 })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for empty name on update', async () => {
      repo.findOne.mockResolvedValue({ id: 'rate-1', workspaceId: 'ws-1' });
      await expect(service.update('rate-1', 'ws-1', { name: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for duplicate name from different rate', async () => {
      const existing = { id: 'rate-1', workspaceId: 'ws-1', name: 'Old' };
      repo.findOne
        .mockResolvedValueOnce(existing) // findOne
        .mockResolvedValueOnce({ id: 'rate-2', name: 'Taken' }); // duplicate

      await expect(service.update('rate-1', 'ws-1', { name: 'Taken' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows updating name to current name (same id)', async () => {
      const existing = { id: 'rate-1', workspaceId: 'ws-1', name: 'Same' };
      repo.findOne
        .mockResolvedValueOnce(existing) // findOne
        .mockResolvedValueOnce({ id: 'rate-1', name: 'Same' }); // same record

      await expect(service.update('rate-1', 'ws-1', { name: 'Same' })).resolves.toBeDefined();
    });

    it('unsets defaults overlapping the edited rate period, excluding itself', async () => {
      const existing = {
        id: 'rate-1',
        workspaceId: 'ws-1',
        name: 'Rate',
        validFrom: '2026-01-01',
        validTo: null,
      };
      repo.findOne.mockResolvedValue(existing);
      const qb = mockUpdateQueryBuilder();

      await service.update('rate-1', 'ws-1', { isDefault: true });

      expect(qb.set).toHaveBeenCalledWith({ isDefault: false });
      // Scoped to the edited rate's own period: the KZ 12% and 16% rows are
      // both defaults, and promoting one must not demote the other.
      expect(qb.andWhere).toHaveBeenCalledWith('COALESCE(valid_to, :forever) >= :newFrom', {
        forever: '9999-12-31',
        newFrom: '2026-01-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('id != :exceptId', { exceptId: 'rate-1' });
    });
  });

  // ─── remove ────────────────────────────────────────────────

  describe('remove', () => {
    it('removes a tax rate', async () => {
      const existing = { id: 'rate-1', workspaceId: 'ws-1' };
      repo.findOne.mockResolvedValue(existing);

      await service.remove('rate-1', 'ws-1');
      expect(repo.remove).toHaveBeenCalledWith(existing);
    });

    it('throws NotFoundException for nonexistent rate', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('nope', 'ws-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── audit ─────────────────────────────────────────────────

  describe('audit', () => {
    it('records a CREATE with the workspace and actor', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (input: object) => ({ id: 'rate-9', ...input }));

      await service.create('ws-1', { name: 'VAT', rate: 20 }, 'user-1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          actorId: 'user-1',
          entityType: EntityType.TAX_RATE,
          entityId: 'rate-9',
          action: AuditAction.CREATE,
          diff: { before: null, after: expect.objectContaining({ name: 'VAT', rate: 20 }) },
        }),
      );
    });

    it('records an UPDATE with before and after', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 'rate-1', workspaceId: 'ws-1', name: 'Old', rate: 10 })
        .mockResolvedValueOnce(null);

      await service.update('rate-1', 'ws-1', { name: 'New', rate: 25 }, 'user-1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          entityId: 'rate-1',
          action: AuditAction.UPDATE,
          diff: {
            before: expect.objectContaining({ name: 'Old', rate: 10 }),
            after: expect.objectContaining({ name: 'New', rate: 25 }),
          },
        }),
      );
    });

    it('records a DELETE with the removed rate as before', async () => {
      repo.findOne.mockResolvedValue({ id: 'rate-1', workspaceId: 'ws-1', name: 'VAT' });

      await service.remove('rate-1', 'ws-1', 'user-1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          entityType: EntityType.TAX_RATE,
          entityId: 'rate-1',
          action: AuditAction.DELETE,
          diff: { before: expect.objectContaining({ name: 'VAT' }), after: null },
        }),
      );
    });

    it('does not fail the write when the audit log fails', async () => {
      repo.findOne.mockResolvedValue({ id: 'rate-1', workspaceId: 'ws-1', name: 'VAT' });
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(service.remove('rate-1', 'ws-1', 'user-1')).resolves.toBeUndefined();
      expect(repo.remove).toHaveBeenCalled();
    });

    it('logs nothing when the write is refused', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing', name: 'VAT' });

      await expect(service.create('ws-1', { name: 'VAT', rate: 20 }, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(auditService.createEvent).not.toHaveBeenCalled();
    });
  });

  // ─── createDefaultTaxRates ─────────────────────────────────

  describe('createDefaultTaxRates', () => {
    it('creates default rate when workspace has none', async () => {
      repo.count.mockResolvedValue(0);
      await service.createDefaultTaxRates('ws-1');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          name: 'Tax exempt (0%)',
          rate: 0,
          isDefault: true,
        }),
      );
    });

    it('skips when workspace already has tax rates', async () => {
      repo.count.mockResolvedValue(3);
      await service.createDefaultTaxRates('ws-1');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
  // ─── startNewVersion ───────────────────────────────────────

  describe('startNewVersion', () => {
    const current = {
      id: 'rate-19',
      workspaceId: 'ws-1',
      jurisdictionId: 'de',
      code: 'DE_STANDARD',
      kind: 'standard',
      name: 'MwSt 19%',
      rate: '19.00',
      isDefault: true,
      isEnabled: true,
      isInclusive: true,
      isReverseCharge: false,
      validFrom: '1900-01-01',
      validTo: null,
    };
    let saved: Array<Record<string, unknown>>;

    beforeEach(() => {
      saved = [];
      repo.findOne.mockResolvedValue({ ...current });
      const txRepo = {
        save: jest.fn(async (row: Record<string, unknown>) => {
          saved.push(row);
          return { id: `saved-${saved.length}`, ...row };
        }),
        create: jest.fn((row: unknown) => row),
      };
      (repo as unknown as { manager: unknown }).manager = {
        transaction: async (work: (manager: unknown) => unknown) =>
          work({ getRepository: () => txRepo }),
      };
    });

    it('ends the version in force the day before and starts a copy at the new rate', async () => {
      await service.startNewVersion('ws-1', 'rate-19', 20, '2027-01-01', 'user-1');
      expect(saved[0]).toMatchObject({ id: 'rate-19', validTo: '2026-12-31' });
      expect(saved[1]).toMatchObject({
        code: 'DE_STANDARD',
        name: 'MwSt 20%',
        rate: 20,
        isDefault: true,
        validFrom: '2027-01-01',
        validTo: null,
      });
      expect(auditService.createEvent).toHaveBeenCalledTimes(2);
    });

    it('refuses a date the rate is not in force on', async () => {
      repo.findOne.mockResolvedValue({ ...current, validTo: '2026-06-30' });
      await expect(
        service.startNewVersion('ws-1', 'rate-19', 20, '2027-01-01'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(saved).toEqual([]);
    });
  });
});
