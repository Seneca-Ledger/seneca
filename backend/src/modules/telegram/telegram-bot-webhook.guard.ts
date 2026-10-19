import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { secretsMatch } from '../../common/utils/secret-compare.util';
import { TelegramBotsService, webhookSecretOf } from './telegram-bots.service';

/**
 * `POST /telegram/webhook/:botId`, the webhook TelegramBotsService sets for a
 * bot: the header must carry the secret derived from that bot's token.
 */
@Injectable()
export class TelegramBotWebhookGuard implements CanActivate {
  constructor(private readonly bots: TelegramBotsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, unknown>;
      params: Record<string, string | undefined>;
    }>();
    const header = request.headers['x-telegram-bot-api-secret-token'];
    const provided = typeof header === 'string' ? header : null;
    const botToken = this.bots.tokenOf(request.params.botId ?? '');

    if (!(botToken && secretsMatch(provided, webhookSecretOf(botToken)))) {
      throw new UnauthorizedException('Invalid Telegram webhook authentication');
    }

    return true;
  }
}
