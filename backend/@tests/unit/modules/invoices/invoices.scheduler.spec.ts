import { InvoiceLineItem } from '@/entities/invoice-line-item.entity';
import { Invoice, InvoiceRecurrenceInterval } from '@/entities/invoice.entity';
import { InvoicesScheduler } from '@/modules/invoices/invoices.scheduler';
import { InvoicesService } from '@/modules/invoices/invoices.service';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

function createRepositoryMock<T extends object>() {
  return {
    find: jest.fn(async () => []),
    update: jest.fn(),
  } as unknown as Repository<T> & Record<string, jest.Mock>;
}

describe('InvoicesScheduler', () => {
  let testingModule: TestingModule;
  let scheduler: InvoicesScheduler;
  let invoiceRepository: Record<string, jest.Mock>;
  let lineItemRepository: Record<string, jest.Mock>;
  let invoicesService: { cloneAsDraft: jest.Mock };

  const template = {
    id: 'template-1',
    workspaceId: 'workspace-1',
    clientId: 'client-1',
    issueDate: '2026-08-26',
    dueDate: '2026-09-09',
    currency: 'EUR',
    notes: null,
    isRecurring: true,
    recurrenceInterval: InvoiceRecurrenceInterval.MONTHLY,
    nextIssueDate: '2026-09-26',
    recurrenceEndDate: null,
  } as Invoice;

  beforeAll(async () => {
    invoiceRepository = createRepositoryMock<Invoice>() as unknown as Record<string, jest.Mock>;
    lineItemRepository = createRepositoryMock<InvoiceLineItem>() as unknown as Record<
      string,
      jest.Mock
    >;

    testingModule = await Test.createTestingModule({
      providers: [
        InvoicesScheduler,
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepository },
        { provide: getRepositoryToken(InvoiceLineItem), useValue: lineItemRepository },
        { provide: InvoicesService, useValue: { cloneAsDraft: jest.fn() } },
      ],
    }).compile();

    scheduler = testingModule.get(InvoicesScheduler);
    invoicesService = testingModule.get(InvoicesService);
  });

  const lineItems = [
    { id: 'li-1', invoiceId: 'template-1', description: 'Retainer', quantity: 1, unitPrice: 500 },
  ] as InvoiceLineItem[];

  beforeEach(() => {
    jest.clearAllMocks();
    invoiceRepository.find.mockResolvedValue([template]);
    lineItemRepository.find.mockResolvedValue(lineItems);
    invoicesService.cloneAsDraft.mockResolvedValue({ id: 'copy-1' } as Invoice);
  });

  it('clones a due template and advances its next issue date by one interval', async () => {
    await scheduler.generateRecurringInvoices();

    expect(invoicesService.cloneAsDraft).toHaveBeenCalledWith(template, lineItems);
    expect(invoiceRepository.update).toHaveBeenCalledWith(
      { id: 'template-1' },
      { nextIssueDate: '2026-10-26' },
    );
  });

  it('skips a template whose recurrence has already ended', async () => {
    invoiceRepository.find.mockResolvedValue([{ ...template, recurrenceEndDate: '2026-09-01' }]);

    await scheduler.generateRecurringInvoices();

    expect(invoicesService.cloneAsDraft).not.toHaveBeenCalled();
    expect(invoiceRepository.update).not.toHaveBeenCalled();
  });

  it('skips a template with no line items, without advancing it', async () => {
    lineItemRepository.find.mockResolvedValue([]);

    await scheduler.generateRecurringInvoices();

    expect(invoicesService.cloneAsDraft).not.toHaveBeenCalled();
    expect(invoiceRepository.update).not.toHaveBeenCalled();
  });

  it('logs and continues when cloning one template fails', async () => {
    invoicesService.cloneAsDraft.mockRejectedValue(new Error('boom'));

    await expect(scheduler.generateRecurringInvoices()).resolves.toBeUndefined();
  });
});
