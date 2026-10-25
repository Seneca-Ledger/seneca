import { AsyncLocalStorage } from 'node:async_hooks';
import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import type { Repository } from 'typeorm';
import { hasPermissions } from '../../common/authz/request-permissions';
import { attemptWithRetry } from '../../common/effect/attempt-with-retry';
import { Permission } from '../../common/enums/permissions.enum';
import { formatMoney } from '../../common/utils/format-money.util';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import type { SendTelegramReportBody, TelegramConnection } from '../../contracts';
import { CategoryType } from '../../entities/category.entity';
import { IdempotencyKey } from '../../entities/idempotency-key.entity';
import type { Insight } from '../../entities/insight.entity';
import { ReceiptSource } from '../../entities/receipt.entity';
import { ReportStatus, ReportType, TelegramReport } from '../../entities/telegram-report.entity';
import { Transaction, TransactionCategorySource } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { ApplicationSettingsService } from '../application-settings/application-settings.service';
import { UNCATEGORIZED_CATEGORY_NAME } from '../categories/uncategorized-category';
import { ClassificationService } from '../classification/services/classification.service';
import { GoalsService } from '../goals/goals.service';
import { NetWorthService } from '../net-worth/net-worth.service';
import { ReceiptsService } from '../receipts/receipts.service';
import type { DailyReport } from '../reports/interfaces/daily-report.interface';
import type { MonthlyReport } from '../reports/interfaces/monthly-report.interface';
import { ReportsService } from '../reports/reports.service';
import { StatementsService } from '../statements/statements.service';
import { telegramConnectionOf } from './telegram-connection.util';
import { parseExpenseText } from './telegram-inbound.util';
import { TelegramLinkCodes } from './telegram-link-codes';
import {
  renderTelegramMessage,
  resolveTelegramLocale,
  type TelegramMessageKey,
} from './telegram-translations';
import type {
  TelegramCallbackQuery,
  TelegramDocument,
  TelegramUpdate,
} from './telegram-update.schema';

interface TelegramSendResult {
  messageId: string;
}

/** An inline keyboard in Telegram's own shape, passed through as `reply_markup`. */
interface TelegramReplyMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
/** Callback data is limited to 64 bytes by Telegram; `kind:action:id` fits a uuid. */
const CALLBACK_PATTERN = /^(rcpt|stmt):del:([0-9a-f-]{36})$/;
// Bot API calls besides sendMessage, which has its own configurable timeout.
const API_TIMEOUT_MS = 10_000;
// Bots may download files of up to 20 MB.
const FILE_DOWNLOAD_TIMEOUT_MS = 60_000;

/** A connected chat's account, with its membership of the workspace the bot answers for. */
interface LinkedSender {
  user: User;
  workspaceId: string;
  member: WorkspaceMember;
}

/** A bot token is "<bot id>:<secret>"; the id alone names the bot. */
export const botIdOf = (botToken: string): string => botToken.split(':')[0];

interface TelegramSendMessageResponse {
  ok: boolean;
  description?: string;
  error_code?: number;
  result?: {
    message_id?: number | string;
  };
}

