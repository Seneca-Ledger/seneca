import type { WorkspaceKind } from '../../../entities/workspace.entity';
import {
  WorkspaceMemberPermissions,
  WorkspaceRole,
} from '../../../entities/workspace-member.entity';

type JsonObject = Record<string, unknown>;

export class WorkspaceStatsDto {
  integrationCount: number;
  recentActivity: boolean;
  memberCount: number;
  lastAccessedAt: Date | null;
}

export class WorkspaceResponseDto {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  backgroundImage: string | null;
  /** Credit line for a searched photo; null for bundled backgrounds. */
  backgroundAttribution: string | null;
  backgroundSourceUrl: string | null;
  currency: string;
  isFavorite: boolean;
  /** `version`: a past version opened to look at, read only. */
  kind: WorkspaceKind;
  /** For an opened version: which version, of which workspace, taken when. */
  version?: { id: string; takenAt: Date; sourceWorkspaceId: string } | null;
  settings: JsonObject | null;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;

  // Member-specific data
  memberRole?: WorkspaceRole;
  memberPermissions?: WorkspaceMemberPermissions | null;

  // Statistics
  stats?: WorkspaceStatsDto;
}
