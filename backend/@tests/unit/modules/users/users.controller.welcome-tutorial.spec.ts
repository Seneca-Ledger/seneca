import type { User } from '@/entities/user.entity';
import { UsersController } from '@/modules/users/users.controller';

describe('UsersController welcome tutorial', () => {
  it('marks the tutorial seen for the caller and returns only the timestamp', async () => {
    const seenAt = new Date('2026-09-25T12:00:00.000Z');
    const usersService = { markWelcomeTutorialSeen: jest.fn(async () => seenAt) };
    const controller = new UsersController(
      usersService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await controller.markWelcomeTutorialSeen({ id: 'user-1' } as User);

    expect(usersService.markWelcomeTutorialSeen).toHaveBeenCalledWith('user-1');
    // Not a user object: the client merges the timestamp into the profile it
    // already holds, so a partial profile here would wipe fields like avatarUrl.
    expect(result).toEqual({ welcomeTutorialSeenAt: seenAt });
  });
});
