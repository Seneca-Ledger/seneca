import { beforeEach, describe, expect, it, vi } from 'vitest';
import { payableRow } from '@/app/test/fixtures/contracts';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('./api', () => ({
  default: apiClientMock,
}));

describe('payablesApi', () => {
  beforeEach(() => {
    apiClientMock.get.mockReset();
    apiClientMock.post.mockReset();
    apiClientMock.put.mockReset();
    apiClientMock.delete.mockReset();
  });

  it('lists payables with query params', async () => {
    const response = {
      data: {
        data: [payableRow({ id: 'payable-1', vendor: 'ACME' })],
        total: 1,
        page: 2,
        limit: 25,
        totalPages: 1,
      },
    };
    apiClientMock.get.mockResolvedValue(response);

    const { payablesApi } = await import('./payables-api');
    const result = await payablesApi.list({ page: 2, limit: 25, search: 'acme' });

    expect(apiClientMock.get).toHaveBeenCalledWith('/payables', {
      params: { page: 2, limit: 25, search: 'acme' },
    });
    expect(result).toEqual(response.data);
  });

  it('fetches a payable summary', async () => {
    const response = {
      data: {
        toPay: 1200,
        overdue: 300,
        dueThisWeek: 400,
        paidThisMonth: 800,
        paidTotal: 1800,
        toPayCount: 3,
        overdueCount: 1,
        paidTotalCount: 2,
        dueThisWeekCount: 1,
        unbookedTotal: 0,
        unbookedCount: 0,
        convertedCurrencies: [],
      },
    };
    apiClientMock.get.mockResolvedValue(response);

    const { payablesApi } = await import('./payables-api');
    const result = await payablesApi.getSummary();

    expect(apiClientMock.get).toHaveBeenCalledWith('/payables/summary');
    expect(result).toEqual(response.data);
  });

  it('exports payables as a blob with filename metadata', async () => {
    const blob = new Blob(['csv-data'], { type: 'text/csv' });
    apiClientMock.post.mockResolvedValue({
      data: blob,
      headers: {
        'content-disposition': 'attachment; filename="payables-export.csv"',
        'content-type': 'text/csv',
      },
    });

    const { payablesApi } = await import('./payables-api');
    const result = await payablesApi.exportList({ format: 'csv', status: 'to_pay' });

    expect(apiClientMock.post).toHaveBeenCalledWith(
      '/payables/export',
      { format: 'csv', status: 'to_pay' },
      { responseType: 'blob' },
    );
    expect(result.blob).toBe(blob);
    expect(result.fileName).toBe('payables-export.csv');
    expect(result.contentType).toBe('text/csv');
  });
});
