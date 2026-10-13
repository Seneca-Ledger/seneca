import {
  type CallHandler,
  type ExecutionContext,
  InternalServerErrorException,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { ACCOUNT_KEYS } from '../../../src/common/utils/sensitive-keys.util';

/**
 * Answers that may name account details: each person's own profile, and the
 * instance admin's list of users. Everything else gets none.
 */
const OWN_ACCOUNT_HANDLERS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['AuthController.getProfile', new Set(['lastLogin', 'telegramId', 'telegramChatId'])],
  ['UsersController.getProfile', new Set(['googleId', 'lastLogin', 'telegramId', 'telegramChatId'])],
  ['UsersController.updateMyPreferences', new Set(['lastLogin', 'telegramId', 'telegramChatId'])],
  ['UsersController.acceptDisclaimer', new Set(['lastLogin', 'telegramId', 'telegramChatId'])],
  ['UsersController.completeOnboarding', new Set(['lastLogin', 'telegramId', 'telegramChatId'])],
  ['UsersController.findAll', new Set(['lastLogin'])],
  // A user's own profile, or anyone's to the instance admin.
  ['UsersController.findOne', new Set(['googleId', 'lastLogin', 'telegramId', 'telegramChatId'])],
  // The Telegram account just linked to the caller's own.
  ['TelegramController.connect', new Set(['telegramId', 'telegramChatId'])],
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function leakedPaths(value: unknown, allowed: ReadonlySet<string>, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap(item => leakedPaths(item, allowed, `${path}[]`));
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, item]) => [
    ...(ACCOUNT_KEYS.has(key) && !allowed.has(key) && item !== undefined ? [`${path}.${key}`] : []),
    ...leakedPaths(item, allowed, `${path}.${key}`),
  ]);
}

/**
 * Fails any e2e request whose answer hands out an account detail, a credential
 * or a file's path or bytes: every suite then checks every answer it makes.
 */
export class LeakGuardInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    const allowed = OWN_ACCOUNT_HANDLERS.get(handler) ?? new Set<string>();
    return next.handle().pipe(
      map(value => {
        let wire: unknown;
        try {
          wire = value === undefined ? undefined : JSON.parse(JSON.stringify(value));
        } catch {
          // A stream or a file: not JSON, nothing to read keys from.
          return value;
        }
        const leaked = leakedPaths(wire, allowed);
        if (leaked.length > 0) {
          throw new InternalServerErrorException(`${handler} leaked ${leaked.join(', ')}`);
        }
        return value;
      }),
    );
  }
}
