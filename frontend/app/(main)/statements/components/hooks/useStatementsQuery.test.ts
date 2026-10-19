import { describe, expect, it } from 'vitest';
import { statementsRefetchInterval } from './useStatementsQuery';

/**
 * Предикат тестируется как обычная функция: гонять refetchInterval через
 * renderHook пришлось бы с фейковыми таймерами поверх планировщика React Query,
 * и тест был бы флейки без реальной пользы.
 */
describe('statementsRefetchInterval', () => {
  it('polls every 4s while a statement is still processing', () => {
    expect(statementsRefetchInterval([{ id: '1', status: 'processing' }])).toBe(4000);
  });

  it('stops polling once nothing is processing', () => {
    expect(statementsRefetchInterval([{ id: '1', status: 'parsed' }])).toBe(false);
  });

  it('does not poll for a receipt scan left as uploaded without an amount', () => {
    const scan = { id: '1', status: 'uploaded', parsingDetails: { detectedBy: 'receipt-scan' } };

    expect(statementsRefetchInterval([scan])).toBe(false);
    expect(statementsRefetchInterval([scan, { id: '2', status: 'uploaded' }])).toBe(4000);
  });

  it('does not poll before the first response arrives', () => {
    expect(statementsRefetchInterval(undefined)).toBe(false);
  });

  it('does not poll an empty list', () => {
    expect(statementsRefetchInterval([])).toBe(false);
  });
});
