import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimezonesService } from '../../common/services/timezones.service';
import { AuditEvent } from '../../entities/audit-event.entity';
import { AuthSession } from '../../entities/auth-session.entity';
import { EmailChangeToken } from '../../entities/email-change-token.entity';
import { Notification } from '../../entities/notification.entity';
import { NotificationPreference } from '../../entities/notification-preference.entity';
import { User } from '../../entities/user.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { MailerModule } from '../mailer/mailer.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AccountDataService } from './services/account-data.service';
import { EmailChangeService } from './services/email-change.service';
import { PermissionsService } from './services/permissions.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Workspace,
      WorkspaceMember,
      AuthSession,
      NotificationPreference,
      Notification,
      AuditEvent,
      EmailChangeToken,
    ]),
    WorkspacesModule,
    MailerModule,
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    PermissionsService,
    TimezonesService,
    AccountDataService,
    EmailChangeService,
  ],
  exports: [UsersService, PermissionsService, TimezonesService],
})
export class UsersModule {}
