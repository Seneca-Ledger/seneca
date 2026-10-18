import { type EntityManager, IsNull, Not } from 'typeorm';
import { Workspace } from '../../entities/workspace.entity';

/**
 * A demo workspace (`workspaces.demo_of_user_id` set) holds generated sample
 * data whose dates sit around an anchor, not today: a subscription "due
 * tomorrow" or a review digest about it would be news about nothing, sent to
 * a real person. Jobs that tell people things leave it out through these.
 */

/** For `find()` options on `Workspace`: `where: { ..., ...NOT_DEMO_WORKSPACE }`. */
export const NOT_DEMO_WORKSPACE = { demoOfUserId: IsNull() };

/** For a job handed one workspace: whether it is a demo. */
export async function isDemoWorkspace(
  manager: EntityManager,
  workspaceId: string | null | undefined,
): Promise<boolean> {
  if (!workspaceId) {
    return false;
  }
  return manager.exists(Workspace, { where: { id: workspaceId, demoOfUserId: Not(IsNull()) } });
}
