import type { Mock } from 'vitest';
import { PublicHolidaysService } from '@/modules/reference-data/public-holidays.service';
import { createRepoMock } from '../../../helpers/create-repo-mock';

const IT_2027 = [
  {
    startDate: '2027-11-01',
    endDate: '2027-11-01',
    type: 'Public',
    nationwide: true,
    name: [{ language: 'EN', text: "All Saints' Day" }],
  },
  {
    startDate: '2027-04-25',
    endDate: '2027-04-25',
    type: 'Public',
    nationwide: false,
    name: [{ language: 'EN', text: 'Feast of St Mark' }],
  },
  {
    startDate: '2027-12-25',
    endDate: '2027-12-26',
    type: 'Public',
    nationwide: true,
    name: [{ language: 'EN', text: 'Christmas' }],
  },
];

describe('PublicHolidaysService', () => {
  let repo: ReturnType<typeof createRepoMock> & { upsert: Mock };
  let fetchImpl: Mock;
  let service: PublicHolidaysService;

  beforeEach(() => {
    repo = Object.assign(createRepoMock(), { upsert: vi.fn() });
    repo.find.mockResolvedValue([]);
    fetchImpl = vi.fn(async () => new Response(JSON.stringify(IT_2027), { status: 200 }));
    service = new PublicHolidaysService(repo as never, createRepoMock() as never, fetchImpl as never);
  });

  it('fetches a missing year and keeps only nationwide days, ranges spelled out', async () => {
    const days = await service.holidaysFor('it', [2027]);
    expect([...days].sort()).toEqual(['2027-11-01', '2027-12-25', '2027-12-26']);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('countryIsoCode=IT');
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'openholidays', key: 'IT:2027' }),
      ['source', 'key'],
    );
  });

  it('uses a stored year without asking', async () => {
    repo.find.mockResolvedValue([
      { key: 'IT:2027', payload: { holidays: [{ date: '2027-11-01', name: 'x' }] } },
    ]);
    expect([...(await service.holidaysFor('IT', [2027]))]).toEqual(['2027-11-01']);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('asks nothing for a country OpenHolidays does not cover', async () => {
    expect((await service.holidaysFor('DK', [2027])).size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not ask again right after a failure', async () => {
    fetchImpl.mockRejectedValue(new Error('down'));
    expect((await service.holidaysFor('IT', [2027])).size).toBe(0);
    await service.holidaysFor('IT', [2027]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('does not store an empty answer for a covered country', async () => {
    fetchImpl.mockResolvedValue(new Response('[]', { status: 200 }));
    expect((await service.holidaysFor('IT', [2027])).size).toBe(0);
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
