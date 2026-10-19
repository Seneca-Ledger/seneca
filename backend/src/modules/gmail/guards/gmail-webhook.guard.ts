import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { secretsMatch } from '../../../common/utils/secret-compare.util';

@Injectable()
export class GmailWebhookGuard implements CanActivate {
  private readonly logger = new Logger(GmailWebhookGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Get authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn('Missing or invalid authorization header');
      throw new UnauthorizedException('Invalid webhook authentication');
    }

    const token = authHeader.substring(7);

    // Verify token (in production, this should be a JWT from Google Cloud Pub/Sub)
    const expectedToken = process.env.PUBSUB_WEBHOOK_TOKEN || '';

    if (!expectedToken) {
      // Deny by default (.claude/rules/security.md §3). This used to pass
      // whenever NODE_ENV was not exactly 'production', which left the endpoint
      // wide open on staging — a deployment that holds real data. Configure
      // PUBSUB_WEBHOOK_TOKEN to use the webhook in any environment.
      this.logger.error('PUBSUB_WEBHOOK_TOKEN not configured — rejecting webhook');
      throw new UnauthorizedException('Invalid webhook authentication');
    }

    if (!secretsMatch(token, expectedToken)) {
      this.logger.warn('Invalid webhook token');
      throw new UnauthorizedException('Invalid webhook authentication');
    }

    return true;
  }
}
