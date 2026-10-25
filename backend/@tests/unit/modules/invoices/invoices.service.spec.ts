import type { Mock } from 'vitest';
import { Client } from '@/entities/client.entity';
import { InvoiceLineItem } from '@/entities/invoice-line-item.entity';
import { Invoice, InvoiceStatus } from '@/entities/invoice.entity';
import { JournalEntry, JournalEntryStatus } from '@/entities/journal-entry.entity';
import { JournalLine } from '@/entities/journal-line.entity';
import { Payable, PayableStatus } from '@/entities/payable.entity';
import { TaxRate } from '@/entities/tax-rate.entity';
import { LedgerPostingError, LedgerPostingService } from '@/modules/ledger/ledger-posting.service';
import { InvoiceXRechnungService } from '@/modules/invoices/invoice-xrechnung.service';
import { InvoicesService } from '@/modules/invoices/invoices.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { workspaceCurrencyProvider } from '../../../helpers/workspace-currency-stub';
import { BusinessProfileService } from '@/modules/business-profile/business-profile.service';
import { InvoiceSettingsService } from '@/modules/invoices/invoice-settings.service';

vi.mock('@/modules/invoices/invoice-document', () => ({
  buildInvoicePdf: vi.fn(async () => Buffer.from('pdf')),
}));

function createRepositoryMock<T extends object>() {
  return {
    create: vi.fn((data: Partial<T>) => data as T),
    save: vi.fn(async (data: Partial<T>) => data as T),
    find: vi.fn(async () => []),
    findOne: vi.fn(),
    findOneOrFail: vi.fn(),
    findBy: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    exists: vi.fn(async () => true),
    delete: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    softRemove: vi.fn(async (data: Partial<T>) => data as T),
  } as unknown as Repository<T> & Record<string, Mock>;
}

/** Routes `manager.getRepository(Entity)` to the same mocks the service was built with. */
function createManagerMock(repos: Map<Function, Record<string, Mock>>, queryImpl: Mock) {
  return {
    getRepository: (entity: Function) => {
      const repo = repos.get(entity);
      if (!repo) {
        throw new Error(`No mock repository registered for ${entity.name}`);
      }
      return repo;
    },
    query: queryImpl,
  };
}

