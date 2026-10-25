import type { Mock } from 'vitest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Receipt,
  ReceiptJobStatus,
  ReceiptProcessingJob,
  ReceiptSource,
  ReceiptStatus,
} from '../../../../src/entities';
import { UniversalExtractorService } from '../../../../src/modules/parsing/services/universal-extractor.service';
import { ReceiptProcessorService } from '../../../../src/modules/receipts/services/receipt-processor.service';
import { ReceiptCategoryService } from '../../../../src/modules/receipts/services/receipt-category.service';
import { ReceiptDuplicateService } from '../../../../src/modules/receipts/services/receipt-duplicate.service';
import { ReceiptLocationService } from '../../../../src/modules/receipts/services/receipt-location.service';

const mockReadFile = vi.fn().mockResolvedValue(Buffer.from('receipt-binary'));

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const mockReadExifGps = vi.fn();

vi.mock('../../../../src/common/utils/exif-gps.util', () => ({
  readExifGps: (...args: unknown[]) => mockReadExifGps(...args),
}));

const minimalParse = {
  totalAmount: 10,
  currency: 'KZT',
  vendor: 'Magnum',
  confidence: 0.8,
  extractionMethod: 'ocr_hybrid',
  validationIssues: [],
  transactionType: 'expense',
  fieldConfidence: {},
  documentType: 'receipt',
  rawText: 'raw',
  lineItems: [],
};

const eventEmitter = { emit: vi.fn() };

