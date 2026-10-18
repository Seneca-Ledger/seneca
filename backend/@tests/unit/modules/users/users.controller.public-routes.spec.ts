import { IS_PUBLIC_KEY } from '@/modules/auth/decorators/public.decorator';
import { UsersController } from '@/modules/users/users.controller';
import { Reflector } from '@nestjs/core';

/**
 * `@Public()` sits directly above the handler it exempts from JwtAuthGuard, so
 * inserting a new route above an existing one silently steals the decorator.
 * This locks down which handlers on this controller are allowed to be public.
 */
describe('UsersController public routes', () => {
  const reflector = new Reflector();

  const isPublic = (handlerName: keyof UsersController): boolean =>
    reflector.get<boolean>(IS_PUBLIC_KEY, UsersController.prototype[handlerName]) === true;

  it('keeps the avatar route public', () => {
    expect(isPublic('getAvatar')).toBe(true);
  });

  it.each([
    'exportMyData',
    'deleteMyAccount',
    'getProfile',
    'changePassword',
    'markWelcomeTutorialSeen',
    'markPageHintsSeen',
    'resetPageHints',
  ] as const)(
    'requires authentication for %s',
    handlerName => {
      expect(isPublic(handlerName)).toBe(false);
    },
  );
});
