import { StatementStage } from '../../entities/statement.entity';

export type StageSkipCode =
  | 'STATEMENT_NOT_FOUND'
  | 'STATEMENT_EDIT_FORBIDDEN'
  | 'INVALID_STAGE_TRANSITION'
  | 'UNCATEGORIZED_TRANSACTIONS'
  | 'RECEIPT_NOT_FOUND'
  | 'RECEIPT_EDIT_FORBIDDEN'
  | 'MISSING_RECEIPT_DATA';

export type StageMoveDecision = { ok: true; changed: boolean } | { ok: false; code: StageSkipCode };

/** Each stage and the stages it may move to; mirrors the buttons on the statement page. */
const ALLOWED_MOVES: Record<StatementStage, StatementStage[]> = {
  [StatementStage.SUBMIT]: [StatementStage.APPROVE],
  [StatementStage.APPROVE]: [StatementStage.SUBMIT, StatementStage.PAY],
  [StatementStage.PAY]: [StatementStage.APPROVE],
};

/**
 * Whether a statement or receipt may move from `current` to `target`, for the
 * Submit → Approve → Pay review flow. `submitBlocker` is what keeps the item from
 * being submitted for approval (e.g. an uncategorised transaction), or null when
 * it is ready. Moving to the stage an item is already in succeeds without a
 * change, so a retried request is harmless.
 */
export function decideStageMove(
  current: StatementStage,
  target: StatementStage,
  submitBlocker: StageSkipCode | null,
): StageMoveDecision {
  if (current === target) {
    return { ok: true, changed: false };
  }
  if (!ALLOWED_MOVES[current].includes(target)) {
    return { ok: false, code: 'INVALID_STAGE_TRANSITION' };
  }
  if (current === StatementStage.SUBMIT && submitBlocker) {
    return { ok: false, code: submitBlocker };
  }
  return { ok: true, changed: true };
}