describe('InvoicesService', () => {
  let testingModule: TestingModule;
  let service: InvoicesService;
  let invoiceRepository: Record<string, Mock>;
  let lineItemRepository: Record<string, Mock>;
  let clientRepository: Record<string, Mock>;
  let payableRepository: Record<string, Mock>;
  let taxRateRepository: Record<string, Mock>;
  let journalEntryRepository: Record<string, Mock>;
  let journalLineRepository: Record<string, Mock>;
  let ledgerPostingService: { postInvoice: Mock; reverseWithin: Mock };
  let queryMock: Mock;

  const clientEntity = {
    id: 'client-1',
    workspaceId: 'workspace-1',
    name: 'Acme LLC',
  } as Client;

  beforeAll(async () => {
    invoiceRepository = createRepositoryMock<Invoice>() as unknown as Record<string, Mock>;
    lineItemRepository = createRepositoryMock<InvoiceLineItem>() as unknown as Record<
      string,
      Mock
    >;
    clientRepository = createRepositoryMock<Client>() as unknown as Record<string, Mock>;
    payableRepository = createRepositoryMock<Payable>() as unknown as Record<string, Mock>;
    taxRateRepository = createRepositoryMock<TaxRate>() as unknown as Record<string, Mock>;
    journalEntryRepository = createRepositoryMock<JournalEntry>() as unknown as Record<
      string,
      Mock
    >;
    journalLineRepository = createRepositoryMock<JournalLine>() as unknown as Record<
      string,
      Mock
    >;
    queryMock = vi.fn();

    const repos = new Map<Function, Record<string, Mock>>([
      [Invoice, invoiceRepository],
      [InvoiceLineItem, lineItemRepository],
      [Client, clientRepository],
      [Payable, payableRepository],
      [TaxRate, taxRateRepository],
      [JournalEntry, journalEntryRepository],
      [JournalLine, journalLineRepository],
    ]);
    (invoiceRepository as any).manager = {
      transaction: vi.fn(async (work: (manager: unknown) => Promise<unknown>) =>
        work(createManagerMock(repos, queryMock)),
      ),
      getRepository: createManagerMock(repos, queryMock).getRepository,
      query: queryMock,
    };

    testingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        workspaceCurrencyProvider(),
        {
          provide: InvoiceSettingsService,
          useValue: { get: vi.fn(async () => ({ paymentTermsDays: 14, lateFeePercent: 0 })) },
        },
        {
          provide: BusinessProfileService,
          useValue: {
            get: vi.fn(async () => ({ legalName: 'Us', addressLines: 'Somewhere' })),
            missingRequiredFields: vi.fn(() => []),
            logoDataUri: vi.fn(async () => null),
          },
        },
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepository },
        { provide: getRepositoryToken(Client), useValue: clientRepository },
        { provide: getRepositoryToken(Payable), useValue: payableRepository },
        {
          provide: LedgerPostingService,
          useValue: { postInvoice: vi.fn(), reverseWithin: vi.fn() },
        },
        {
          provide: InvoiceXRechnungService,
          useValue: { invoiceHybridPdf: vi.fn(async (_m: unknown, _i: unknown, pdf: Buffer) => pdf) },
        },
      ],
    }).compile();

    service = testingModule.get(InvoicesService);
    ledgerPostingService = testingModule.get(LedgerPostingService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clientRepository.exists.mockResolvedValue(true);
    clientRepository.findOne.mockResolvedValue(clientEntity);
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('RETURNING')) {
        return [{ prefix: 'INV-', invoice_no: '1' }];
      }
      return [];
    });
  });

  describe('create', () => {
    it('recomputes subtotal, tax and total from the line items', async () => {
      invoiceRepository.create.mockImplementation((data: Partial<Invoice>) => data as Invoice);
      invoiceRepository.save.mockImplementation(async (data: Partial<Invoice>) => ({
        id: 'invoice-1',
        ...data,
      }));
      taxRateRepository.findBy.mockResolvedValue([{ id: 'tax-1', rate: 21 }]);
      taxRateRepository.count.mockResolvedValue(1);
      lineItemRepository.find.mockResolvedValue([
        { quantity: 2, unitPrice: 100, taxRateId: 'tax-1' }, // 200 net, 42 tax
        { quantity: 1, unitPrice: 50, taxRateId: null }, // 50 net, 0 tax
      ]);
      invoiceRepository.findOneOrFail = vi.fn(async () => ({ id: 'invoice-1' }) as Invoice);

      const invoice = await service.create('workspace-1', {
        clientId: 'client-1',
        issueDate: '2026-03-01',
        dueDate: '2026-03-15',
        lineItems: [
          { description: 'Consulting', quantity: 2, unitPrice: 100, taxRateId: 'tax-1' },
          { description: 'Materials', quantity: 1, unitPrice: 50 },
        ],
      } as any);

      expect(invoice.subtotal).toBe(250);
      expect(invoice.taxTotal).toBe(42);
      expect(invoice.total).toBe(292);
    });

    it('refuses a tax rate of another workspace', async () => {
      taxRateRepository.count.mockResolvedValue(0);

      await expect(
        service.create('workspace-1', {
          clientId: 'client-1',
          issueDate: '2026-03-01',
          lineItems: [
            { description: 'Consulting', quantity: 1, unitPrice: 100, taxRateId: 'their-rate' },
          ],
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(taxRateRepository.count).toHaveBeenCalledWith({
        where: { id: expect.anything(), workspaceId: 'workspace-1' },
      });
      expect(invoiceRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('send', () => {
    const draftInvoice = () => ({
      id: 'invoice-1',
      workspaceId: 'workspace-1',
      clientId: 'client-1',
      status: InvoiceStatus.DRAFT,
      issueDate: '2026-03-01',
      dueDate: '2026-03-15',
      currency: 'EUR',
      total: 292,
      subtotal: 250,
      taxTotal: 42,
    } as Invoice);

    beforeEach(() => {
      invoiceRepository.findOne.mockResolvedValue(draftInvoice());
      invoiceRepository.save.mockImplementation(async (data: Partial<Invoice>) => data as Invoice);
      lineItemRepository.find.mockResolvedValue([
        { description: 'Consulting', quantity: 2, unitPrice: 100, taxRateId: null, categoryId: null },
      ]);
      payableRepository.create.mockImplementation((data: Partial<Payable>) => data as Payable);
      payableRepository.save.mockResolvedValue({ id: 'payable-1' } as Payable);
      ledgerPostingService.postInvoice.mockResolvedValue({ id: 'entry-1' } as JournalEntry);
    });

    it('assigns a number, books the ledger entry and opens the receivable', async () => {
      const invoice = await service.send('invoice-1', 'workspace-1', 'user-1');

      expect(invoice.invoiceNumber).toBe('INV-1');
      expect(invoice.journalEntryId).toBe('entry-1');
      expect(invoice.payableId).toBe('payable-1');
      expect(invoice.status).toBe(InvoiceStatus.SENT);
      expect(ledgerPostingService.postInvoice).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ workspaceId: 'workspace-1', currency: 'EUR' }),
      );
    });

    it('still opens the receivable when the workspace has not enabled the ledger', async () => {
      ledgerPostingService.postInvoice.mockRejectedValue(
        new LedgerPostingError('LEDGER_DISABLED', 'off'),
      );

      const invoice = await service.send('invoice-1', 'workspace-1', 'user-1');

      expect(invoice.journalEntryId).toBeUndefined();
      expect(invoice.payableId).toBe('payable-1');
      expect(invoice.status).toBe(InvoiceStatus.SENT);
    });

    it('refuses a real posting failure instead of silently skipping it', async () => {
      ledgerPostingService.postInvoice.mockRejectedValue(
        new LedgerPostingError('FX_RATE_MISSING', 'no rate'),
      );

      await expect(service.send('invoice-1', 'workspace-1', 'user-1')).rejects.toMatchObject({
        code: 'FX_RATE_MISSING',
      });
    });

    it('refuses to send an invoice with no line items', async () => {
      lineItemRepository.find.mockResolvedValue([]);

      await expect(service.send('invoice-1', 'workspace-1', 'user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuses to send an invoice twice', async () => {
      invoiceRepository.findOne.mockResolvedValue({
        ...draftInvoice(),
        status: InvoiceStatus.SENT,
      });

      await expect(service.send('invoice-1', 'workspace-1', 'user-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('void', () => {
    it('reverses the posted journal entry and archives the receivable', async () => {
      invoiceRepository.findOne.mockResolvedValue({
        id: 'invoice-1',
        workspaceId: 'workspace-1',
        status: InvoiceStatus.SENT,
        journalEntryId: 'entry-1',
        payableId: 'payable-1',
      } as Invoice);
      invoiceRepository.save.mockImplementation(async (data: Partial<Invoice>) => data as Invoice);
      journalEntryRepository.findOne.mockResolvedValue({
        id: 'entry-1',
        status: JournalEntryStatus.POSTED,
        reversalOfId: null,
      } as unknown as JournalEntry);
      journalLineRepository.find.mockResolvedValue([]);

      const invoice = await service.void('invoice-1', 'workspace-1', 'user-1');

      expect(ledgerPostingService.reverseWithin).toHaveBeenCalled();
      expect(payableRepository.update).toHaveBeenCalledWith(
        { id: 'payable-1' },
        { status: PayableStatus.ARCHIVED },
      );
      expect(invoice.status).toBe(InvoiceStatus.VOID);
    });

    it('refuses to void an invoice whose receivable is paid', async () => {
      // The invoice row says 'sent' — it always does, 'paid' lives on the
      // receivable — so the guard has to read the receivable to see it.
      invoiceRepository.findOne.mockResolvedValue({
        id: 'invoice-1',
        workspaceId: 'workspace-1',
        status: InvoiceStatus.SENT,
        payableId: 'payable-1',
      } as Invoice);
      payableRepository.findOne.mockResolvedValue({ status: PayableStatus.PAID } as Payable);

      await expect(service.void('invoice-1', 'workspace-1', 'user-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(payableRepository.update).not.toHaveBeenCalled();
    });
  });
});
