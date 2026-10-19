import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  BadRequestException,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Exit } from 'effect';
import { attemptWithRetry } from '../../common/effect/attempt-with-retry';
import { describeSchemaFailure } from '../../common/effect/schema-issues';
import type { TelegramLink } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { ApplicationSettingsService } from '../application-settings/application-settings.service';
import { botIdOf, TelegramService } from './telegram.service';
import { TelegramLinkCodes } from './telegram-link-codes';
import { decodeTelegramUpdate } from './telegram-update.schema';

interface WatchedBot {
  botToken: string;
  publicUrl: string | null;
  stop: AbortController;
}

const ALLOWED_UPDATES = ['message', 'callback_query'];
const API_TIMEOUT_MS = 10_000;
// getUpdates holds the request open this long while there is nothing new.
const LONG_POLL_SECONDS = 50;
const POLL_RETRY_MS = 5_000;
// Telegram answers 401 to a revoked or mistyped token.
const UNAUTHORIZED = 401;

class TelegramBotApiError extends Error {
  constructor(
    message: string,
    readonly errorCode?: number,
  ) {
    super(message);
    this.name = 'TelegramBotApiError';
  }
}

/** Telegram sends this with every webhook call of the bot; only the token's holder can derive it. */
export const webhookSecretOf = (botToken: string): string =>
  createHash('sha256').update(`seneca-telegram-webhook:${botToken}`).digest('hex');

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Makes every bot the server knows (the TELEGRAM_BOT_TOKEN default and each
 * workspace's own) receive its updates with no setup: a webhook when the app
 * has a public https address, long polling otherwise, which works on a home
 * server behind NAT. It also issues the Connect links, since a link only works
 * while its bot is listening.
 *
 * Polling assumes one backend instance per bot: Telegram answers 409 to a
 * second poller, which then keeps retrying.
 */
@Injectable()
export class TelegramBotsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotsService.name);
  /** By bot id, the token's numeric prefix. */
  private readonly bots = new Map<string, WatchedBot>();
  /** By token: getMe answers the same for the life of a token. */
  private readonly usernames = new Map<string, string>();

  constructor(
    private readonly applicationSettingsService: ApplicationSettingsService,
    private readonly telegramService: TelegramService,
    private readonly linkCodes: TelegramLinkCodes,
  ) {}

  onApplicationBootstrap(): void {
    // Not awaited: a slow or unreachable Telegram must not hold up the boot.
    void this.sync();
  }

  onModuleDestroy(): void {
    for (const bot of this.bots.values()) {
      bot.stop.abort();
    }
    this.bots.clear();
  }

  /** Starts receiving for bots saved since the last pass and stops it for removed ones. */
  @Interval(5 * 60_000)
  async sync(): Promise<void> {
    try {
      const listed = await this.applicationSettingsService.listTelegramBots();
      const ids = new Set(listed.map(bot => botIdOf(bot.botToken)));
      for (const [id, bot] of this.bots) {
        if (!ids.has(id)) {
          bot.stop.abort();
          this.bots.delete(id);
        }
      }
      for (const bot of listed) {
        await this.watch(bot.botToken, bot.publicUrl);
      }
    } catch (error) {
      this.logger.error(`Telegram bot sync failed: ${errorMessage(error)}`);
    }
  }

  /** The token of a bot whose updates this server receives. */
  tokenOf(botId: string): string | null {
    return this.bots.get(botId)?.botToken ?? null;
  }

  /**
   * A t.me link that opens the workspace's bot with a one-time code. Pressing
   * Start there sends `/start <code>`, which connects the chat.
   */
  async createLink(user: User, workspaceId: string): Promise<TelegramLink> {
    // The workspace's own bot, else the shared one.
    const { botToken } = await this.applicationSettingsService.getTelegramSettings(
      user,
      workspaceId,
    );
    if (!botToken) {
      throw new BadRequestException('Telegram bot is not configured');
    }
    if (!this.bots.has(botIdOf(botToken))) {
      // A token saved a moment ago: start listening before the user presses Start.
      await this.sync();
    }

    const username = await this.usernameOf(botToken);
    const { code, expiresAt } = await this.linkCodes.issue({
      userId: user.id,
      workspaceId,
      botId: botIdOf(botToken),
    });
    return { url: `https://t.me/${username}?start=${code}`, expiresAt: expiresAt.toISOString() };
  }

  private async watch(botToken: string, publicUrl: string | null): Promise<void> {
    const id = botIdOf(botToken);
    const current = this.bots.get(id);
    if (current?.botToken === botToken && current.publicUrl === publicUrl) {
      return;
    }
    current?.stop.abort();
    const bot: WatchedBot = { botToken, publicUrl, stop: new AbortController() };
    this.bots.set(id, bot);

    // A webhook set up by hand (TELEGRAM_WEBHOOK_SECRET, POST /telegram/webhook) stays as it is.
    if (botToken === process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET) {
      return;
    }

    if (publicUrl?.startsWith('https://')) {
      try {
        await this.call(botToken, 'setWebhook', {
          url: `${publicUrl}/api/v1/telegram/webhook/${id}`,
          secret_token: webhookSecretOf(botToken),
          allowed_updates: ALLOWED_UPDATES,
        });
        this.logger.log(`Telegram bot ${id} receives updates by webhook`);
      } catch (error) {
        this.logger.warn(`Telegram bot ${id}: setWebhook failed: ${errorMessage(error)}`);
        // Forgotten, so the next sync tries again.
        this.bots.delete(id);
      }
      return;
    }

    void this.poll(bot);
  }

  private async poll(bot: WatchedBot): Promise<void> {
    const id = botIdOf(bot.botToken);
    const { signal } = bot.stop;
    let offset: number | undefined;
    let deletedWebhook = false;
    this.logger.log(`Telegram bot ${id} receives updates by long polling`);

    while (!signal.aborted) {
      try {
        if (!deletedWebhook) {
          // getUpdates is refused while a webhook is set.
          await this.call(bot.botToken, 'deleteWebhook', {}, signal);
          deletedWebhook = true;
        }
        const updates = await this.call<unknown[]>(
          bot.botToken,
          'getUpdates',
          { offset, timeout: LONG_POLL_SECONDS, allowed_updates: ALLOWED_UPDATES },
          signal,
          (LONG_POLL_SECONDS + 10) * 1000,
        );
        for (const raw of updates) {
          offset = this.updateIdOf(raw) + 1;
          await this.dispatch(raw, bot.botToken);
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        if (error instanceof TelegramBotApiError && error.errorCode === UNAUTHORIZED) {
          // Stays in the map, so the next sync does not retry a dead token.
          this.logger.error(`Telegram bot ${id}: the token was rejected; polling stopped`);
          return;
        }
        this.logger.warn(`Telegram bot ${id}: getUpdates failed: ${errorMessage(error)}`);
        await delay(POLL_RETRY_MS, undefined, { signal }).catch(() => undefined);
      }
    }
  }

  private updateIdOf(raw: unknown): number {
    const id =
      typeof raw === 'object' && raw !== null && 'update_id' in raw ? raw.update_id : undefined;
    return typeof id === 'number' ? id : 0;
  }

  /** One update, decoded the way the webhook decodes it; a failure never stops the loop. */
  private async dispatch(raw: unknown, botToken: string): Promise<void> {
    const update = decodeTelegramUpdate(raw);
    if (Exit.isFailure(update)) {
      this.logger.warn(
        `Ignored Telegram update ${this.updateIdOf(raw)}: ${describeSchemaFailure(update.cause).join('; ')}`,
      );
      return;
    }
    try {
      await this.telegramService.handleUpdate(update.value, botToken);
    } catch (error) {
      this.logger.error(`Telegram update ${this.updateIdOf(raw)} failed: ${errorMessage(error)}`);
    }
  }

  private async usernameOf(botToken: string): Promise<string> {
    const known = this.usernames.get(botToken);
    if (known) {
      return known;
    }
    const me = await this.call<{ username?: string }>(botToken, 'getMe', {});
    if (!me.username) {
      throw new BadRequestException('Telegram did not return the bot username');
    }
    this.usernames.set(botToken, me.username);
    return me.username;
  }

  /** One Bot API call. The URL carries the token, so it is never logged. */
  private async call<T>(
    botToken: string,
    method: string,
    body: Record<string, unknown>,
    stop?: AbortSignal,
    timeoutMs = API_TIMEOUT_MS,
  ): Promise<T> {
    const payload = await attemptWithRetry(
      async signal => {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: stop ? AbortSignal.any([signal, stop]) : signal,
        });
        return (await response.json()) as {
          ok?: boolean;
          result?: T;
          error_code?: number;
          description?: string;
        };
      },
      {
        timeoutMs,
        timeoutMessage: `Telegram ${method} timed out`,
        retries: 0,
        baseDelayMs: 0,
        maxDelayMs: 0,
      },
    );
    if (!payload.ok) {
      throw new TelegramBotApiError(
        payload.description || `Telegram ${method} failed`,
        payload.error_code,
      );
    }
    return payload.result as T;
  }
}
