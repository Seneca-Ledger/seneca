import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import type { CurrentUser as CurrentUserView } from '../../contracts';
import {
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
  TwoFactorCodeBody,
  TwoFactorPasswordBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { AuthService, type SessionContext } from './auth.service';
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
  setCsrfCookie,
} from './auth-cookies';
import { toCurrentUser } from './current-user.view';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import type { AuthResponseDto, TwoFactorChallengeDto } from './dto/auth-response.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { PasswordResetService } from './password-reset.service';
import type { TwoFactorSetupDto, TwoFactorStatusDto } from './two-factor.service';
import { TwoFactorService } from './two-factor.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  /**
   * Moves freshly issued tokens into httpOnly cookies. They deliberately never
   * appear in the response body any more: anything the page can read, injected
   * script can read too, which is what made an XSS equal to account takeover.
   */
  private setSession(res: Response, tokens: { access_token: string; refresh_token: string }): void {
    setAuthCookies(res, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    });
    setCsrfCookie(res, randomBytes(32).toString('hex'));
  }

  private extractSessionContext(req: Request): SessionContext {
    return {
      userAgent: req?.headers?.['user-agent'] || null,
      // req.ip, not X-Forwarded-For: with `trust proxy` set in main.ts Express
      // derives it from the hop we actually trust. Reading the raw header let
      // any client forge the IP recorded in the session list and audit trail.
      ipAddress: req?.ip || req?.socket?.remoteAddress || null,
    };
  }

  @Public()
  @SkipCsrf()
  // Unthrottled registration let the 409 "user already exists" response be used
  // to enumerate accounts at the global 500 req/min ceiling.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @SchemaBody(RegisterBody) registerDto: RegisterBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthResponseDto['user'] }> {
    const result = await this.authService.register(registerDto, this.extractSessionContext(req));
    this.setSession(res, result);
    return { user: result.user };
  }

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @SchemaBody(LoginBody) loginDto: LoginBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthResponseDto['user'] } | TwoFactorChallengeDto> {
    const result = await this.authService.login(loginDto, this.extractSessionContext(req));

    // The 2FA challenge carries no tokens — no session to issue yet.
    if ('twoFactorRequired' in result) {
      return result;
    }

    this.setSession(res, result);
    return { user: result.user };
  }

  @UseGuards(JwtAuthGuard)
  @Get('2fa')
  async getTwoFactorStatus(@CurrentUser() user: User): Promise<TwoFactorStatusDto> {
    return this.twoFactorService.getStatus(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  async setupTwoFactor(
    @CurrentUser() user: User,
    @SchemaBody(TwoFactorPasswordBody) dto: TwoFactorPasswordBody,
  ): Promise<TwoFactorSetupDto> {
    return this.twoFactorService.setup(user.id, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  async enableTwoFactor(
    @CurrentUser() user: User,
    @SchemaBody(TwoFactorCodeBody) dto: TwoFactorCodeBody,
  ): Promise<{ recoveryCodes: string[] }> {
    return this.twoFactorService.enable(user.id, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  async disableTwoFactor(
    @CurrentUser() user: User,
    @SchemaBody(TwoFactorPasswordBody) dto: TwoFactorPasswordBody,
  ): Promise<{ message: string }> {
    await this.twoFactorService.disable(user.id, dto.password);
    return { message: 'Two-factor authentication disabled' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/recovery-codes')
  @HttpCode(HttpStatus.OK)
  async regenerateRecoveryCodes(
    @CurrentUser() user: User,
    @SchemaBody(TwoFactorPasswordBody) dto: TwoFactorPasswordBody,
  ): Promise<{ recoveryCodes: string[] }> {
    return this.twoFactorService.regenerateRecoveryCodes(user.id, dto.password);
  }

  /**
   * Always answers 200, whether or not the address has an account: a different
   * response for unknown addresses turns this into an account-enumeration
   * oracle, which is the classic leak in a reset flow.
   */
  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @SchemaBody(ForgotPasswordBody) dto: ForgotPasswordBody,
  ): Promise<{ message: string }> {
    await this.passwordResetService.requestReset(dto.email);
    return { message: 'If that address has an account, a reset link is on its way.' };
  }

  @Public()
  @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @SchemaBody(ResetPasswordBody) dto: ResetPasswordBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.passwordResetService.resetPassword(dto.token, dto.newPassword);
    // The reset revoked every session; drop this browser's cookies too so it
    // is not left holding credentials the server no longer honours.
    clearAuthCookies(res);
    return { message: 'Password updated. Please sign in with your new password.' };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    // Cookie first, matching JwtRefreshStrategy's extraction order.
    const refreshToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE] || req.headers.authorization?.replace('Bearer ', '');
    const result = await this.authService.refreshToken(
      refreshToken,
      this.extractSessionContext(req),
    );
    this.setSession(res, result);
    return { message: 'Token refreshed' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: User,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const currentSessionId = req?.user?.currentSessionId || null;
    const result = await this.authService.logout(user.id, currentSessionId);
    clearAuthCookies(res);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const result = await this.authService.logoutAll(user.id);
    clearAuthCookies(res);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getSessions(@CurrentUser() user: User, @Req() req: AuthenticatedRequest) {
    const currentSessionId = req?.user?.currentSessionId || null;
    return this.authService.getSessions(user.id, currentSessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:sessionId/logout')
  @HttpCode(HttpStatus.OK)
  async logoutSession(
    @CurrentUser() user: User,
    @Param('sessionId') sessionId: string,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const result = await this.authService.logoutSession(user.id, sessionId);

    // Revoking your own session leaves a cookie the strategies will now reject;
    // clear it so the browser is not left holding a dead credential.
    if (req?.user?.currentSessionId === sessionId) {
      clearAuthCookies(res);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: User): Promise<CurrentUserView> {
    return toCurrentUser(user);
  }
}
