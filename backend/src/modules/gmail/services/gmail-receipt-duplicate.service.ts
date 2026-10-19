import { Injectable } from '@nestjs/common';
import { Receipt } from '../../../entities';
import { ReceiptDuplicateService } from '../../receipts/services/receipt-duplicate.service';

@Injectable()
export class GmailReceiptDuplicateService {
  constructor(private readonly receiptDuplicateService: ReceiptDuplicateService) {}

  findPotentialDuplicates(receipt: Receipt): Promise<Receipt[]> {
    return this.receiptDuplicateService.findPotentialDuplicates(receipt);
  }

  markAsDuplicate(receiptId: string, originalId: string, workspaceId: string): Promise<void> {
    return this.receiptDuplicateService.markAsDuplicate(receiptId, originalId, workspaceId);
  }

  unmarkDuplicate(receiptId: string, workspaceId: string): Promise<void> {
    return this.receiptDuplicateService.unmarkDuplicate(receiptId, workspaceId);
  }
}
