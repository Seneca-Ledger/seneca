import { Body, Controller, HttpCode, Logger, Post, UseGuards } from '@nestjs/common';
import { Exit } from 'effect';
import { describeSchemaFailure } from '../../common/effect/schema-issues';
import { Public } from '../auth/decorators/public.decorator';
import { TelegramService } from './telegram.service';
import { decodeTelegramUpdate } from './telegram-update.schema';
import { TelegramWebhookGuard } from './telegram-webhook.guard';

@Controller('telegram/webhook')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(private readonly telegramService: TelegramService) {}

  @Post()
  @Public()
  @UseGuards(TelegramWebhookGuard)
  @HttpCode(200)
  async handleUpdate(@Body() body: unknown) {
    const update = decodeTelegramUpdate(body);
    if (Exit.isFailure(update)) {
      // Never a 4xx: Telegram would retry the update while later ones pile up.
      // A malformed one is logged and dropped.
      const updateId =
        typeof body === 'object' && body !== null && 'update_id' in body ? body.update_id : '?';
      this.logger.warn(
        `Ignored Telegram update ${String(updateId)}: ${describeSchemaFailure(update.cause).join('; ')}`,
      );
      return { ok: true };
    }
    await this.telegramService.handleUpdate(update.value);
    return { ok: true };
  }
}
