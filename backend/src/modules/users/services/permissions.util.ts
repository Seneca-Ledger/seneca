import { NotFoundException } from '@nestjs/common';
import type { Permission } from '../../../common/enums/permissions.enum';
import { appError } from '../../../common/errors/app-error';

export function getCurrentPermissions(user: { permissions?: string[] | null }): Permission[] {
  return (user.permissions || []) as Permission[];
}

export function withCurrentPermissions<TUser extends { permissions?: string[] | null }, TResult>(
  user: TUser,
  handler: (user: TUser, permissions: Permission[]) => TResult,
): TResult {
  return handler(user, getCurrentPermissions(user));
}

export async function findUserOrThrow<TUser>(userPromise: Promise<TUser | null>): Promise<TUser> {
  const user = await userPromise;
  if (!user) {
    throw new NotFoundException(appError('USER_NOT_FOUND'));
  }

  return user;
}
