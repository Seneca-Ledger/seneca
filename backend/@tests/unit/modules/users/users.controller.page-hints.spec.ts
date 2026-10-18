import type { User } from '@/entities/user.entity';
import { UsersController } from '@/modules/users/users.controller';

describe('UsersController page hints', () => {
  const build = (usersService: Record<string, jest.Mock>) =>
    new UsersController(usersService as any, {} as any, {} as any, {} as any, {} as any);

  it('records the closed page for the caller and answers only the map', async () => {
    const usersService = { markPageHintsSeen: jest.fn(async () => ({ budgets: 2 })) };

    const result = await build(usersService).markPageHintsSeen({ id: 'user-1' } as User, {
      page: 'budgets',
      version: 2,
    });

    expect(usersService.markPageHintsSeen).toHaveBeenCalledWith('user-1', 'budgets', 2);
    // Not a user object: the client merges the map into the profile it already holds.
    expect(result).toEqual({ pageHintsSeen: { budgets: 2 } });
  });

  it('resets the caller’s hints', async () => {
    const usersService = { resetPageHints: jest.fn(async () => ({})) };

    const result = await build(usersService).resetPageHints({ id: 'user-1' } as User);

    expect(usersService.resetPageHints).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ pageHintsSeen: {} });
  });
});
