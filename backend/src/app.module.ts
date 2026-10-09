import * as path from 'node:path';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as redisStore from 'cache-manager-redis-store';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CsrfGuard } from './common/guards/csrf.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuditActorInterceptor } from './common/interceptors/audit-actor.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { getDatabaseConfig } from './config/database.config';
import {
  ApiKey,
  AuditEvent,
  AuthSession,
  BalanceAccount,
  BalanceSnapshot,
  Branch,
  Budget,
  Category,
  CustomTable,
  CustomTableColumn,
  CustomTableRow,
  DataEntry,
  DriveSettings,
  DropboxSettings,
  ExchangeRate,
  FilePermission,
  GmailSettings,
  GmailWatchSubscription,
  Insight,
  Integration,
  IntegrationToken,
  Notification,
  NotificationPreference,
  OpenProtocolSettings,
  ParsingRule,
  Payable,
  PayeeOverride,
  Receipt,
  ReceiptProcessingJob,
  SharedLink,
  Statement,
  Subscription,
  SubscriptionCharge,
  SubscriptionDecision,
  TaxRate,
  TelegramReport,
  Transaction,
  User,
  Wallet,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceServiceSettings,
} from './entities';
import { AiAnalysisModule } from './modules/ai-analysis/ai-analysis.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { ApplicationSettingsModule } from './modules/application-settings/application-settings.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditInterceptor } from './modules/audit/interceptors/audit.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { BackupsModule } from './modules/backups/backups.module';
import { BalanceModule } from './modules/balance/balance.module';
import { BankSyncModule } from './modules/bank-sync/bank-sync.module';
import { BranchesModule } from './modules/branches/branches.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { BusinessProfileModule } from './modules/business-profile/business-profile.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ClassificationModule } from './modules/classification/classification.module';
import { CryptoModule } from './modules/crypto/crypto.module';
import { CustomTablesModule } from './modules/custom-tables/custom-tables.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DataEntryModule } from './modules/data-entry/data-entry.module';
import { DropboxModule } from './modules/dropbox/dropbox.module';
import { EntityImportsModule } from './modules/entity-imports/entity-imports.module';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';
import { ForecastModule } from './modules/forecast/forecast.module';
import { GmailModule } from './modules/gmail/gmail.module';
import { GoalsModule } from './modules/goals/goals.module';
import { GoogleDriveModule } from './modules/google-drive/google-drive.module';
import { IncomeTaxModule } from './modules/income-tax/income-tax.module';
import { InsightsModule } from './modules/insights/insights.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { MapsModule } from './modules/maps/maps.module';
import { NetWorthModule } from './modules/net-worth/net-worth.module';
import { NotesModule } from './modules/notes/notes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HttpMetricsInterceptor } from './modules/observability/http-metrics.interceptor';
import { ObservabilityModule } from './modules/observability/observability.module';
import { OpenProtocolIntegrationsModule } from './modules/open-protocol-integrations/open-protocol-integrations.module';
import { ParsingModule } from './modules/parsing/parsing.module';
import { PayablesModule } from './modules/payables/payables.module';
import { PushModule } from './modules/push/push.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReviewInboxModule } from './modules/review-inbox/review-inbox.module';
import { SearchModule } from './modules/search/search.module';
import { SmbModule } from './modules/smb/smb.module';
import { StatementsModule } from './modules/statements/statements.module';
import { StorageModule } from './modules/storage/storage.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { TaxModule } from './modules/tax/tax.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';
import { VendorIconsModule } from './modules/vendor-icons/vendor-icons.module';
import { ViewPreferencesModule } from './modules/view-preferences/view-preferences.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../.env')],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    // Counters live in Redis when it is configured. The default in-memory
    // storage is per-process, so every additional instance multiplied every
    // limit — the 5/min on login became 5 per instance per minute.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        return {
          throttlers: [
            {
              ttl: 60000, // 1 minute
              limit: 500, // 500 requests per minute for authenticated users
            },
          ],
          ...(redisUrl ? { storage: new ThrottlerStorageRedisService(redisUrl) } : {}),
        };
      },
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        url: configService.get('REDIS_URL') || 'redis://localhost:6379',
        ttl: 3600, // 1 hour default
      }),
      inject: [ConfigService],
    }),
    // Shares the Redis instance already used for caching (REDIS_URL).
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get('REDIS_URL') || 'redis://localhost:6379',
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => getDatabaseConfig(configService),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      ApiKey,
      User,
      Statement,
      Transaction,
      Category,
      PayeeOverride,
      Branch,
      Wallet,
      TelegramReport,
      ParsingRule,
      Notification,
      NotificationPreference,
      Payable,
      AuthSession,
      AuditEvent,
      BalanceAccount,
      BalanceSnapshot,
      SharedLink,
      FilePermission,
      DataEntry,
      CustomTable,
      CustomTableColumn,
      CustomTableRow,
      Workspace,
      WorkspaceServiceSettings,
      WorkspaceInvitation,
      WorkspaceMember,
      Integration,
      IntegrationToken,
      OpenProtocolSettings,
      Insight,
      DriveSettings,
      DropboxSettings,
      GmailSettings,
      GmailWatchSubscription,
      Receipt,
      ReceiptProcessingJob,
      TaxRate,
      ExchangeRate,
      Budget,
      Subscription,
      SubscriptionCharge,
      SubscriptionDecision,
    ]),
    CommonModule,
    ApplicationSettingsModule,
    AiAnalysisModule,
    BackupsModule,
    AuthModule,
    AuditModule,
    BalanceModule,
    NetWorthModule,
    UsersModule,
    StatementsModule,
    GoogleDriveModule,
    GmailModule,
    DropboxModule,
    ParsingModule,
    ClassificationModule,
    ReceiptsModule,
    CategoriesModule,
    BranchesModule,
    BudgetsModule,
    GoalsModule,
    WalletsModule,
    TransactionsModule,
    ViewPreferencesModule,
    ReportsModule,
    StorageModule,
    TelegramModule,
    TaxModule,
    IncomeTaxModule,
    LedgerModule,
    DataEntryModule,
    CustomTablesModule,
    EntityImportsModule,
    WorkspacesModule,
    NotesModule,
    MapsModule,
    VendorIconsModule,
    NotificationsModule,
    InsightsModule,
    ObservabilityModule,
    OpenProtocolIntegrationsModule,
    BankSyncModule,
    DashboardModule,
    SearchModule,
    PayablesModule,
    InvoicesModule,
    BusinessProfileModule,
    ExchangeRatesModule,
    SubscriptionsModule,
    ReviewInboxModule,
    ForecastModule,
    InvestmentsModule,
    SmbModule,
    PushModule,
    CryptoModule,
    WebhooksModule,
    ApiKeysModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
    // Before AuditInterceptor: the actor must be known when events are written.
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditActorInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    // Registered before JwtAuthGuard: a forged cross-site request should be
    // rejected before it reaches authentication or any handler.
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
