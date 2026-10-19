import { decideStageMove } from '@/common/workflow/review-stage.rules';
import { StatementStage } from '@/entities/statement.entity';

describe('decideStageMove', () => {
  const { SUBMIT, APPROVE, PAY } = StatementStage;

  it.each([
    [SUBMIT, APPROVE],
    [APPROVE, SUBMIT],
    [APPROVE, PAY],
    [PAY, APPROVE],
  ])('allows %s → %s', (from, to) => {
    expect(decideStageMove(from, to, null)).toEqual({ ok: true, changed: true });
  });

  it.each([
    [SUBMIT, PAY],
    [PAY, SUBMIT],
  ])('rejects the skip %s → %s', (from, to) => {
    expect(decideStageMove(from, to, null)).toEqual({
      ok: false,
      code: 'INVALID_STAGE_TRANSITION',
    });
  });

  it('blocks submitting with the reason the caller gave', () => {
    expect(decideStageMove(SUBMIT, APPROVE, 'UNCATEGORIZED_TRANSACTIONS')).toEqual({
      ok: false,
      code: 'UNCATEGORIZED_TRANSACTIONS',
    });
    expect(decideStageMove(SUBMIT, APPROVE, 'MISSING_RECEIPT_DATA')).toEqual({
      ok: false,
      code: 'MISSING_RECEIPT_DATA',
    });
  });

  it('ignores the submit blocker when rolling back or paying', () => {
    expect(decideStageMove(APPROVE, SUBMIT, 'UNCATEGORIZED_TRANSACTIONS')).toEqual({
      ok: true,
      changed: true,
    });
    expect(decideStageMove(APPROVE, PAY, 'UNCATEGORIZED_TRANSACTIONS')).toEqual({
      ok: true,
      changed: true,
    });
    expect(decideStageMove(PAY, APPROVE, 'UNCATEGORIZED_TRANSACTIONS')).toEqual({
      ok: true,
      changed: true,
    });
  });

  it('treats a move to the current stage as done without a change', () => {
    expect(decideStageMove(APPROVE, APPROVE, 'UNCATEGORIZED_TRANSACTIONS')).toEqual({
      ok: true,
      changed: false,
    });
  });
});
