import { Body, Controller, HttpCode, Logger, Param, Post, UseGuards } from '@nestjs/common';
import { Exit } from 'effect';
import { describeSchemaFailure } from '../../common/effect/schema-issues';
import { Public } from '../auth/decorators/public.decorator';
import { TelegramService } from './telegram.service';
import { TelegramBotWebhookGuard } from './telegram-bot-webhook.guard';
import { TelegramBotsService } from './telegram-bots.service';
import { decodeTelegramUpdate } from './telegram-update.schema';
import { TelegramWebhookGuard } from './telegram-webhook.guard';

@Controller('telegram/webhook')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly telegramBots: TelegramBotsService,
  ) {}

  /** The TELEGRAM_BOT_TOKEN bot's webhook, set up by hand with TELEGRAM_WEBHOOK_SECRET. */
  @Post()
  @Public()
  @UseGuards(TelegramWebhookGuard)
  @HttpCode(200)
  async handleUpdate(@Body() body: unknown) {
    await this.handle(body);
    return { ok: true };
  }

  /** The webhook TelegramBotsService sets for each bot; the guard has matched the bot. */
  @Post(':botId')
  @Public()
  @UseGuards(TelegramBotWebhookGuard)
  @HttpCode(200)
  async handleBotUpdate(@Param('botId') botId: string, @Body() body: unknown) {
    await this.handle(body, this.telegramBots.tokenOf(botId) ?? undefined);
    return { ok: true };
  }

  private async handle(body: unknown, botToken?: string): Promise<void> {
    const update = decodeTelegramUpdate(body);
    if (Exit.isFailure(update)) {
      // Never a 4xx: Telegram would retry the update while later ones pile up.
      // A malformed one is logged and dropped.
      const updateId =
        typeof body === 'object' && body !== null && 'update_id' in body ? body.update_id : '?';
      this.logger.warn(
        `Ignored Telegram update ${String(updateId)}: ${describeSchemaFailure(update.cause).join('; ')}`,
      );
      return;
    }
    await this.telegramService.handleUpdate(update.value, botToken);
  }
}
