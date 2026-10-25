import { NotFoundException } from '@nestjs/common';
import { appError } from '../errors/app-error';

/**
 * Asserts that a value is not null/undefined, throwing NotFoundException otherwise.
 * Narrows the type via TypeScript assertion signature.
 *
 * @example
 * const user = await repo.findOne({ where: { id } });
 * assertFound(user, 'User');
 * // user is now non-null
 */
export function assertFound<T>(
  value: T | null | undefined,
  entityName: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundException(appError('ENTITY_NOT_FOUND', { entity: entityName }));
  }
}
