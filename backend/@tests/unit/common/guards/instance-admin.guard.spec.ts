import { ForbiddenException } from '@nestjs/common';
import { InstanceAdminGuard } from '@/common/guards/instance-admin.guard';
import { UserRole } from '@/entities/user.entity';

const contextFor = (request: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;

describe('InstanceAdminGuard', () => {
  const guard = new InstanceAdminGuard();

  it('lets an instance admin signed in through the app pass', () => {
    expect(guard.canActivate(contextFor({ user: { role: UserRole.ADMIN } }))).toBe(true);
  });

  it('refuses other users with INSTANCE_ADMIN_ONLY', () => {
    expect(() => guard.canActivate(contextFor({ user: { role: UserRole.USER } }))).toThrow(
      ForbiddenException,
    );
    try {
      guard.canActivate(contextFor({ user: { role: UserRole.USER } }));
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({ code: 'INSTANCE_ADMIN_ONLY' });
    }
  });

  it('refuses an API key even when its owner is an admin', () => {
    expect(() =>
      guard.canActivate(contextFor({ user: { role: UserRole.ADMIN }, apiKey: { id: 'k' } })),
    ).toThrow(ForbiddenException);
  });
});
