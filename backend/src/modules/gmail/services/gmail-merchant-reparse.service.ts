import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { extractBrandFromSender } from '../../../common/utils/sender-brand.util';
import { Receipt } from '../../../entities';
import { GmailReceiptParserService } from './gmail-receipt-parser.service';

type ReparseMerchantsOptions = {
  dryRun?: boolean;
  limit?: number;
};

type ReparseMerchantDetail = {
  id: string;
  oldVendor?: string;
  newVendor?: string;
  status: 'updated' | 'would_update' | 'skipped' | 'failed';
};

export type ReparseMerchantsResult = {
  total: number;
  reparsed: number;
  skipped: number;
  failed: number;
  details: ReparseMerchantDetail[];
};

const DEFAULT_REPARSE_LIMIT = 100;
const MAX_REPARSE_LIMIT = 500;

const GENERIC_VENDOR_PATTERN =
  /^(page\s+\d+(\s+of\s+\d+)?|receipt|invoice|payment\s+receipt|order\s+confirmation|unknown|n\/a|na)$/i;

const DATE_LIKE_VENDOR_PATTERN =
  /^(date\s*)?\d{4}[-/.]\d{2}[-/.]\d{2}|^\d{2}[-/.]\d{2}[-/.]\d{4}|\d{1,2}:\d{2}\s*(am|pm)(\s*(pst|est|utc|gmt|cst|mst))?$/i;

const AMOUNT_LIKE_VENDOR_PATTERN = /^[$€£¥₽₸]\s*[\d,.]+$|^[\d,.]+\s*[$€£¥₸₽]$/;

const EMAIL_LIKE_VENDOR_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

@Injectable()
export class GmailMerchantReparseService {
  private readonly logger = new Logger(GmailMerchantReparseService.name);

  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    private readonly parserService: GmailReceiptParserService,
  ) {}

  async reparseAll(
    workspaceId: string,
    options: ReparseMerchantsOptions = {},
  ): Promise<ReparseMerchantsResult> {
    const limit = Math.min(Math.max(options.limit || DEFAULT_REPARSE_LIMIT, 1), MAX_REPARSE_LIMIT);
    const dryRun = options.dryRun ?? false;

    const receipts = await this.receiptRepository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const result: ReparseMerchantsResult = {
      total: receipts.length,
      reparsed: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    for (const receipt of receipts) {
      const oldVendor = this.normalizeVendor(receipt.parsedData?.vendor);

      if (!this.needsReparse(receipt.parsedData)) {
        result.skipped += 1;
        result.details.push({
          id: receipt.id,
          oldVendor,
          status: 'skipped',
        });
        continue;
      }

      const newVendor = await this.resolveVendor(receipt);
      if (!newVendor) {
        result.failed += 1;
        result.details.push({
          id: receipt.id,
          oldVendor,
          status: 'failed',
        });
        continue;
      }

      if (!dryRun) {
        receipt.parsedData = {
          ...(receipt.parsedData || {}),
          vendor: newVendor,
        };

        await this.receiptRepository.save(receipt);
      }

      result.reparsed += 1;
      result.details.push({
        id: receipt.id,
        oldVendor,
        newVendor,
        status: dryRun ? 'would_update' : 'updated',
      });
    }

    this.logger.log(
      `Merchant reparse completed: total=${result.total}, updated=${result.reparsed}, skipped=${result.skipped}, failed=${result.failed}`,
    );

    return result;
  }

  private async resolveVendor(receipt: Receipt): Promise<string | undefined> {
    const attachmentPath = this.selectAttachmentPath(receipt);

    if (attachmentPath) {
      const parsedFromPdf = await this.parserService.parseReceipt(attachmentPath, {
        sender: receipt.sender,
        subject: receipt.subject,
        dateHeader: receipt.receivedAt?.toISOString(),
        emailBody: receipt.metadata?.snippet,
      });

      const normalizedFromPdf = this.normalizeVendor(parsedFromPdf?.vendor);
      if (normalizedFromPdf && !this.needsReparse({ vendor: normalizedFromPdf })) {
        return normalizedFromPdf;
      }
    }

    const parsedFromEmail = await this.parserService.parseFromEmailOnly({
      sender: receipt.sender,
      subject: receipt.subject,
      dateHeader: receipt.receivedAt?.toISOString(),
      emailBody: receipt.metadata?.snippet,
    });

    const normalizedFromEmail = this.normalizeVendor(parsedFromEmail?.vendor);
    if (normalizedFromEmail && !this.needsReparse({ vendor: normalizedFromEmail })) {
      return normalizedFromEmail;
    }

    return extractBrandFromSender(receipt.sender);
  }

  private selectAttachmentPath(receipt: Receipt): string | undefined {
    if (!Array.isArray(receipt.attachmentPaths)) {
      return undefined;
    }

    return receipt.attachmentPaths.find(path => typeof path === 'string' && path.trim().length > 0);
  }

  private normalizeVendor(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return undefined;
    }

    return normalized.slice(0, 100);
  }

  private needsReparse(parsedData?: { vendor?: string } | null): boolean {
    const vendor = this.normalizeVendor(parsedData?.vendor);

    if (!vendor) {
      return true;
    }

    if (vendor.length > 60) {
      return true;
    }

    if (GENERIC_VENDOR_PATTERN.test(vendor)) {
      return true;
    }

    if (DATE_LIKE_VENDOR_PATTERN.test(vendor)) {
      return true;
    }

    if (AMOUNT_LIKE_VENDOR_PATTERN.test(vendor)) {
      return true;
    }

    if (EMAIL_LIKE_VENDOR_PATTERN.test(vendor)) {
      return true;
    }

    return false;
  }
}
