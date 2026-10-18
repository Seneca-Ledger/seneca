import { detectPaidStatus } from '@/modules/custom-tables/helpers/paid-status.helper';

describe('detectPaidStatus', () => {
  it('reads an unpaid row', () => {
    expect(
      detectPaidStatus({ id: '1', counterparty: 'Invoice pending', comment: 'awaiting payment' }),
    ).toBe(false);
  });

  it('reads a paid row', () => {
    expect(detectPaidStatus({ id: '1', comment: 'Счёт оплачен' })).toBe(true);
  });

  it('answers null when the text says neither', () => {
    expect(detectPaidStatus({ id: '1', comment: 'Office chairs' })).toBeNull();
    expect(detectPaidStatus({ id: '1' })).toBeNull();
  });
});
