import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { withoutKeys } from '../utils/sensitive-keys.util';

/**
 * Drops `keys` from an answer at any depth. Registered for the whole API with
 * `SERVER_ONLY_KEYS` as the last line behind the response contracts: a handler
 * without a contract still cannot hand out a file path or a credential.
 */
export class StripKeysInterceptor implements NestInterceptor {
  constructor(private readonly keys: ReadonlySet<string>) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(value => withoutKeys(value, this.keys)));
  }
}
