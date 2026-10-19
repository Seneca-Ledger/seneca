import {
  Integration,
  Receipt,
  ReceiptJobStatus,
  ReceiptProcessingJob,
  ReceiptStatus,
} from '../../../../src/entities';
import { GmailReceiptProcessor } from '../../../../src/modules/gmail/gmail-receipt-processor';

describe('GmailReceiptProcessor', () => {
  it('marks receipt as needs_review when parser cannot extract amount', async () => {
    const jobRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    const receiptRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(payload => payload),
      save: jest
        .fn()
        .mockImplementation(async payload =>
          payload.id ? payload : { ...payload, id: 'receipt-1' },
        ),
    };

    const integrationRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'integration-1',
        workspaceId: 'workspace-1',
        connectedByUserId: 'user-1',
      } as Integration),
    };

    const gmailService = {
      getMessage: jest.fn().mockResolvedValue({
        threadId: 'thread-1',
        labelIds: ['INBOX'],
        snippet: 'snippet',
        payload: {
          headers: [
            { name: 'Subject', value: 'Receipt' },
            { name: 'From', value: 'PayU <noreply@payu.com>' },
            { name: 'Date', value: 'Thu, 01 Jan 2026 10:00:00 +0000' },
          ],
          parts: [
            {
              filename: 'receipt.pdf',
              mimeType: 'application/pdf',
              body: { attachmentId: 'att-1', size: 1234 },
            },
          ],
        },
      }),
      downloadAttachment: jest.fn().mockResolvedValue('/tmp/receipt.pdf'),
    };

    const parserService = {
      parseReceipt: jest.fn().mockResolvedValue({
        vendor: 'PayU',
        confidence: 0.5,
      }),
    };

    const duplicateService = {
      findPotentialDuplicates: jest.fn().mockResolvedValue([]),
    };

    const categoryService = {
      suggestCategory: jest.fn().mockResolvedValue(null),
    };

    const auditService = {
      createEvent: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new GmailReceiptProcessor(
      jobRepository as any,
      receiptRepository as any,
      integrationRepository as any,
      gmailService as any,
      parserService as any,
      duplicateService as any,
      categoryService as any,
      auditService as any,
    );

    const job: ReceiptProcessingJob = {
      id: 'job-1',
      userId: 'user-1',
      receiptId: null,
      status: ReceiptJobStatus.PROCESSING,
      progress: 0,
      payload: {
        integrationId: 'integration-1',
        gmailMessageId: 'gmail-message-1',
      },
      result: null,
      error: null,
      lockedAt: new Date(),
      lockedBy: 'worker-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await (processor as any).processJob(job);

    const savedReceipt = receiptRepository.save.mock.calls[1][0] as Receipt;
    expect(savedReceipt.status).toBe(ReceiptStatus.NEEDS_REVIEW);
    expect((savedReceipt.parsedData as any)?.validationIssues).toEqual(['missing_amount']);
    expect(duplicateService.findPotentialDuplicates).not.toHaveBeenCalled();
    expect(job.status).toBe(ReceiptJobStatus.COMPLETED);

    // The mailbox and the dedupe are the integration's workspace, not the job's user.
    expect(receiptRepository.findOne).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1', gmailMessageId: 'gmail-message-1' },
    });
    expect(gmailService.getMessage).toHaveBeenCalledWith('workspace-1', 'gmail-message-1');
    expect(gmailService.downloadAttachment).toHaveBeenCalledWith(
      'workspace-1',
      'gmail-message-1',
      'att-1',
      'receipt.pdf',
    );
    expect(savedReceipt.workspaceId).toBe('workspace-1');
  });

  it('extracts email body preferring html part', () => {
    const processor = new GmailReceiptProcessor(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        {
          mimeType: 'text/plain',
          body: {
            data: Buffer.from('Thanks for paying GitHub').toString('base64url'),
          },
        },
        {
          mimeType: 'text/html',
          body: {
            data: Buffer.from('<p>Thanks for paying GitHub</p>').toString('base64url'),
          },
        },
      ],
    };

    const body = (processor as any).extractEmailBody(payload);
    expect(body).toContain('GitHub');
    expect(body).toContain('<p>');
  });

  it('returns null when message has no decodable body', () => {
    const processor = new GmailReceiptProcessor(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          filename: 'receipt.pdf',
          mimeType: 'application/pdf',
          body: { attachmentId: 'att-1', size: 1234 },
        },
      ],
    };

    const body = (processor as any).extractEmailBody(payload);
    expect(body).toBeNull();
  });

  it('parses merchant from email body when receipt has no attachments', async () => {
    const jobRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    const receiptRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(payload => payload),
      save: jest
        .fn()
        .mockImplementation(async payload =>
          payload.id ? payload : { ...payload, id: 'receipt-1' },
        ),
    };

    const integrationRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'integration-1',
        workspaceId: 'workspace-1',
        connectedByUserId: 'user-1',
      } as Integration),
    };

    const gmailService = {
      getMessage: jest.fn().mockResolvedValue({
        threadId: 'thread-1',
        labelIds: ['INBOX'],
        snippet: 'snippet',
        payload: {
          headers: [
            { name: 'Subject', value: 'Receipt' },
            { name: 'From', value: 'GitHub <noreply@github.com>' },
            { name: 'Date', value: 'Thu, 01 Jan 2026 10:00:00 +0000' },
          ],
          parts: [
            {
              mimeType: 'text/html',
              body: {
                data: Buffer.from('<p>Thanks for your GitHub subscription</p>').toString(
                  'base64url',
                ),
              },
            },
          ],
        },
      }),
      downloadAttachment: jest.fn(),
    };

    const parserService = {
      parseReceipt: jest.fn(),
      parseFromEmailOnly: jest.fn().mockResolvedValue({
        amount: 10,
        currency: 'USD',
        vendor: 'GitHub',
      }),
    };

    const duplicateService = {
      findPotentialDuplicates: jest.fn().mockResolvedValue([]),
    };

    const categoryService = {
      suggestCategory: jest.fn().mockResolvedValue(null),
    };

    const auditService = {
      createEvent: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new GmailReceiptProcessor(
      jobRepository as any,
      receiptRepository as any,
      integrationRepository as any,
      gmailService as any,
      parserService as any,
      duplicateService as any,
      categoryService as any,
      auditService as any,
    );

    const job: ReceiptProcessingJob = {
      id: 'job-1',
      userId: 'user-1',
      receiptId: null,
      status: ReceiptJobStatus.PROCESSING,
      progress: 0,
      payload: {
        integrationId: 'integration-1',
        gmailMessageId: 'gmail-message-1',
      },
      result: null,
      error: null,
      lockedAt: new Date(),
      lockedBy: 'worker-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await (processor as any).processJob(job);

    expect(parserService.parseReceipt).not.toHaveBeenCalled();
    expect(parserService.parseFromEmailOnly).toHaveBeenCalledWith({
      sender: 'GitHub <noreply@github.com>',
      subject: 'Receipt',
      dateHeader: 'Thu, 01 Jan 2026 10:00:00 +0000',
      emailBody: '<p>Thanks for your GitHub subscription</p>',
    });

    const savedReceipt = receiptRepository.save.mock.calls[1][0] as Receipt;
    expect(savedReceipt.parsedData?.vendor).toBe('GitHub');
    expect(savedReceipt.status).toBe(ReceiptStatus.DRAFT);
  });
});
