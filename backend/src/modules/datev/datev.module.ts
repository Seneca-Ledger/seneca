import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../../entities/category.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { WorkspaceServiceSettings } from '../../entities/workspace-service-settings.entity';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { DatevController } from './datev.controller';
import { DatevService } from './datev.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Category, Workspace, WorkspaceServiceSettings]),
    ExchangeRatesModule,
  ],
  controllers: [DatevController],
  providers: [DatevService],
})
export class DatevModule {}
