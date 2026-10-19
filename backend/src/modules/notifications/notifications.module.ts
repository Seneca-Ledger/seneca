import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { devDefault } from '../../common/utils/dev-defaults';
import {
  AuthSession,
  Notification,
  NotificationPreference,
  User,
  WorkspaceMember,
} from '../../entities';
import { MailerModule } from '../mailer/mailer.module';
import { PushModule } from '../push/push.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationEventsListener } from './notification-events.listener';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    PushModule,
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      User,
      WorkspaceMember,
      AuthSession,
    ]),
    MailerModule,
    TelegramModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_ACCESS_SECRET') ||
          devDefault(configService.get<string>('JWT_SECRET'), 'JWT_SECRET');
        return { secret };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDeliveryService,
    NotificationsGateway,
    NotificationEventsListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
