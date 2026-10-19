import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportSession } from '../../entities/import-session.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { Workspace } from '../../entities/workspace.entity';
import { ParsingModule } from '../parsing/parsing.module';
import { IntelligentDeduplicationService } from '../parsing/services/intelligent-deduplication.service';
import { TransactionFingerprintService } from '../transactions/services/transaction-fingerprint.service';
import { ImportConfigService } from './config/import.config';
import { ImportSessionController } from './import-session.controller';
import { ImportSessionService } from './services/import-session.service';

/**
 * Import module providing configuration and services for import session workflow
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ImportSession, Transaction, Statement, Workspace, User]),
    forwardRef(() => ParsingModule),
  ],
  controllers: [ImportSessionController],
  providers: [
    ImportConfigService,
    ImportSessionService,
    TransactionFingerprintService,
    IntelligentDeduplicationService,
  ],
  exports: [
    ImportConfigService,
    ImportSessionService,
    TransactionFingerprintService,
    IntelligentDeduplicationService,
  ],
})
export class ImportModule {}
