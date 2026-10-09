import { TransactionsService } from '@/modules/transactions/transactions.service';

/**
 * A body that says nothing about privacy must leave no trace of privacy.
 *
 * Assigning `undefined` to the DTO *creates* the key, `Object.assign` then
 * copies it onto the row, and the audit reports a privacy change on an edit
 * that only touched the purpose. Deleting the key is the difference.
 */
describe('applyPrivacy on an edit that is not about privacy', () => {
  const service = Object.create(TransactionsService.prototype) as TransactionsService;
  const applyPrivacy = (
    transaction: Record<string, unknown>,
    updateDto: Record<string, unknown>,
  ): Promise<boolean> =>
    (
      service as unknown as {
        applyPrivacy: (t: unknown, d: unknown, v: string | null) => Promise<boolean>;
      }
    ).applyPrivacy(transaction, updateDto, 'member-self');

  it('leaves no isPrivate key on a body that never had one', async () => {
    const updateDto: Record<string, unknown> = { paymentPurpose: 'Bread' };

    const moved = await applyPrivacy({ isPrivate: false }, updateDto);

    expect(moved).toBe(false);
    expect('isPrivate' in updateDto).toBe(false);
  });

  it('drops a value that changes nothing', async () => {
    const updateDto: Record<string, unknown> = { isPrivate: false };

    const moved = await applyPrivacy({ isPrivate: false }, updateDto);

    expect(moved).toBe(false);
    expect('isPrivate' in updateDto).toBe(false);
  });
});
