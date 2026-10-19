import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Repository } from 'typeorm';
import { devDefault } from '../../../common/utils/dev-defaults';
import { User } from '../../../entities/user.entity';
import { REFRESH_TOKEN_COOKIE } from '../auth-cookies';

export interface JwtRefreshPayload {
  sub: string;
  type: 'refresh';
  tokenVersion?: number;
  sessionId?: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    const jwtRefreshSecret = devDefault(
      configService.get<string>('JWT_REFRESH_SECRET'),
      'JWT_REFRESH_SECRET',
    );

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.[REFRESH_TOKEN_COOKIE] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtRefreshSecret,
    });
  }

  async validate(payload: JwtRefreshPayload): Promise<User> {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub, isActive: true },
      select: [
        'id',
        'email',
        'name',
        'role',
        'workspaceId',
        'themePreference',
        'tokenVersion',
        'isActive',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokenVersion = payload.tokenVersion ?? 0;
    if ((user.tokenVersion ?? 0) !== tokenVersion) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return user;
  }
}
