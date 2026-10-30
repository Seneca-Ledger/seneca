import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemImage, Payable, PayablePayment, Transaction } from '../../entities';
import { ItemImagesController } from './item-images.controller';
import { ItemImagesService } from './item-images.service';
import { ItemKindsService } from './item-kinds.service';
import { WikidataImagesService } from './wikidata-images.service';

@Module({
  imports: [TypeOrmModule.forFeature([ItemImage, Transaction, Payable, PayablePayment])],
  controllers: [ItemImagesController],
  providers: [ItemImagesService, ItemKindsService, WikidataImagesService],
})
export class ItemImagesModule {}
