import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHmac, randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { IsNull, type Repository } from 'typeorm';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { DEV_DEFAULTS } from '../../common/utils/dev-defaults';
import { hashPassword } from '../../common/utils/password-hash.util';
import { requireSecret } from '../../common/utils/required-secret.util';
import {
  AuthSession,
  User,
  UserRole,
  Workspace,
  WorkspaceInvitation,
  WorkspaceInvitationStatus,
  WorkspaceMember,
  WorkspaceRole,
} from '../../entities';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import { CategoriesService } from '../categories/categories.service';
import type { AuthResponseDto, LoginResultDto } from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { recordSecurityEvent } from './security-audit.util';
import type { JwtPayload } from './strategies/jwt.strategy';
import type { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';
import { TwoFactorService } from './two-factor.service';

export interface SessionContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface UserSessionDto {
  id: string;
  device: string;
  browser: string;
  os: string;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  isCurrent: boolean;
}

const toJwtExpiresIn = (value: string | undefined, fallback: StringValue): StringValue =>
  (value || fallback) as StringValue;

// Access-токен короткоживущий (см. .claude/rules/security.md §1: 15–30 минут);
// длинная сессия живёт в refresh-токене, который ротируется на каждом /refresh.
const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = '30m' as const;
const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = '30d' as const;

const jwtSecret = () =>
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV !== 'production' ? DEV_DEFAULTS.JWT_SECRET : undefined);

