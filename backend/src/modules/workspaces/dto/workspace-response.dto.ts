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
  currency: string;
  isFavorite: boolean;
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
