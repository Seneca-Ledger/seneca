import { UnauthorizedException } from '@nestjs/common';
import { TelegramBotWebhookGuard } from '@/modules/telegram/telegram-bot-webhook.guard';
import { webhookSecretOf } from '@/modules/telegram/telegram-bots.service';

const TOKEN = '123:secret';

function createContext(botId: string, secret?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        params: { botId },
        headers: secret === undefined ? {} : { 'x-telegram-bot-api-secret-token': secret },
      }),
    }),
  } as any;
}

describe('TelegramBotWebhookGuard', () => {
  const guard = new TelegramBotWebhookGuard({
    tokenOf: (botId: string) => (botId === '123' ? TOKEN : null),
  } as any);

  it('lets in a call carrying the secret derived from that bot’s token', () => {
    expect(guard.canActivate(createContext('123', webhookSecretOf(TOKEN)))).toBe(true);
  });

  it('refuses a call without the secret or with another bot’s', () => {
    expect(() => guard.canActivate(createContext('123'))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(createContext('123', webhookSecretOf('456:other')))).toThrow(
      UnauthorizedException,
    );
  });

  it('refuses a bot the server does not receive updates for', () => {
    expect(() => guard.canActivate(createContext('999', webhookSecretOf(TOKEN)))).toThrow(
      UnauthorizedException,
    );
  });
});