describe('ReceiptProcessorService', () => {
  let service: ReceiptProcessorService;
  let receiptRepository: { findOne: Mock; save: Mock };
  let jobRepository: { save: Mock };
  let extractor: { extractFromImage: Mock; extractFromPdf: Mock };
  let locationService: { applyAutoLocation: Mock };

  beforeEach(async () => {
    receiptRepository = {
      findOne: vi.fn(),
      save: vi.fn().mockImplementation(async payload => payload),
    };
    jobRepository = {
      save: vi.fn().mockResolvedValue(undefined),
    };
    extractor = {
      extractFromImage: vi.fn(),
      extractFromPdf: vi.fn(),
    };
    locationService = { applyAutoLocation: vi.fn().mockResolvedValue(undefined) };
    eventEmitter.emit.mockReset();
    mockReadExifGps.mockReset().mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptProcessorService,
        { provide: getRepositoryToken(Receipt), useValue: receiptRepository },
        { provide: getRepositoryToken(ReceiptProcessingJob), useValue: jobRepository },
        { provide: UniversalExtractorService, useValue: extractor },
        {
          provide: ReceiptDuplicateService,
          useValue: { findPotentialDuplicates: vi.fn().mockResolvedValue([]) },
        },
        {
          provide: ReceiptCategoryService,
          useValue: { categorize: vi.fn().mockResolvedValue(null) },
        },
        { provide: ReceiptLocationService, useValue: locationService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(ReceiptProcessorService);
  });

  it('processes image receipt and stores parsed data', async () => {
    const receipt = {
      id: 'receipt-1',
      source: ReceiptSource.UPLOAD,
      status: ReceiptStatus.NEW,
      subject: 'receipt.jpg',
      language: 'eng',
      attachmentPaths: ['/tmp/receipt.jpg'],
      metadata: { attachments: [{ mimeType: 'image/jpeg' }] },
      parsedData: null,
    } as unknown as Receipt;
    const job = {
      id: 'job-1',
      userId: 'user-1',
      receiptId: 'receipt-1',
      status: ReceiptJobStatus.PENDING,
      progress: 0,
      payload: { integrationId: 'manual-upload', messageId: 'receipt-1', historyId: 'eng' },
    } as ReceiptProcessingJob;

    receiptRepository.findOne.mockResolvedValue(receipt);
    extractor.extractFromImage.mockResolvedValue({
      totalAmount: 42.5,
      currency: 'EUR',
      vendor: 'Lidl',
      merchantAddress: 'Hauptstraße 5, Berlin',
      date: new Date('2026-03-20'),
      tax: 3.5,
      lineItems: [{ description: 'Milk', amount: 2.5 }],
      confidence: 0.86,
      extractionMethod: 'ocr_hybrid',
      validationIssues: [],
      transactionType: 'expense',
      fieldConfidence: {},
      documentType: 'receipt',
      rawText: 'raw',
    });

    await service.processReceipt(job);

    expect(extractor.extractFromImage).toHaveBeenCalledWith(
      expect.any(Buffer),
      'image/jpeg',
      expect.objectContaining({ fileNameHint: 'receipt.jpg', ocrLanguages: ['eng'] }),
    );
    expect(receiptRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ReceiptStatus.DRAFT,
        parsedData: expect.objectContaining({
          amount: 42.5,
          currency: 'EUR',
          vendor: 'Lidl',
          merchantAddress: 'Hauptstraße 5, Berlin',
        }),
        extractionMethod: 'ocr_hybrid',
        confidence: 0.86,
      }),
    );
    expect(locationService.applyAutoLocation).toHaveBeenCalledWith(receipt);
    expect(locationService.applyAutoLocation.mock.invocationCallOrder[0]).toBeLessThan(
      receiptRepository.save.mock.invocationCallOrder[0],
    );
    expect(job.status).toBe(ReceiptJobStatus.COMPLETED);
    // A readable receipt with no duplicate needs nobody: no review event.
    expect(eventEmitter.emit).not.toHaveBeenCalledWith('receipt.needs_review', expect.anything());
  });

  it('marks receipt as needs_review when amount is missing', async () => {
    const receipt = {
      id: 'receipt-2',
      source: ReceiptSource.SCAN,
      status: ReceiptStatus.NEW,
      subject: 'scan.jpg',
      language: 'auto',
      attachmentPaths: ['/tmp/scan.jpg'],
      metadata: { attachments: [{ mimeType: 'image/jpeg' }] },
      parsedData: null,
    } as unknown as Receipt;
    const job = {
      id: 'job-2',
      userId: 'user-1',
      receiptId: 'receipt-2',
      status: ReceiptJobStatus.PENDING,
      progress: 0,
      payload: { integrationId: 'manual-scan', messageId: 'receipt-2', historyId: 'auto' },
    } as ReceiptProcessingJob;

    receiptRepository.findOne.mockResolvedValue(receipt);
    extractor.extractFromImage.mockResolvedValue({
      totalAmount: undefined,
      currency: 'USD',
      vendor: 'Unknown',
      confidence: 0.3,
      extractionMethod: 'ocr_regex',
      validationIssues: ['missing_amount'],
      transactionType: 'expense',
      fieldConfidence: {},
      documentType: 'receipt',
      rawText: 'raw',
      lineItems: [],
    });

    await service.processReceipt(job);

    expect(receiptRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ReceiptStatus.NEEDS_REVIEW,
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'receipt.needs_review',
      expect.objectContaining({ receiptId: 'receipt-2', reasons: ['missing_amount'] }),
    );
  });

  it('records the photo GPS tag as the capture location, replacing the device point', async () => {
    const receipt = {
      id: 'receipt-3',
      source: ReceiptSource.SCAN,
      status: ReceiptStatus.NEW,
      subject: 'scan.jpg',
      language: null,
      attachmentPaths: ['/tmp/scan.jpg'],
      metadata: {
        attachments: [{ mimeType: 'image/jpeg' }],
        captureLocation: { lat: 1, lng: 2, source: 'device', capturedAt: '2026-09-13' },
      },
      parsedData: null,
    } as unknown as Receipt;
    const job = {
      id: 'job-3',
      userId: 'user-1',
      receiptId: 'receipt-3',
      status: ReceiptJobStatus.PENDING,
      progress: 0,
      payload: { integrationId: 'manual-scan', messageId: 'receipt-3', historyId: 'auto' },
    } as ReceiptProcessingJob;

    receiptRepository.findOne.mockResolvedValue(receipt);
    extractor.extractFromImage.mockResolvedValue(minimalParse);
    mockReadExifGps.mockResolvedValue({ lat: 43.2383, lng: 76.9453 });

    await service.processReceipt(job);

    expect(receipt.metadata.captureLocation).toMatchObject({
      lat: 43.2383,
      lng: 76.9453,
      source: 'exif',
    });
    expect(receipt.metadata.attachments).toHaveLength(1);
  });

  it('does not look for EXIF data in PDFs but still resolves a location', async () => {
    const receipt = {
      id: 'receipt-4',
      source: ReceiptSource.UPLOAD,
      status: ReceiptStatus.NEW,
      subject: 'receipt.pdf',
      language: null,
      attachmentPaths: ['/tmp/receipt.pdf'],
      metadata: { attachments: [{ mimeType: 'application/pdf' }] },
      parsedData: null,
    } as unknown as Receipt;
    const job = {
      id: 'job-4',
      userId: 'user-1',
      receiptId: 'receipt-4',
      status: ReceiptJobStatus.PENDING,
      progress: 0,
      payload: { integrationId: 'manual-upload', messageId: 'receipt-4', historyId: 'auto' },
    } as ReceiptProcessingJob;

    receiptRepository.findOne.mockResolvedValue(receipt);
    extractor.extractFromPdf.mockResolvedValue(minimalParse);

    await service.processReceipt(job);

    expect(mockReadExifGps).not.toHaveBeenCalled();
    expect(locationService.applyAutoLocation).toHaveBeenCalledWith(receipt);
  });
});