const jwtRefreshSecret = () =>
  process.env.JWT_REFRESH_SECRET ||
  (process.env.NODE_ENV !== 'production' ? DEV_DEFAULTS.JWT_REFRESH_SECRET : undefined);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceInvitation)
    private workspaceInvitationRepository: Repository<WorkspaceInvitation>,
    @InjectRepository(WorkspaceMember)
    private workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(AuthSession)
    private authSessionRepository: Repository<AuthSession>,
    private readonly categoriesService: CategoriesService,
    private readonly twoFactorService: TwoFactorService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async ensureDevAdminUser(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    const email = DEV_DEFAULTS.ADMIN_EMAIL;
    const existing = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'passwordHash', 'role', 'isActive', 'name', 'workspaceId'],
    });

    const passwordHash = await hashPassword(DEV_DEFAULTS.ADMIN_PASSWORD);

    if (!existing) {
      const created = await this.userRepository.save(
        this.userRepository.create({
          email,
          passwordHash,
          name: DEV_DEFAULTS.ADMIN_NAME,
          role: UserRole.ADMIN,
          isActive: true,
        }),
      );
      await this.ensureWorkspaceForUser(created);
      return;
    }

    const hasValidPassword = existing.passwordHash
      ? await bcrypt.compare(DEV_DEFAULTS.ADMIN_PASSWORD, existing.passwordHash)
      : false;

    if (
      existing.role !== UserRole.ADMIN ||
      !existing.isActive ||
      existing.name !== DEV_DEFAULTS.ADMIN_NAME ||
      !hasValidPassword
    ) {
      await this.userRepository.update(existing.id, {
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
        name: DEV_DEFAULTS.ADMIN_NAME,
      });
    }

    await this.ensureWorkspaceForUser(existing);
  }

  private async ensureWorkspaceForUser(user: Pick<User, 'id' | 'email' | 'name' | 'workspaceId'>) {
    let workspaceId = user.workspaceId;

    if (workspaceId) {
      const workspace = await this.workspaceRepository.findOne({
        where: { id: workspaceId },
        select: ['id'],
      });
      if (!workspace) {
        workspaceId = null;
      }
    }

    if (!workspaceId) {
      const workspace = await this.workspaceRepository.save(
        this.workspaceRepository.create({
          name: `${user.name || user.email} workspace`,
          ownerId: user.id,
          currency: currencyCodeOrDefault(null),
        }),
      );

      workspaceId = workspace.id;

      await this.userRepository.update(user.id, {
        workspaceId,
        lastWorkspaceId: workspaceId,
      });

      await this.categoriesService.createSystemCategories(workspaceId, user.id);
    }

    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: user.id },
      select: ['id'],
    });

    if (!membership) {
      await this.workspaceMemberRepository.save({
        workspaceId,
        userId: user.id,
        role: WorkspaceRole.OWNER,
        invitedById: user.id,
      });
    }
  }

  async register(
    registerDto: RegisterDto,
    sessionContext?: SessionContext,
  ): Promise<AuthResponseDto> {
    const normalizedEmail = registerDto.email.trim().toLowerCase();
    const invitationToken = registerDto.invitationToken?.trim() || null;

    await this.validateInvitationForEmail(invitationToken, normalizedEmail);

    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await hashPassword(registerDto.password);

    const user = this.userRepository.create({
      email: normalizedEmail,
      passwordHash,
      name: registerDto.name,
      company: registerDto.company || null,
      role: UserRole.USER,
      isActive: true,
      permissions: null, // Use role-based permissions by default
      onboardingCompletedAt: invitationToken ? new Date() : null,
    });

    const savedUser = await this.userRepository.save(user);

    if (invitationToken) {
      return this.generateTokens(savedUser, sessionContext);
    }

    await this.createOwnedWorkspaceForUser(
      savedUser,
      registerDto.company?.trim()
        ? `${registerDto.company.trim()} workspace`
        : `${registerDto.name || registerDto.email} workspace`,
    );

    return this.generateTokens(savedUser, sessionContext);
  }

  async login(loginDto: LoginDto, sessionContext?: SessionContext): Promise<LoginResultDto> {
    const normalizedEmail = loginDto.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      select: [
        'id',
        'email',
        'passwordHash',
        'name',
        'role',
        'workspaceId',
        'locale',
        'timeZone',
        'themePreference',
        'mapStylePreference',
        'onboardingCompletedAt',
        'avatarUrl',
        'isActive',
        'tokenVersion',
        'twoFactorEnabledAt',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.twoFactorEnabledAt) {
      if (!loginDto.twoFactorCode) {
        return { twoFactorRequired: true };
      }
      await this.twoFactorService.assertLoginCode(user.id, loginDto.twoFactorCode);
    }

    // Update last login
    await this.userRepository.update(user.id, { lastLogin: new Date() });

    return this.generateTokens(user, sessionContext);
  }

  private async validateInvitationForEmail(invitationToken: string | null, email: string) {
    if (!invitationToken) {
      return null;
    }

    const invitation = await this.workspaceInvitationRepository.findOne({
      where: { token: invitationToken },
    });

    if (!invitation) {
      throw new BadRequestException('Invitation not found or already used');
    }

    if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
      throw new BadRequestException('Invitation is not pending');
    }

    if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
      invitation.status = WorkspaceInvitationStatus.EXPIRED;
      await this.workspaceInvitationRepository.save(invitation);
      throw new BadRequestException('Invitation has expired');
    }

    if (invitation.email.trim().toLowerCase() !== email) {
      throw new BadRequestException('Email does not match invitation');
    }

    return invitation;
  }

  private async createOwnedWorkspaceForUser(user: User, workspaceName: string) {
    const workspace = this.workspaceRepository.create({
      name: workspaceName,
      ownerId: user.id,
      currency: currencyCodeOrDefault(null),
    });

    const savedWorkspace = await this.workspaceRepository.save(workspace);

    user.workspaceId = savedWorkspace.id;
    await this.userRepository.save(user);

    await this.workspaceMemberRepository.save({
      workspaceId: savedWorkspace.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
      invitedById: user.id,
    });

    await this.categoriesService.createSystemCategories(savedWorkspace.id, user.id);

    return savedWorkspace;
  }

  async refreshToken(
    refreshToken: string,
    sessionContext?: SessionContext,
  ): Promise<{ access_token: string; refresh_token: string }> {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: jwtRefreshSecret(),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.sub, isActive: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found or inactive');
      }

      const tokenVersion = payload.tokenVersion ?? 0;
      if ((user.tokenVersion ?? 0) !== tokenVersion) {
        throw new UnauthorizedException('Token has been revoked');
      }

      if (!payload.sessionId) {
        throw new UnauthorizedException('Session is missing');
      }

      const session = await this.authSessionRepository.findOne({
        where: {
          id: payload.sessionId,
          userId: payload.sub,
          revokedAt: IsNull(),
        },
      });

      if (!session) {
        throw new UnauthorizedException('Session is not active');
      }

      const refreshTokenHash = this.hashRefreshToken(refreshToken);
      if (session.refreshTokenHash !== refreshTokenHash) {
        throw new UnauthorizedException('Refresh token does not match session');
      }

      const parsedDevice = this.parseUserAgent(
        sessionContext?.userAgent || session.userAgent || null,
      );

      // Ротация: каждый /refresh выдаёт новый refresh-токен и перепривязывает
      // сессию к нему — украденный старый токен перестаёт работать после первого
      // легитимного обновления (см. .claude/rules/security.md §1).
      // ponytail: повтор старого токена просто отвергается; авто-отзыв сессии как
      // сигнал кражи не делаем — конкурирующие вкладки дали бы ложные разлогины.
      const newRefreshPayload: JwtRefreshPayload = {
        sub: user.id,
        type: 'refresh',
        tokenVersion: user.tokenVersion ?? 0,
        sessionId: payload.sessionId,
      };
      const newRefreshToken = this.jwtService.sign(newRefreshPayload, {
        secret: jwtRefreshSecret(),
        expiresIn: toJwtExpiresIn(
          process.env.JWT_REFRESH_EXPIRES_IN,
          DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
        ),
      });

      await this.authSessionRepository.update(
        { id: session.id },
        {
          refreshTokenHash: this.hashRefreshToken(newRefreshToken),
          lastUsedAt: new Date(),
          userAgent: sessionContext?.userAgent || session.userAgent,
          ipAddress: this.resolveIpAddress(sessionContext?.ipAddress) || session.ipAddress,
          device: parsedDevice.device,
          browser: parsedDevice.browser,
          os: parsedDevice.os,
        },
      );

      const accessTokenPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion ?? 0,
        sessionId: payload.sessionId,
      };

      const accessTokenOptions: JwtSignOptions = {
        secret: jwtSecret(),
        expiresIn: toJwtExpiresIn(process.env.JWT_EXPIRES_IN, DEFAULT_ACCESS_TOKEN_EXPIRES_IN),
      };

      const accessToken = this.jwtService.sign(accessTokenPayload, accessTokenOptions);

      return { access_token: accessToken, refresh_token: newRefreshToken };
    } catch (_error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, sessionId?: string | null): Promise<{ message: string }> {
    if (sessionId) {
      await this.authSessionRepository.update(
        {
          id: sessionId,
          userId,
          revokedAt: IsNull(),
        },
        {
          revokedAt: new Date(),
        },
      );
    }

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.authSessionRepository.update(
      {
        userId,
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
      },
    );

    await this.userRepository.increment({ id: userId }, 'tokenVersion', 1);
    await this.recordSessionRevocation(userId, { sessions: 'all-revoked' });
    return { message: 'Logged out from all devices successfully' };
  }

  async getSessions(userId: string, currentSessionId?: string | null): Promise<UserSessionDto[]> {
    const sessions = await this.authSessionRepository.find({
      where: {
        userId,
        revokedAt: IsNull(),
      },
      order: {
        lastUsedAt: 'DESC',
      },
    });

    return sessions.map(session => ({
      id: session.id,
      device: session.device,
      browser: session.browser,
      os: session.os,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      isCurrent: currentSessionId ? session.id === currentSessionId : false,
    }));
  }

  async logoutSession(userId: string, sessionId: string): Promise<{ message: string }> {
    const result = await this.authSessionRepository.update(
      {
        id: sessionId,
        userId,
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
      },
    );

    if (!result.affected) {
      throw new NotFoundException('Session not found');
    }

    await this.recordSessionRevocation(userId, { sessions: 'revoked', sessionId });
    return { message: 'Session logged out successfully' };
  }

  private async recordSessionRevocation(
    userId: string,
    meta: { sessions: string; sessionId?: string },
  ): Promise<void> {
    // The sessions are already revoked; a failed lookup must not undo that answer.
    const user = await this.userRepository
      .findOne({ where: { id: userId }, select: ['id', 'workspaceId'] })
      .catch(() => null);
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: user?.workspaceId,
      actorId: userId,
      entityType: EntityType.USER,
      entityId: userId,
      action: AuditAction.UPDATE,
      severity: Severity.INFO,
      meta,
    });
  }

  private async generateTokens(
    user: User,
    sessionContext?: SessionContext,
  ): Promise<AuthResponseDto> {
    const sessionId = randomUUID();

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
      sessionId,
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      type: 'refresh',
      tokenVersion: user.tokenVersion ?? 0,
      sessionId,
    };

    const accessTokenOptions: JwtSignOptions = {
      secret: jwtSecret(),
      expiresIn: toJwtExpiresIn(process.env.JWT_EXPIRES_IN, DEFAULT_ACCESS_TOKEN_EXPIRES_IN),
    };

    const refreshTokenOptions: JwtSignOptions = {
      secret: jwtRefreshSecret(),
      expiresIn: toJwtExpiresIn(
        process.env.JWT_REFRESH_EXPIRES_IN,
        DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
      ),
    };

    const accessToken = this.jwtService.sign(payload, accessTokenOptions);
    const refreshToken = this.jwtService.sign(refreshPayload, refreshTokenOptions);

    const parsedDevice = this.parseUserAgent(sessionContext?.userAgent);
    await this.authSessionRepository.save(
      this.authSessionRepository.create({
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        userAgent: sessionContext?.userAgent || null,
        ipAddress: this.resolveIpAddress(sessionContext?.ipAddress),
        device: parsedDevice.device,
        browser: parsedDevice.browser,
        os: parsedDevice.os,
        lastUsedAt: new Date(),
      }),
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        workspaceId: user.workspaceId || null,
        locale: user.locale,
        timeZone: user.timeZone ?? null,
        themePreference: user.themePreference,
        mapStylePreference: user.mapStylePreference ?? null,
        avatarUrl: user.avatarUrl ?? null,
        onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private hashRefreshToken(refreshToken: string): string {
    const secret = requireSecret(
      'SESSION_TOKEN_SALT or JWT_REFRESH_SECRET',
      this.configService.get<string>('SESSION_TOKEN_SALT'),
      this.configService.get<string>('JWT_REFRESH_SECRET'),
    );

    return createHmac('sha256', secret).update(refreshToken).digest('hex');
  }

  private resolveIpAddress(ipAddress?: string | null): string | null {
    if (!ipAddress) {
      return null;
    }

    const normalized = ipAddress
      .split(',')
      .map(part => part.trim())
      .find(Boolean);

    return normalized || null;
  }

  private parseUserAgent(userAgent?: string | null): {
    device: string;
    browser: string;
    os: string;
  } {
    if (!userAgent) {
      return {
        device: 'Unknown device',
        browser: 'Unknown browser',
        os: 'Unknown OS',
      };
    }

    const browser = this.detectBrowser(userAgent);
    const os = this.detectOs(userAgent);
    const lowerUa = userAgent.toLowerCase();
    const isTablet = /(ipad|tablet)/i.test(userAgent);
    const isMobile = /(iphone|ipod|android.*mobile|mobile)/i.test(userAgent);

    let device = 'Desktop';
    if (isTablet) {
      device = 'Tablet';
    } else if (isMobile) {
      device = 'Mobile';
    } else if (lowerUa.includes('bot') || lowerUa.includes('spider') || lowerUa.includes('crawl')) {
      device = 'Bot';
    }

    return {
      device,
      browser,
      os,
    };
  }

  private detectBrowser(userAgent: string): string {
    if (/Edg\//i.test(userAgent)) {
      return 'Edge';
    }
    if (/OPR\//i.test(userAgent)) {
      return 'Opera';
    }
    if (/Firefox\//i.test(userAgent)) {
      return 'Firefox';
    }
    if (/Chrome\//i.test(userAgent)) {
      return 'Chrome';
    }
    if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) {
      return 'Safari';
    }
    return 'Unknown browser';
  }

  private detectOs(userAgent: string): string {
    if (/Windows NT/i.test(userAgent)) {
      return 'Windows';
    }
    if (/Mac OS X/i.test(userAgent) && !/(iphone|ipad|ipod)/i.test(userAgent)) {
      return 'macOS';
    }
    if (/(iphone|ipad|ipod)/i.test(userAgent)) {
      return 'iOS';
    }
    if (/Android/i.test(userAgent)) {
      return 'Android';
    }
    if (/Linux/i.test(userAgent)) {
      return 'Linux';
    }
    return 'Unknown OS';
  }
}
