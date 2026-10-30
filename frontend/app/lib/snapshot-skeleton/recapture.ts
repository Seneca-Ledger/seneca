/** Bubbles up to the block a skeleton snapshot is taken of: measure it again now. */
export const SNAPSHOT_RECAPTURE_EVENT = 'seneca:snapshot-recapture';

/**
 * For a change the person made on purpose (a moved card), which the next visit
 * should already show, not after the quiet time the snapshot otherwise waits for.
 */
export function requestSnapshotRecapture(node: Element | null): void {
  node?.dispatchEvent(new Event(SNAPSHOT_RECAPTURE_EVENT, { bubbles: true }));
}
