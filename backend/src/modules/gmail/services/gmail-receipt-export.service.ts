import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { In, Repository } from 'typeorm';
import * as xlsx from 'xlsx';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { resolveUploadsDir } from '../../../common/utils/uploads.util';
import { Category, Receipt } from '../../../entities';
import { GmailOAuthService } from './gmail-oauth.service';

type ReceiptRowCell = string | number;
type ReceiptRow = ReceiptRowCell[];

interface ReceiptParsedData {
  date?: string;
  vendor?: string;
  amount?: string | number;
  currency?: string;
  tax?: string | number;
  subtotal?: string | number;
  category?: string;
  confidence?: number;
}

@Injectable()
export class GmailReceiptExportService {
  private readonly logger = new Logger(GmailReceiptExportService.name);

  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(Category)
    categoryRepository: Repository<Category>,
    private readonly gmailOAuthService: GmailOAuthService,
  ) {}

  private getParsedData(receipt: Receipt): ReceiptParsedData {
    return (receipt.parsedData ?? {}) as ReceiptParsedData;
  }

  async exportToXlsx(
    workspaceId: string,
    receiptIds: string[],
  ): Promise<{ fileName: string; url: string }> {
    try {
      // Fetch receipts with parsed data
      const receipts = await this.receiptRepository.find({
        where: {
          id: In(receiptIds),
          workspaceId,
        },
        order: {
          receivedAt: 'DESC',
        },
      });

      if (receipts.length === 0) {
        throw new Error('No receipts found');
      }

      // Prepare header row
      const headers = [
        'Date',
        'Merchant',
        'Amount',
        'Currency',
        'Tax',
        'Subtotal',
        'Category',
        'Status',
        'Gmail Link',
        'Confidence',
      ];

      // Prepare data rows
      const rows: ReceiptRow[] = [headers];
      for (const receipt of receipts) {
        rows.push(this.formatReceiptRow(receipt));
      }

      const fileName = `receipts-${Date.now()}.xlsx`;
      const exportsDir = path.join(resolveUploadsDir(), 'exports');
      await fs.promises.mkdir(exportsDir, { recursive: true });
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.aoa_to_sheet(rows);
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Receipts');
      const filePath = path.join(exportsDir, fileName);
      xlsx.writeFile(workbook, filePath);

      this.logger.log(`Exported ${receipts.length} receipts to ${fileName}`);

      return {
        fileName,
        url: `/uploads/exports/${fileName}`,
      };
    } catch (error) {
      this.logger.error('Failed to export receipts to xlsx', error);
      throw error;
    }
  }

  formatReceiptRow(receipt: Receipt): ReceiptRow {
    const parsedData = this.getParsedData(receipt);
    const gmailLink = `https://mail.google.com/mail/u/0/#all/${receipt.gmailMessageId}`;

    return [
      parsedData.date || receipt.receivedAt.toISOString().split('T')[0],
      parsedData.vendor || receipt.sender,
      parsedData.amount || '',
      parsedData.currency || appDefaultCurrency(),
      parsedData.tax || '',
      parsedData.subtotal || '',
      parsedData.category || '',
      receipt.status,
      gmailLink,
      parsedData.confidence ? `${Math.round(parsedData.confidence * 100)}%` : '',
    ];
  }

  /** Drafted in the mailbox connected to the receipt's workspace. */
  async createGmailDraft(
    workspaceId: string,
    receiptId: string,
  ): Promise<{ draftId: string; url: string }> {
    const receipt = await this.receiptRepository.findOne({
      where: { id: receiptId, workspaceId },
    });

    if (!receipt) {
      throw new Error('Receipt not found');
    }

    const { accessToken, integration } = await this.gmailOAuthService.getGmailClient(workspaceId);

    // Check for compose scope specifically for draft creation
    const scopes = Array.isArray(integration.scopes)
      ? integration.scopes
      : String(integration.scopes || '')
          .split(' ')
          .filter(Boolean);
    if (!scopes.includes('https://www.googleapis.com/auth/gmail.compose')) {
      throw new Error(
        'Gmail integration requires re-authentication to create drafts. Please reconnect Gmail.',
      );
    }
    const parsedData = this.getParsedData(receipt);
    const vendor = parsedData.vendor || receipt.sender || 'Unknown';
    const amount = parsedData.amount ?? '';
    const currency = parsedData.currency || appDefaultCurrency();
    const date = parsedData.date || receipt.receivedAt?.toISOString().split('T')[0] || '';

    const subject = amount
      ? `Receipt: ${vendor} — ${amount} ${currency}`
      : receipt.subject || `Receipt: ${vendor}`;

    const gmailLink = receipt.gmailMessageId
      ? `https://mail.google.com/mail/u/0/#all/${receipt.gmailMessageId}`
      : '';

    const htmlBody = [
      '<h3>Receipt Summary</h3>',
      '<table style="border-collapse:collapse;font-family:sans-serif;">',
      `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Vendor:</td><td>${this.escapeHtml(vendor)}</td></tr>`,
      `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Amount:</td><td>${this.escapeHtml(String(amount))} ${this.escapeHtml(currency)}</td></tr>`,
      `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Date:</td><td>${this.escapeHtml(date)}</td></tr>`,
      parsedData.category
        ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Category:</td><td>${this.escapeHtml(parsedData.category)}</td></tr>`
        : '',
      '</table>',
      gmailLink ? `<p>Original email: <a href="${gmailLink}">View in Gmail</a></p>` : '',
      '<p><em>Exported from Lumio</em></p>',
    ]
      .filter(Boolean)
      .join('\n');

    // Read attachment files
    const attachments: { filename: string; mimeType: string; data: Buffer }[] = [];
    for (const filePath of receipt.attachmentPaths || []) {
      try {
        const data = await fs.promises.readFile(filePath);
        const filename = path.basename(filePath);
        const mimeType = this.inferMimeType(filePath);
        attachments.push({ filename, mimeType, data });
      } catch (error) {
        this.logger.warn(`Could not read attachment at ${filePath}: ${error}`);
      }
    }

    const raw = this.buildMimeMessage(subject, htmlBody, attachments);

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: { raw },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gmail draft creation failed with status ${response.status}`);
    }

    const draft = (await response.json()) as { id?: string; message?: { id?: string } };
    const draftId = draft.id || '';
    const messageId = draft.message?.id || draftId;

    this.logger.log(`Created Gmail draft ${draftId} for receipt ${receiptId}`);

    return {
      draftId,
      url: `https://mail.google.com/mail/#inbox?compose=${messageId}`,
    };
  }

  private buildMimeMessage(
    subject: string,
    htmlBody: string,
    attachments: { filename: string; mimeType: string; data: Buffer }[],
  ): string {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const lines: string[] = [
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      'MIME-Version: 1.0',
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlBody).toString('base64'),
    ];

    for (const att of attachments) {
      lines.push(
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${att.filename}"`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        'Content-Transfer-Encoding: base64',
        '',
        att.data.toString('base64'),
      );
    }

    lines.push(`--${boundary}--`);

    const mimeMessage = lines.join('\r\n');
    return Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private inferMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
