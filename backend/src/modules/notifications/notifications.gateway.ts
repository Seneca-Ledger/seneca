import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { IsNull, type Repository } from 'typeorm';
import { resolveAllowedOrigins } from '../../common/utils/cors-origins';
import { AuthSession } from '../../entities/auth-session.entity';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth-cookies';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    // An explicit allowlist, not `origin: true`. Reflecting whatever origin
    // asked while also allowing credentials would let any site open a
    // cookie-authenticated socket as the visiting user.
    origin: resolveAllowedOrigins(),
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuthSession)
    private readonly authSessionRepository: Repository<AuthSession>,
  ) {}

  /**
   * Mirrors the checks JwtStrategy makes on every HTTP request. Verifying only
   * the signature meant a socket outlived `logout-all`, a revoked session and
   * account deactivation — it kept receiving notifications until the token
   * happened to expire, which for the old 30-day tokens was a very long time.
   */
  private async isSessionStillValid(payload: {
    sub: string;
    tokenVersion?: number;
    sessionId?: string;
  }): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: ['id', 'isActive', 'tokenVersion'],
    });

    if (!user || user.isActive === false) {
      return false;
    }

    if ((user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
      return false;
    }

    // Legacy tokens carry no sessionId and stay covered by tokenVersion alone.
    if (!payload.sessionId) {
      return true;
    }

    const session = await this.authSessionRepository.findOne({
      where: { id: payload.sessionId, userId: user.id, revokedAt: IsNull() },
      select: ['id'],
    });

    return Boolean(session);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Socket ${client.id} rejected: missing token`);
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        tokenVersion?: number;
        sessionId?: string;
      }>(token, {
        secret:
          this.configService.get<string>('JWT_ACCESS_SECRET') ||
          this.configService.get<string>('JWT_SECRET'),
      });

      const userId = payload.sub;
      if (!userId) {
        this.logger.warn(`Socket ${client.id} rejected: token missing subject`);
        client.disconnect();
        return;
      }

      if (!(await this.isSessionStillValid({ ...payload, sub: userId }))) {
        this.logger.warn(`Socket ${client.id} rejected: session revoked or user inactive`);
        client.disconnect();
        return;
      }

      client.data.userId = userId;
      client.join(this.getUserRoom(userId));
    } catch (_error) {
      this.logger.warn(`Socket ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      client.leave(this.getUserRoom(userId));
    }
  }

  @SubscribeMessage('join-workspace')
  handleJoinWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { workspaceId?: string },
  ): void {
    if (!payload.workspaceId) {
      return;
    }
    client.join(this.getWorkspaceRoom(payload.workspaceId));
  }

  @SubscribeMessage('leave-workspace')
  handleLeaveWorkspace(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { workspaceId?: string },
  ): void {
    if (!payload.workspaceId) {
      return;
    }
    client.leave(this.getWorkspaceRoom(payload.workspaceId));
  }

  @OnEvent('notification.created')
  handleNotificationCreated(notification: Notification): void {
    this.server
      .to(this.getUserRoom(notification.recipientId))
      .emit('notification:new', notification);
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    // Browsers authenticate with the httpOnly cookie, which they attach to the
    // handshake themselves — the page cannot read it to pass it in `auth`.
    const cookieToken = this.extractCookieToken(client.handshake.headers.cookie);
    if (cookieToken) {
      return cookieToken;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header !== 'string' || header.length === 0) {
      return null;
    }

    if (header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    return header;
  }

  private extractCookieToken(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) {
      return null;
    }

    for (const part of cookieHeader.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === ACCESS_TOKEN_COOKIE && rest.length > 0) {
        return decodeURIComponent(rest.join('=')) || null;
      }
    }

    return null;
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  private getWorkspaceRoom(workspaceId: string): string {
    return `workspace:${workspaceId}`;
  }
}
