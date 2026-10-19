import { Injectable } from '@nestjs/common';
import { Receipt } from '../../../entities';
import { ReceiptCategoryService } from '../../receipts/services/receipt-category.service';

@Injectable()
export class GmailReceiptCategoryService {
  constructor(private readonly receiptCategoryService: ReceiptCategoryService) {}

  async suggestCategory(receipt: Receipt) {
    return (await this.receiptCategoryService.suggest(receipt))?.category ?? null;
  }

  categorize(receipt: Receipt) {
    return this.receiptCategoryService.categorize(receipt);
  }
}
