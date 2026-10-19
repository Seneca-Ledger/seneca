import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { secretsMatch } from '../../common/utils/secret-compare.util';

@Injectable()
export class TelegramWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    const header = request.headers['x-telegram-bot-api-secret-token'];
    const provided = typeof header === 'string' ? header : null;

    if (!(secret && secretsMatch(provided, secret))) {
      throw new UnauthorizedException('Invalid Telegram webhook authentication');
    }

    return true;
  }
}
