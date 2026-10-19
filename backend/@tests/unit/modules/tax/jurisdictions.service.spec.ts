import { createRepoMock } from '../../../helpers/create-repo-mock';
import { JurisdictionsService, toDateOnly } from '@/modules/tax/jurisdictions.service';
import { NotFoundException } from '@nestjs/common';
import { IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

describe('JurisdictionsService', () => {
  let service: JurisdictionsService;
  let jurisdictionRepo: ReturnType<typeof createRepoMock>;
  let rateRepo: ReturnType<typeof createRepoMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    jurisdictionRepo = createRepoMock();
    rateRepo = createRepoMock();
    service = new JurisdictionsService(jurisdictionRepo, rateRepo);
  });

  describe('toDateOnly', () => {
    it('truncates a Date to YYYY-MM-DD', () => {
      expect(toDateOnly(new Date('2026-01-01T23:45:00.000Z'))).toBe('2026-01-01');
    });

    it('truncates an ISO string without reparsing it', () => {
      expect(toDateOnly('2025-12-31T00:00:00.000Z')).toBe('2025-12-31');
    });
  });

  describe('findByCode', () => {
    it('upper-cases the lookup so ?code=kz works', async () => {
      jurisdictionRepo.findOne.mockResolvedValue({ id: 'j-1', code: 'KZ' });

      await service.findByCode('kz');

      expect(jurisdictionRepo.findOne).toHaveBeenCalledWith({ where: { code: 'KZ' } });
    });

    it('throws NotFoundException for an unknown code', async () => {
      jurisdictionRepo.findOne.mockResolvedValue(null);

      await expect(service.findByCode('XX')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findRatesForDate', () => {
    it('matches both open-ended and closed validity windows', async () => {
      rateRepo.find.mockResolvedValue([]);

      await service.findRatesForDate('j-1', '2026-03-15');

      expect(rateRepo.find).toHaveBeenCalledWith({
        where: [
          {
            jurisdictionId: 'j-1',
            validFrom: LessThanOrEqual('2026-03-15'),
            validTo: IsNull(),
          },
          {
            jurisdictionId: 'j-1',
            validFrom: LessThanOrEqual('2026-03-15'),
            validTo: MoreThanOrEqual('2026-03-15'),
          },
        ],
        order: { kind: 'ASC', rate: 'DESC' },
      });
    });

    it('accepts a Date and narrows it to the day', async () => {
      rateRepo.find.mockResolvedValue([]);

      await service.findRatesForDate('j-1', new Date('2025-07-04T12:00:00.000Z'));

      const [{ where }] = rateRepo.find.mock.calls[0];
      expect(where[0].validFrom).toEqual(LessThanOrEqual('2025-07-04'));
    });
  });

  describe('findAllRates', () => {
    it('returns every version ordered for a timeline view', async () => {
      rateRepo.find.mockResolvedValue([]);

      await service.findAllRates('j-1');

      expect(rateRepo.find).toHaveBeenCalledWith({
        where: { jurisdictionId: 'j-1' },
        order: { code: 'ASC', validFrom: 'ASC' },
      });
    });
  });
});
