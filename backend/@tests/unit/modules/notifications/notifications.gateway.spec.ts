import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { Repository } from 'typeorm';
import type { AuthSession } from '@/entities/auth-session.entity';
import type { User } from '@/entities/user.entity';
import type { WorkspaceMember } from '@/entities/workspace-member.entity';
import { NotificationsGateway } from '@/modules/notifications/notifications.gateway';

const memberId = 'user-member';
const workspaceId = 'workspace-1';

function createGateway(isMember: boolean) {
  const exists = vi.fn(async () => isMember);
  const gateway = new NotificationsGateway(
    {} as JwtService,
    {} as ConfigService,
    {} as Repository<User>,
    {} as Repository<AuthSession>,
    { exists } as unknown as Repository<WorkspaceMember>,
  );
  return { gateway, exists };
}

function createSocket(userId?: string) {
  return { id: 'socket-1', data: { userId }, join: vi.fn(), leave: vi.fn() };
}

describe('NotificationsGateway join-workspace', () => {
  it('lets a member of the workspace into its room', async () => {
    const { gateway, exists } = createGateway(true);
    const socket = createSocket(memberId);

    await gateway.handleJoinWorkspace(socket as unknown as Socket, { workspaceId });

    expect(exists).toHaveBeenCalledWith({ where: { workspaceId, userId: memberId } });
    expect(socket.join).toHaveBeenCalledWith(`workspace:${workspaceId}`);
  });

  it("keeps someone who is not a member out of another workspace's room", async () => {
    const { gateway } = createGateway(false);
    const socket = createSocket('user-outsider');

    await gateway.handleJoinWorkspace(socket as unknown as Socket, { workspaceId });

    expect(socket.join).not.toHaveBeenCalled();
  });

  it('ignores a socket that never authenticated', async () => {
    const { gateway, exists } = createGateway(true);
    const socket = createSocket(undefined);

    await gateway.handleJoinWorkspace(socket as unknown as Socket, { workspaceId });

    expect(exists).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('ignores a message without a workspace id', async () => {
    const { gateway, exists } = createGateway(true);
    const socket = createSocket(memberId);

    await gateway.handleJoinWorkspace(socket as unknown as Socket, {});

    expect(exists).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
  });
});
