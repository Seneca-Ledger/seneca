import type { Request } from 'express';
import type { Workspace } from '../../entities/workspace.entity';
import type {
  WorkspaceMemberPermissions,
  WorkspaceRole,
} from '../../entities/workspace-member.entity';
import type { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  workspace?: Workspace;
  workspaceRole?: WorkspaceRole;
  /** The caller's membership row in `workspace`, so `owner=me` needs no extra query. */
  workspaceMemberId?: string;
  workspaceMemberPermissions?: WorkspaceMemberPermissions | null;
  apiKeyWorkspaceId?: string;
  /** Set when the request authenticated with an API key; `scopes` null = unrestricted (legacy key). */
  apiKey?: { id: string; name: string; prefix: string; scopes: string[] | null };
  requestId?: string;
  traceId?: string;
}
