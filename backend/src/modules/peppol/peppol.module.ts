import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeppolConnection } from '../../entities/peppol-connection.entity';
import { PeppolInboundDocument } from '../../entities/peppol-inbound-document.entity';
import { PeppolTransmission } from '../../entities/peppol-transmission.entity';
import { Workspace } from '../../entities/workspace.entity';
import { InvoicesModule } from '../invoices/invoices.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { PeppolController } from './peppol.controller';
import { PeppolService } from './peppol.service';
import { RecommandClient } from './recommand.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PeppolConnection,
      PeppolTransmission,
      PeppolInboundDocument,
      Workspace,
    ]),
    InvoicesModule,
    ReceiptsModule,
  ],
  controllers: [PeppolController],
  providers: [PeppolService, RecommandClient],
})
export class PeppolModule {}
