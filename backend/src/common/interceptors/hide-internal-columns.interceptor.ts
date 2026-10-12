import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { User } from '../../entities/user.entity';

/** Columns that name where a file sits on the server, or fingerprint it. */
const INTERNAL_COLUMNS = new Set(['filePath', 'fileHash']);

/** A person as other members of the workspace may see them. */
export interface PersonView {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export const toPersonView = (user: User): PersonView => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
});

/**
 * The answer without server file paths and file hashes, and with every user
 * account row (Google and Telegram ids, token version, last login…) reduced
 * to the person: these controllers answer entity rows that join their owner,
 * and any member of the workspace reads them.
 */
export function hideInternalColumns(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(hideInternalColumns);
  if (value instanceof User) return toPersonView(value);
  if (
    typeof value !== 'object' ||
    value === null ||
    value instanceof Date ||
    value instanceof StreamableFile ||
    Buffer.isBuffer(value)
  ) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !INTERNAL_COLUMNS.has(key))
      .map(([key, nested]) => [key, hideInternalColumns(nested)]),
  );
}

@Injectable()
export class HideInternalColumnsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(hideInternalColumns));
  }
}