interface TelegramGetFileResponse {
  ok: boolean;
  description?: string;
  result?: {
    file_path?: string;
  };
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

class TelegramApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly errorCode?: number,
  ) {
    super(message);
    this.name = 'TelegramApiError';
  }
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken?: string;
  /** The bot an update came in on, while it is handled: replies go out through it. */
  private readonly inboundBot = new AsyncLocalStorage<string>();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TelegramReport)
    private readonly telegramReportRepository: Repository<TelegramReport>,
    private readonly reportsService: ReportsService,
    private readonly statementsService: StatementsService,
    private readonly goalsService: GoalsService,
    private readonly netWorthService: NetWorthService,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @Optional()
    private readonly applicationSettingsService?: ApplicationSettingsService,
    @Optional()
    private readonly receiptsService?: ReceiptsService,
    @Optional()
    private readonly classificationService?: ClassificationService,
    @Optional()
    @InjectRepository(Transaction)
    private readonly transactionRepository?: Repository<Transaction>,
    @Optional()
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyKeyRepository?: Repository<IdempotencyKey>,
    @Optional()
    private readonly linkCodes?: TelegramLinkCodes,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured. Telegram features will be disabled.');
    }
  }

  async isEnabled(user?: User | null): Promise<boolean> {
    return Boolean((await this.resolveBot(user)).botToken);
  }

  /**
   * The bot to talk through: the one the update being handled came in on, else
   * the bot of the workspace the user's chat is connected in (the only bot that
   * chat has started, so the only one allowed to write to it), else the server
   * default.
   */
  private async resolveBot(
    user?: User | null,
  ): Promise<{ botToken: string | null; timeoutMs?: number }> {
    const inbound = this.inboundBot.getStore();
    if (inbound) {
      return { botToken: inbound };
    }
    const settings = await this.applicationSettingsService?.getTelegramSettings(
      user,
      user?.telegramWorkspaceId ?? undefined,
    );
    return {
      botToken: settings?.botToken || this.botToken || null,
      timeoutMs: settings?.timeoutMs,
    };
  }

  getConnection(user: User, workspaceId: string): TelegramConnection {
    return telegramConnectionOf(user, workspaceId);
  }

  async disconnect(user: User): Promise<void> {
    await this.userRepository.update(
      { id: user.id },
      { telegramId: null, telegramChatId: null, telegramWorkspaceId: null },
    );
  }

  /**
   * The workspace the bot answers for: the one the chat was connected in or,
   * for chats connected before that was recorded, the user's registration
   * workspace. Null once the user is no longer a member of it.
   */
  async resolveWorkspaceId(user: User): Promise<string | null> {
    return (await this.linkedMembership(user))?.workspaceId ?? null;
  }

  private async linkedMembership(
    user: User,
  ): Promise<{ workspaceId: string; member: WorkspaceMember } | null> {
    const workspaceId = user.telegramWorkspaceId ?? user.workspaceId;
    if (!workspaceId) {
      return null;
    }

    // A past version is never the bot's workspace: no reports from it and no
    // documents filed into it, scheduled or sent from the chat.
    const member = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: user.id, workspace: STANDARD_WORKSPACE },
    });
    return member ? { workspaceId, member } : null;
  }

  async sendReport(user: User, dto: SendTelegramReportBody, workspaceId: string) {
    // Reports go to the caller's own connected chat, never to one they name.
    if (dto.chatId && dto.chatId !== user.telegramChatId) {
      throw new BadRequestException('chatId must be your connected Telegram chat');
    }
    const chatId = dto.chatId || user.telegramChatId;
    if (!chatId) {
      throw new BadRequestException(
        'Telegram chat is not connected. Provide chatId or connect Telegram first.',
      );
    }

    if (!(await this.isEnabled(user))) {
      throw new BadRequestException('Telegram bot is not configured on the server');
    }

    switch (dto.reportType) {
      case ReportType.DAILY: {
        const date = dto.date || this.formatDateOnly(new Date());
        return this.handleDailyReport(user, workspaceId, chatId, date);
      }
      case ReportType.MONTHLY: {
        const now = new Date();
        const year = dto.year || now.getUTCFullYear();
        const month = dto.month || now.getUTCMonth() + 1;
        return this.handleMonthlyReport(user, workspaceId, chatId, year, month);
      }
      default:
        throw new BadRequestException('Unsupported report type for Telegram');
    }
  }

  async listReports(user: User, page = 1, limit = 20) {
    const [data, total] = await this.telegramReportRepository.findAndCount({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  /**
   * One message per newly-created warning, sent to a connected user's chat.
   * Called by TelegramScheduler right after InsightsService.refresh(), which
   * only returns rows it just created — so an insight that is still true
   * tomorrow does not page the user again, but one that reappears after
   * being dismissed does.
   */
  async pushInsightDigest(user: User, insights: Insight[]): Promise<void> {
    if (!user.telegramChatId || insights.length === 0) {
      return;
    }
    if (!(await this.isEnabled(user))) {
      return;
    }

    const locale = user.locale || 'en';
    const header = renderTelegramMessage(locale, 'insight_digest_header');

    for (const insight of insights) {
      try {
        await this.sendMessage(
          user.telegramChatId,
          `${header}\n\n${insight.title}\n${insight.message}`,
          user,
        );
      } catch (error: unknown) {
        this.logger.warn(
          `Failed to push insight digest to user ${user.id}: ${getErrorMessage(error)}`,
        );
      }
    }
  }

  private async handleDailyReport(user: User, workspaceId: string, chatId: string, date: string) {
    const reportDate = this.toDateOnly(date);
    const existing = await this.findExisting(user.id, ReportType.DAILY, reportDate);

    if (existing?.status === ReportStatus.SENT) {
      return { status: 'already_sent', report: existing };
    }

    const dailyReport = await this.reportsService.generateDailyReport(workspaceId, date);
    const message = this.formatDailyReportMessage(user.locale || 'en', date, dailyReport);

    return this.persistAndSend(user, chatId, ReportType.DAILY, reportDate, message, existing);
  }

  private async handleMonthlyReport(
    user: User,
    workspaceId: string,
    chatId: string,
    year: number,
    month: number,
  ) {
    const reportDate = this.toDateOnly(`${year}-${String(month).padStart(2, '0')}-01`);
    const existing = await this.findExisting(user.id, ReportType.MONTHLY, reportDate);

    if (existing?.status === ReportStatus.SENT) {
      return { status: 'already_sent', report: existing };
    }

    const monthlyReport = await this.reportsService.generateMonthlyReport(workspaceId, year, month);
    const message = this.formatMonthlyReportMessage(
      user.locale || 'en',
      year,
      month,
      monthlyReport,
    );

    return this.persistAndSend(user, chatId, ReportType.MONTHLY, reportDate, message, existing);
  }

  private async persistAndSend(
    user: User,
    chatId: string,
    reportType: ReportType,
    reportDate: Date,
    message: string,
    existing?: TelegramReport | null,
  ) {
    const record =
      existing ||
      this.telegramReportRepository.create({
        userId: user.id,
        chatId,
        reportType,
        reportDate,
      });

    record.chatId = chatId;
    record.reportDate = reportDate;
    record.reportType = reportType;
    record.status = ReportStatus.PENDING;

    const savedRecord = await this.telegramReportRepository.save(record);

    try {
      const result = await this.sendMessage(chatId, message, user);
      savedRecord.status = ReportStatus.SENT;
      savedRecord.sentAt = new Date();
      savedRecord.messageId = result.messageId;
      await this.telegramReportRepository.save(savedRecord);

      return { status: 'sent', report: savedRecord };
    } catch (error) {
      savedRecord.status = ReportStatus.FAILED;
      await this.telegramReportRepository.save(savedRecord);
      throw error;
    }
  }

  private async findExisting(
    userId: string,
    reportType: ReportType,
    reportDate: Date,
  ): Promise<TelegramReport | null> {
    const reportDateStr = this.formatDateOnly(reportDate);
    return this.telegramReportRepository
      .createQueryBuilder('report')
      .where('report.userId = :userId', { userId })
      .andWhere('report.reportType = :reportType', { reportType })
      .andWhere('report.reportDate = :reportDate', { reportDate: reportDateStr })
      .getOne();
  }

  /** Renders `key` in `user`'s locale (or `ru` if unset) and sends it. */
  private async send(
    chatId: string,
    user: User | null,
    key: TelegramMessageKey,
    params?: Record<string, string | number>,
  ): Promise<TelegramSendResult> {
    const text = renderTelegramMessage(user?.locale || 'en', key, params);
    return this.sendMessage(chatId, text, user);
  }

  /** Sends arbitrary text to a chat. Public so other modules can deliver through the bot. */
  async sendPlainMessage(
    chatId: string,
    text: string,
    user?: User | null,
  ): Promise<TelegramSendResult> {
    return this.sendMessage(chatId, text, user);
  }

  private async sendMessage(
    chatId: string,
    text: string,
    user?: User | null,
    replyMarkup?: TelegramReplyMarkup,
  ): Promise<TelegramSendResult> {
    const bot = await this.resolveBot(user);
    const apiBase = bot.botToken ? `https://api.telegram.org/bot${bot.botToken}` : undefined;
    if (!apiBase) {
      throw new BadRequestException('Telegram bot is not configured');
    }

    const timeoutMsRaw =
      bot.timeoutMs || Number.parseInt(process.env.TELEGRAM_TIMEOUT_MS || '10000', 10);
    const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 10000;

    const sendOnce = async (signal: AbortSignal) => {
      const response = await fetch(`${apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
        signal,
      });

      if (response.status >= 500) {
        throw new TelegramApiError('Telegram API temporary error', response.status);
      }

      const payload = (await response.json()) as TelegramSendMessageResponse;

      if (!payload.ok) {
        const description = payload?.description || 'Unknown error';
        const errorCode = payload?.error_code ? Number(payload.error_code) : undefined;
        this.logger.error(`Failed to send Telegram message: ${description}`);
        throw new TelegramApiError(description, response.status, errorCode);
      }

      return { messageId: String(payload.result?.message_id || '') };
    };

    try {
      return await attemptWithRetry(sendOnce, {
        timeoutMs,
        timeoutMessage: 'Telegram request timed out',
        retries: 2,
        baseDelayMs: 500,
        maxDelayMs: 5000,
        retryable: error => error instanceof TelegramApiError && (error.statusCode || 0) >= 500,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Telegram API error: ${message}`);
    }
  }

  /**
   * Handles an update `botToken`'s bot received; without one, it came in on the
   * TELEGRAM_BOT_TOKEN bot (the webhook configured by hand).
   */
  async handleUpdate(update: TelegramUpdate, botToken = this.botToken): Promise<void> {
    if (!botToken) {
      return;
    }
    await this.inboundBot.run(botToken, () => this.dispatchUpdate(update, botToken));
  }

  private async dispatchUpdate(update: TelegramUpdate, botToken: string): Promise<void> {
    if (update?.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

    const message = update?.message;
    if (!message) {
      return;
    }
    const updateId = update.update_id;

    const chatId = message.chat?.id ? String(message.chat.id) : null;
    const text: string | undefined = message.text?.trim();
    const telegramId = message.from?.id ? String(message.from.id) : null;

    if (!chatId) {
      return;
    }

    // Telegram's own client language is the only signal available before a
    // user is matched to an account — once matched, their in-app locale
    // choice (User.locale) always wins, see resolveLocale().
    const fallbackLocale = resolveTelegramLocale(message.from?.language_code);
    const knownUser = telegramId ? await this.findLinkedUser(telegramId, chatId) : null;
    const locale = knownUser?.locale || fallbackLocale;

    if (text?.startsWith('/start')) {
      // A Connect link opens the bot with `/start <code>`.
      const code = text.slice('/start'.length).trim();
      if (code) {
        await this.linkChat(code, botToken, chatId, telegramId, fallbackLocale);
        return;
      }
      await this.sendMessage(
        chatId,
        renderTelegramMessage(locale, knownUser ? 'connected' : 'start_greeting'),
        knownUser,
      );
      return;
    }

    if (text?.startsWith('/help')) {
      await this.sendMessage(
        chatId,
        `${renderTelegramMessage(locale, 'help')}\n\n${renderTelegramMessage(locale, 'inbound_help')}`,
        knownUser,
      );
      return;
    }

    if (text?.startsWith('/report')) {
      await this.handleReportCommand(chatId, telegramId, text, locale);
      return;
    }

    if (text?.startsWith('/goals')) {
      await this.handleGoalsCommand(chatId, telegramId, locale);
      return;
    }

    if (text?.startsWith('/networth')) {
      await this.handleNetWorthCommand(chatId, telegramId, locale);
      return;
    }

    if (message.photo?.length) {
      const largest = message.photo[message.photo.length - 1];
      await this.handleReceiptImage(
        chatId,
        telegramId,
        {
          file_id: largest.file_id,
          file_name: `receipt-${largest.file_id}.jpg`,
          mime_type: 'image/jpeg',
        },
        locale,
        updateId,
      );
      return;
    }

    if (message.document) {
      const mimeType = (message.document.mime_type || '').toLowerCase();
      if (IMAGE_MIME_TYPES.has(mimeType)) {
        await this.handleReceiptImage(chatId, telegramId, message.document, locale, updateId);
      } else {
        await this.handleDocumentUpload(chatId, telegramId, message.document, locale, updateId);
      }
      return;
    }

    if (text?.startsWith('/')) {
      await this.sendMessage(chatId, renderTelegramMessage(locale, 'unknown_command'), knownUser);
      return;
    }

    if (text) {
      await this.handleExpenseText(chatId, telegramId, text, locale, updateId);
    }
  }

  /**
   * `/start <code>` from a Connect link binds this chat to the account and
   * workspace the code was issued for. A code works once, and only on the bot
   * it was issued for.
   */
  private async linkChat(
    code: string,
    botToken: string,
    chatId: string,
    telegramId: string | null,
    fallbackLocale: string,
  ): Promise<void> {
    const claim = await this.linkCodes?.take(code);
    const user =
      claim && telegramId && claim.botId === botIdOf(botToken)
        ? await this.userRepository.findOne({ where: { id: claim.userId, isActive: true } })
        : null;
    const member =
      claim && user
        ? await this.workspaceMemberRepository.findOne({
            where: {
              workspaceId: claim.workspaceId,
              userId: user.id,
              workspace: STANDARD_WORKSPACE,
            },
          })
        : null;
    if (!(claim && telegramId && user && member)) {
      await this.sendMessage(chatId, renderTelegramMessage(fallbackLocale, 'link_expired'));
      return;
    }

    // A chat belongs to one account: findUserByTelegram expects a single match.
    const released = { telegramId: null, telegramChatId: null, telegramWorkspaceId: null };
    await this.userRepository.update({ telegramId }, released);
    await this.userRepository.update({ telegramChatId: chatId }, released);
    await this.userRepository.update(
      { id: user.id },
      { telegramId, telegramChatId: chatId, telegramWorkspaceId: claim.workspaceId },
    );
    await this.send(chatId, user, 'connected');
  }

  /**
   * The user and workspace behind a chat, or a reply explaining why there is none.
   * The user needs `permission` in that workspace, as the same action through the
   * API would; without it they get `deniedKey`. With an update id it also claims
   * the update, and returns null without a reply for a redelivery: the first
   * delivery has already booked and answered it.
   */
  private async resolveSender(
    chatId: string,
    telegramId: string | null,
    fallbackLocale: string,
    permission: Permission,
    deniedKey: TelegramMessageKey,
    updateId?: number,
  ): Promise<{ user: User; workspaceId: string } | null> {
    if (!telegramId) {
      await this.sendMessage(
        chatId,
        renderTelegramMessage(fallbackLocale, 'document_telegram_id_unknown'),
      );
      return null;
    }
    const sender = await this.findLinkedSender(telegramId, chatId);
    if (!sender) {
      await this.sendMessage(chatId, renderTelegramMessage(fallbackLocale, 'not_connected'));
      return null;
    }
    const { user, workspaceId, member } = sender;
    const allowed = hasPermissions([permission], {
      user,
      workspaceRole: member.role,
      workspaceMemberPermissions: member.permissions,
    });
    if (!allowed) {
      this.logger.warn(`Telegram: user ${user.id} lacks ${permission} in workspace ${workspaceId}`);
      await this.send(chatId, user, deniedKey);
      return null;
    }
    if (updateId !== undefined && !(await this.claimUpdate(updateId, user.id, workspaceId))) {
      this.logger.log(`Telegram update ${updateId} was already handled; skipping the redelivery`);
      return null;
    }
    return { user, workspaceId };
  }

  /** Inserts the update's key; the unique (key, user, workspace) constraint makes the claim atomic. */
  private async claimUpdate(
    updateId: number,
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    if (!this.idempotencyKeyRepository) {
      return true;
    }
    try {
      await this.idempotencyKeyRepository.insert({
        key: `telegram:update:${updateId}`,
        userId,
        workspaceId,
        responseHash: '',
        responseData: {},
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      return true;
    } catch (error) {
      // QueryFailedError carries the driver's fields; 23505 is a unique violation.
      if ((error as { code?: string }).code === '23505') {
        return false;
      }
      throw error;
    }
  }

  /**
   * A photo (or an image sent as a file) is a receipt: it goes through the
   * same scan pipeline as the in-app camera and lands in the review inbox.
   */
  private async handleReceiptImage(
    chatId: string,
    telegramId: string | null,
    document: TelegramDocument,
    fallbackLocale: string,
    updateId?: number,
  ): Promise<void> {
    const sender = await this.resolveSender(
      chatId,
      telegramId,
      fallbackLocale,
      Permission.STATEMENT_UPLOAD,
      'receipt_photo_failed',
      updateId,
    );
    if (!sender) {
      return;
    }
    const { user, workspaceId } = sender;
    const locale = user.locale || 'en';
    if (!this.receiptsService) {
      await this.sendMessage(chatId, renderTelegramMessage(locale, 'receipt_photo_failed'), user);
      return;
    }

    await this.sendMessage(chatId, renderTelegramMessage(locale, 'receipt_photo_received'), user);
    try {
      const fileName = this.sanitizeFileName(
        document.file_name || `receipt-${document.file_id}.jpg`,
      );
      const mimeType = document.mime_type || 'image/jpeg';
      const file = await this.downloadTelegramFile(document.file_id, fileName, mimeType);
      const receipt = await this.receiptsService.createFromScan({
        userId: user.id,
        workspaceId,
        file: file as Express.Multer.File,
        language: locale,
        source: ReceiptSource.TELEGRAM,
      });
      const amount = receipt.parsedData?.amount;
      const text =
        typeof amount === 'number' && Number.isFinite(amount)
          ? renderTelegramMessage(locale, 'receipt_photo_done', {
              vendor: receipt.parsedData?.vendor || '—',
              amount: formatMoney(amount, locale),
              currency: receipt.parsedData?.currency || '',
              status: receipt.status,
            })
          : renderTelegramMessage(locale, 'receipt_photo_unreadable');
      await this.sendMessage(chatId, text, user, {
        inline_keyboard: [
          [
            {
              text: renderTelegramMessage(locale, 'delete_button'),
              callback_data: `rcpt:del:${receipt.id}`,
            },
          ],
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle Telegram receipt image: ${message}`);
      await this.sendMessage(chatId, renderTelegramMessage(locale, 'receipt_photo_failed'), user);
    }
  }

  /**
   * "coffee 4.50" books a manual expense with today's date. It is born
   * unreviewed and uncategorised on purpose: the review inbox is where the
   * category gets picked, with the keyboard, not in a chat.
   */
  private async handleExpenseText(
    chatId: string,
    telegramId: string | null,
    text: string,
    fallbackLocale: string,
    updateId?: number,
  ): Promise<void> {
    const parsed = parseExpenseText(text);
    if (!parsed) {
      const user = telegramId ? await this.findLinkedUser(telegramId, chatId) : null;
      await this.sendMessage(
        chatId,
        renderTelegramMessage(user?.locale || fallbackLocale, 'expense_text_unparsed'),
        user,
      );
      return;
    }
    const sender = await this.resolveSender(
      chatId,
      telegramId,
      fallbackLocale,
      Permission.STATEMENT_UPLOAD,
      'expense_text_failed',
      updateId,
    );
    if (!sender) {
      return;
    }
    const { user, workspaceId } = sender;
    const locale = user.locale || 'en';

    try {
      const categoryId = await this.classificationService?.ensureCategory(
        user.id,
        UNCATEGORIZED_CATEGORY_NAME,
        CategoryType.EXPENSE,
        undefined,
        workspaceId,
      );
      if (!categoryId) {
        throw new Error('No fallback category available');
      }
      const currency = parsed.currency || (await this.workspaceCurrency(workspaceId)) || 'KZT';
      const statement = await this.statementsService.createManualExpense({
        user,
        workspaceId,
        payload: {
          amount: String(parsed.amount),
          currency,
          merchant: parsed.merchant || 'Telegram',
          categoryId,
          date: new Date().toISOString().slice(0, 10),
          description: text.slice(0, 500),
        },
        files: [],
      });
      await this.transactionRepository?.update(
        { statementId: statement.id, workspaceId },
        {
          isVerified: false,
          categorySource: TransactionCategorySource.DEFAULT,
          categoryReason: null,
        },
      );
      await this.sendMessage(
        chatId,
        renderTelegramMessage(locale, 'expense_text_done', {
          merchant: parsed.merchant || 'Telegram',
          amount: formatMoney(parsed.amount, locale),
          currency,
        }),
        user,
        {
          inline_keyboard: [
            [
              {
                text: renderTelegramMessage(locale, 'delete_button'),
                callback_data: `stmt:del:${statement.id}`,
              },
            ],
          ],
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to book Telegram expense: ${message}`);
      await this.sendMessage(chatId, renderTelegramMessage(locale, 'expense_text_failed'), user);
    }
  }

  private async workspaceCurrency(workspaceId: string): Promise<string | null> {
    const member = await this.workspaceMemberRepository.findOne({
      where: { workspaceId },
      relations: {
        workspace: true,
      },
    });
    const currency = (member as { workspace?: { currency?: string | null } } | null)?.workspace
      ?.currency;
    return currency ?? null;
  }

  /** The delete button under a bot reply; anything else is acknowledged and ignored. */
  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const chatId = query.message?.chat?.id ? String(query.message.chat.id) : null;
    const telegramId = query.from?.id ? String(query.from.id) : null;
    const match = query.data ? CALLBACK_PATTERN.exec(query.data) : null;
    const fallbackLocale = resolveTelegramLocale(query.from?.language_code);
    if (!(chatId && match)) {
      await this.answerCallbackQuery(query.id);
      return;
    }
    const [, kind, id] = match;
    // What the same delete needs through the API: receipts and statements differ.
    const permission = kind === 'rcpt' ? Permission.STATEMENT_EDIT : Permission.STATEMENT_DELETE;
    const sender = await this.resolveSender(
      chatId,
      telegramId,
      fallbackLocale,
      permission,
      'delete_failed',
    );
    if (!sender) {
      await this.answerCallbackQuery(query.id);
      return;
    }
    const { user, workspaceId } = sender;
    const locale = user.locale || 'en';
    try {
      if (kind === 'rcpt') {
        if (!this.receiptsService) throw new Error('Receipts are not available');
        await this.receiptsService.delete(id, workspaceId, user.id);
      } else {
        await this.statementsService.remove(id, user.id, workspaceId);
      }
      await this.answerCallbackQuery(query.id, renderTelegramMessage(locale, 'deleted'));
      await this.sendMessage(chatId, renderTelegramMessage(locale, 'deleted'), user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Telegram delete failed for ${kind} ${id}: ${message}`);
      await this.answerCallbackQuery(query.id, renderTelegramMessage(locale, 'delete_failed'));
    }
  }

  private async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    const { botToken } = await this.resolveBot();
    if (!botToken) {
      return;
    }
    try {
      await attemptWithRetry(
        signal =>
          fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
            signal,
          }),
        {
          timeoutMs: API_TIMEOUT_MS,
          timeoutMessage: 'Telegram request timed out',
          retries: 0,
          baseDelayMs: 0,
          maxDelayMs: 0,
        },
      );
    } catch (error) {
      this.logger.warn(
        `answerCallbackQuery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async handleReportCommand(
    chatId: string,
    telegramId: string | null,
    text: string,
    fallbackLocale: string,
  ): Promise<void> {
    if (!telegramId) {
      await this.sendMessage(chatId, renderTelegramMessage(fallbackLocale, 'telegram_id_unknown'));
      return;
    }

    const sender = await this.resolveSender(
      chatId,
      telegramId,
      fallbackLocale,
      Permission.REPORT_VIEW,
      'report_failed',
    );
    if (!sender) {
      return;
    }
    const { user, workspaceId } = sender;

    const args = text.split(' ').filter(Boolean);
    const arg = args[1];

    try {
      if (arg === 'monthly') {
        const now = new Date();
        await this.sendReport(
          user,
          {
            reportType: ReportType.MONTHLY,
            chatId,
            year: now.getUTCFullYear(),
            month: now.getUTCMonth() + 1,
          },
          workspaceId,
        );
      } else if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) {
        await this.sendReport(
          user,
          {
            reportType: ReportType.DAILY,
            chatId,
            date: arg,
          },
          workspaceId,
        );
      } else {
        await this.sendReport(
          user,
          {
            reportType: ReportType.DAILY,
            chatId,
            date: this.formatDateOnly(new Date()),
          },
          workspaceId,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error handling /report command: ${message}`);
      await this.sendMessage(
        chatId,
        renderTelegramMessage(user.locale || 'en', 'report_failed'),
        user,
      );
    }
  }

  private async handleGoalsCommand(
    chatId: string,
    telegramId: string | null,
    fallbackLocale: string,
  ): Promise<void> {
    if (!telegramId) {
      await this.sendMessage(chatId, renderTelegramMessage(fallbackLocale, 'telegram_id_unknown'));
      return;
    }

    const sender = await this.resolveSender(
      chatId,
      telegramId,
      fallbackLocale,
      Permission.GOAL_VIEW,
      'report_failed',
    );
    if (!sender) {
      return;
    }
    const { user, workspaceId } = sender;

    const locale = user.locale || 'en';
    const goals = await this.goalsService.findAll(workspaceId);

    if (goals.length === 0) {
      await this.sendMessage(chatId, renderTelegramMessage(locale, 'goals_empty'), user);
      return;
    }

    const lines = [renderTelegramMessage(locale, 'goals_header'), ''];
    for (const goal of goals) {
      lines.push(
        renderTelegramMessage(locale, 'goal_item', {
          name: goal.name,
          current: formatMoney(goal.currentAmount, locale),
          target: formatMoney(goal.targetAmount, locale),
          currency: goal.currency,
          percent: Math.round(goal.percent),
        }),
      );
    }

    await this.sendMessage(chatId, lines.join('\n'), user);
  }

  private async handleNetWorthCommand(
    chatId: string,
    telegramId: string | null,
    fallbackLocale: string,
  ): Promise<void> {
    if (!telegramId) {
      await this.sendMessage(chatId, renderTelegramMessage(fallbackLocale, 'telegram_id_unknown'));
      return;
    }

    const sender = await this.resolveSender(
      chatId,
      telegramId,
      fallbackLocale,
      Permission.REPORT_VIEW,
      'report_failed',
    );
    if (!sender) {
      return;
    }
    const { user, workspaceId } = sender;

    const locale = user.locale || 'en';
    const netWorth = await this.netWorthService.getNetWorth(workspaceId, '30d', locale);

    const lines = [
      renderTelegramMessage(locale, 'networth_header', {
        value: formatMoney(netWorth.current, locale),
        currency: netWorth.currency,
      }),
    ];

    if (netWorth.changePercent !== null) {
      const key = netWorth.change >= 0 ? 'networth_change_up' : 'networth_change_down';
      lines.push(
        renderTelegramMessage(locale, key, {
          amount: formatMoney(Math.abs(netWorth.change), locale),
          percent: Math.abs(netWorth.changePercent),
          currency: netWorth.currency,
        }),
      );
    } else if (netWorth.change !== 0) {
      lines.push(
        renderTelegramMessage(locale, 'networth_change_no_percent', {
          amount: formatMoney(netWorth.change, locale),
          currency: netWorth.currency,
        }),
      );
    }

    if (netWorth.riskyPercent > 20) {
      lines.push(
        '',
        renderTelegramMessage(locale, 'networth_risky_warning', {
          percent: Math.round(netWorth.riskyPercent),
          threshold: 20,
        }),
      );
    }

    await this.sendMessage(chatId, lines.join('\n'), user);
  }

  private async handleDocumentUpload(
    chatId: string,
    telegramId: string | null,
    document: TelegramDocument,
    fallbackLocale: string,
    updateId?: number,
  ): Promise<void> {
    const sender = await this.resolveSender(
      chatId,
      telegramId,
      fallbackLocale,
      Permission.STATEMENT_UPLOAD,
      'document_failed',
      updateId,
    );
    if (!sender) {
      return;
    }
    const { user, workspaceId } = sender;

    const locale = user.locale || 'en';
    const fileName = this.sanitizeFileName(
      document.file_name || `statement-${document.file_id}.pdf`,
    );
    const mimeType: string = document.mime_type || 'application/pdf';

    if (mimeType !== 'application/pdf' && !fileName.toLowerCase().endsWith('.pdf')) {
      await this.sendMessage(chatId, renderTelegramMessage(locale, 'document_pdf_only'), user);
      return;
    }

    await this.sendMessage(chatId, renderTelegramMessage(locale, 'document_received'), user);

    try {
      const multerFile = await this.downloadTelegramFile(document.file_id, fileName, mimeType);
      const statement = await this.statementsService.create(
        user,
        workspaceId,
        multerFile as Express.Multer.File,
      );
      await this.sendMessage(
        chatId,
        renderTelegramMessage(locale, 'document_processed', { status: statement.status }),
        user,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle Telegram document: ${message}`);
      await this.sendMessage(chatId, renderTelegramMessage(locale, 'document_failed'), user);
    }
  }

  /**
   * The account behind an update, with the workspace the bot answers for — but
   * only when the update came in on the bot that serves that workspace (its own
   * bot, else the shared one), the bot the chat was connected through. Every
   * field of an update can be forged by whoever holds the bot's token, and a
   * workspace admin holds their own bot's: the bot it arrived on is the one
   * thing the sender cannot choose, so it decides whose chats it may speak for.
   */
  private async findLinkedSender(
    telegramId: string | null,
    chatId: string,
  ): Promise<LinkedSender | null> {
    const user = await this.findUserByTelegram(telegramId, chatId);
    const linked = user ? await this.linkedMembership(user) : null;
    if (!(user && linked && (await this.servesWorkspace(user, linked.workspaceId)))) {
      return null;
    }

    // A chat connected before chats were recorded: remember it now.
    if (!user.telegramChatId) {
      user.telegramChatId = chatId;
      await this.userRepository.save(user);
    }
    return { user, ...linked };
  }

  private async findLinkedUser(telegramId: string, chatId: string): Promise<User | null> {
    return (await this.findLinkedSender(telegramId, chatId))?.user ?? null;
  }

  /** Whether the bot the update being handled came in on is the bot of `workspaceId`. */
  private async servesWorkspace(user: User, workspaceId: string): Promise<boolean> {
    const inbound = this.inboundBot.getStore();
    const settings = await this.applicationSettingsService?.getTelegramSettings(user, workspaceId);
    const served = settings?.botToken || this.botToken;
    return Boolean(inbound) && inbound === served;
  }

  /**
   * The account the chat is connected to. The chat decides, not the sender: a
   * sender id only finds an account whose chat was never recorded.
   */
  private async findUserByTelegram(
    telegramId: string | null,
    chatId: string,
  ): Promise<User | null> {
    const byChat = await this.userRepository
      .createQueryBuilder('user')
      .where('user.isActive = :isActive', { isActive: true })
      .andWhere('user.telegramChatId = :chatId', { chatId })
      .getOne();
    if (byChat || !telegramId) {
      return byChat ?? null;
    }
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.isActive = :isActive', { isActive: true })
      .andWhere('user.telegramId = :telegramId', { telegramId })
      .andWhere('user.telegramChatId IS NULL')
      .getOne();
  }

  private sanitizeFileName(fileName: string): string {
    // Allow cyrillic letters (Russian alphabet) and common characters
    // Remove only truly dangerous characters for file systems
    return fileName.replace(/[<>:"|?*/\\]/g, '_');
  }

  private async downloadTelegramFile(
    fileId: string,
    fileName: string,
    mimeType: string,
  ): Promise<Express.Multer.File> {
    const { botToken } = await this.resolveBot();
    if (!botToken) {
      throw new BadRequestException('Telegram bot is not configured');
    }

    const filePath = await this.getTelegramFilePath(botToken, fileId);
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    // The body is read inside the attempt so a stalled transfer times out too.
    const buffer = await attemptWithRetry(
      async signal => {
        const response = await fetch(downloadUrl, { signal });
        if (!response.ok) {
          throw new BadRequestException('Failed to download the file from Telegram');
        }
        return Buffer.from(await response.arrayBuffer());
      },
      {
        timeoutMs: FILE_DOWNLOAD_TIMEOUT_MS,
        timeoutMessage: 'Telegram file download timed out',
        retries: 0,
        baseDelayMs: 0,
        maxDelayMs: 0,
      },
    );

    const uploadsBaseDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
    const uploadsDir = path.join(uploadsBaseDir, 'telegram');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uniqueName = `${Date.now()}-${fileName}`;
    const targetPath = path.join(uploadsDir, uniqueName);
    fs.writeFileSync(targetPath, buffer);

    const file: Partial<Express.Multer.File> = {
      fieldname: 'file',
      originalname: fileName,
      encoding: '7bit',
      mimetype: mimeType,
      size: buffer.length,
      destination: uploadsDir,
      filename: uniqueName,
      path: targetPath,
      buffer,
    };

    return file as Express.Multer.File;
  }

  private async getTelegramFilePath(botToken: string, fileId: string): Promise<string> {
    const apiBase = `https://api.telegram.org/bot${botToken}`;
    const payload = await attemptWithRetry(
      async signal => {
        const response = await fetch(`${apiBase}/getFile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: fileId }),
          signal,
        });
        if (response.status >= 500) {
          throw new TelegramApiError('Telegram API temporary error', response.status);
        }
        return (await response.json()) as TelegramGetFileResponse;
      },
      {
        timeoutMs: API_TIMEOUT_MS,
        timeoutMessage: 'Telegram request timed out',
        retries: 2,
        baseDelayMs: 500,
        maxDelayMs: 5000,
        retryable: error => error instanceof TelegramApiError,
      },
    );

    if (!payload.ok) {
      const description = payload?.description || 'Unknown error';
      this.logger.error(`Failed to get Telegram file info: ${description}`);
      throw new BadRequestException(`Telegram API error: ${description}`);
    }

    return payload.result?.file_path || '';
  }

  private formatDailyReportMessage(locale: string, date: string, report: DailyReport): string {
    const lines: string[] = [];
    lines.push(renderTelegramMessage(locale, 'daily_header', { date }));
    lines.push(
      renderTelegramMessage(locale, 'income_line', {
        amount: this.formatAmount(report.income.totalAmount, locale),
        count: report.income.transactionCount,
      }),
    );
    lines.push(
      renderTelegramMessage(locale, 'expense_line', {
        amount: this.formatAmount(report.expense.totalAmount, locale),
        count: report.expense.transactionCount,
      }),
    );
    lines.push(
      renderTelegramMessage(locale, 'daily_total', {
        amount: this.formatAmount(report.summary.difference, locale),
      }),
    );

    if (report.income.topCounterparties.length > 0) {
      lines.push('', renderTelegramMessage(locale, 'top_income_header'));
      report.income.topCounterparties.slice(0, 5).forEach((item, idx) => {
        lines.push(
          renderTelegramMessage(locale, 'list_item', {
            index: idx + 1,
            name: item.name,
            amount: this.formatAmount(item.amount, locale),
            count: item.count,
          }),
        );
      });
    }

    if (report.expense.topCategories.length > 0) {
      lines.push('', renderTelegramMessage(locale, 'top_expense_header'));
      report.expense.topCategories.slice(0, 5).forEach((item, idx) => {
        lines.push(
          renderTelegramMessage(locale, 'list_item', {
            index: idx + 1,
            name: item.categoryName,
            amount: this.formatAmount(item.amount, locale),
            count: item.count,
          }),
        );
      });
    }

    return lines.join('\n');
  }

  private formatMonthlyReportMessage(
    locale: string,
    year: number,
    month: number,
    report: MonthlyReport,
  ): string {
    const lines: string[] = [];
    const period = `${String(month).padStart(2, '0')}.${year}`;
    lines.push(renderTelegramMessage(locale, 'monthly_header', { period }));
    lines.push(
      renderTelegramMessage(locale, 'monthly_income', {
        amount: this.formatAmount(report.summary.totalIncome, locale),
      }),
    );
    lines.push(
      renderTelegramMessage(locale, 'monthly_expense', {
        amount: this.formatAmount(report.summary.totalExpense, locale),
      }),
    );
    lines.push(
      renderTelegramMessage(locale, 'monthly_diff', {
        amount: this.formatAmount(report.summary.difference, locale),
        count: report.summary.transactionCount,
      }),
    );

    if (report.categoryDistribution.length > 0) {
      lines.push('', renderTelegramMessage(locale, 'top_categories_header'));
      report.categoryDistribution.slice(0, 5).forEach((item, idx) => {
        lines.push(
          renderTelegramMessage(locale, 'category_item', {
            index: idx + 1,
            name: item.categoryName,
            amount: this.formatAmount(item.amount, locale),
            percent: item.percentage.toFixed(1),
          }),
        );
      });
    }

    if (report.counterpartyDistribution.length > 0) {
      lines.push('', renderTelegramMessage(locale, 'top_counterparties_header'));
      report.counterpartyDistribution.slice(0, 5).forEach((item, idx) => {
        lines.push(
          renderTelegramMessage(locale, 'counterparty_item', {
            index: idx + 1,
            name: item.counterpartyName,
            amount: this.formatAmount(item.amount, locale),
            percent: item.percentage.toFixed(1),
          }),
        );
      });
    }

    return lines.join('\n');
  }

  private formatAmount(value: number | null | undefined, locale: string): string {
    return formatMoney(value || 0, locale);
  }

  private toDateOnly(dateLike: string | Date): Date {
    const d = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private formatDateOnly(dateLike: string | Date): string {
    const d = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
