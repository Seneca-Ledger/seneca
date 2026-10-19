import { applyDecorators, UseGuards } from '@nestjs/common';
import type { Permission } from '../enums/permissions.enum';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { WorkspaceContextGuard } from '../guards/workspace-context.guard';
import { RequirePermission } from './require-permission.decorator';

/**
 * Composite decorator that applies JWT auth, workspace context,
 * permissions guard, and sets the required permission in one call.
 *
 * Replaces the common two-line pattern:
 *   @UseGuards(JwtAuthGuard, WorkspaceContextGuard, PermissionsGuard)
 *   @RequirePermission(Permission.X)
 */
export function WorkspaceAuth(...permissions: Permission[]) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, WorkspaceContextGuard, PermissionsGuard),
    RequirePermission(...permissions),
  );
}
