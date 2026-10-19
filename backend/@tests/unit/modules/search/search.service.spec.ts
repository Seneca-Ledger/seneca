import { PayableDirection } from '@/entities/payable.entity';
import { ReceiptSource } from '@/entities/receipt.entity';
import { SearchService } from '@/modules/search/search.service';

const createQueryBuilderMock = (rows: unknown[]) => ({
  innerJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(rows),
});

const createRepoMock = (rows: unknown[] = []) =>
  ({
    createQueryBuilder: jest.fn(() => createQueryBuilderMock(rows)),
    find: jest.fn().mockResolvedValue(rows),
  }) as any;

const scanDetails = { detectedBy: 'receipt-scan' };

describe('SearchService', () => {
  it('ignores queries shorter than two characters without touching the database', async () => {
    const transactionRepo = createRepoMock();
    const service = new SearchService(
      transactionRepo,
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
    );

    const result = await service.search('ws-1', ' a ');

    expect(result.results).toEqual([]);
    expect(transactionRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('labels receivables separately from payables and routes them to their own page', async () => {
    const payableRepo = createRepoMock([
      { id: 'p-1', vendor: 'Owes Us Ltd', comment: null, direction: PayableDirection.RECEIVABLE },
      { id: 'p-2', vendor: 'We Owe Ltd', comment: null, direction: PayableDirection.PAYABLE },
    ]);
    const service = new SearchService(
      createRepoMock(),
      createRepoMock(),
      payableRepo,
      createRepoMock(),
      createRepoMock(),
    );

    const result = await service.search('ws-1', 'ltd');

    expect(result.results).toEqual([
      {
        kind: 'receivable',
        id: 'p-1',
        title: 'Owes Us Ltd',
        subtitle: null,
        href: '/statements/receive',
      },
      {
        kind: 'payable',
        id: 'p-2',
        title: 'We Owe Ltd',
        subtitle: null,
        href: '/statements/pay',
      },
    ]);
  });

  it('opens a found transaction in the document it came from', async () => {
    const transactionRepo = createRepoMock([
      {
        id: 't-1',
        statementId: 's-9',
        statement: { id: 's-9', status: 'completed', parsingDetails: null },
        counterpartyName: 'Lidl',
        paymentPurpose: 'Groceries',
      },
    ]);
    const service = new SearchService(
      transactionRepo,
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
    );

    const result = await service.search('ws-1', 'lidl');

    expect(result.results).toEqual([
      {
        kind: 'transaction',
        id: 't-1',
        title: 'Lidl',
        subtitle: 'Groceries',
        href: '/statements/s-9/edit',
      },
    ]);
  });

  it('returns the five latest uploads of the workspace, newest first', async () => {
    const builder = createQueryBuilderMock([
      { id: 's-1', fileName: 'receipt-scan.jpg', bankName: null, status: 'uploaded' },
      { id: 's-2', fileName: 'march.pdf', bankName: 'Kaspi', status: 'parsed' },
    ]);
    const statementRepo = { createQueryBuilder: jest.fn(() => builder) } as any;
    const transactionRepo = createRepoMock();
    const service = new SearchService(
      transactionRepo,
      statementRepo,
      createRepoMock(),
      createRepoMock(),
      createRepoMock(),
    );

    const result = await service.recent('ws-1');

    expect(builder.where).toHaveBeenCalledWith('s.workspaceId = :workspaceId', {
      workspaceId: 'ws-1',
    });
    expect(builder.andWhere).toHaveBeenCalledWith('s.deletedAt IS NULL');
    expect(builder.orderBy).toHaveBeenCalledWith('s.createdAt', 'DESC');
    expect(builder.take).toHaveBeenCalledWith(5);
    expect(transactionRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(result).toEqual({
      query: '',
      results: [
        {
          kind: 'statement',
          id: 's-1',
          title: 'receipt-scan.jpg',
          subtitle: null,
          href: '/storage/s-1',
        },
        {
          kind: 'statement',
          id: 's-2',
          title: 'march.pdf',
          subtitle: 'Kaspi',
          href: '/statements/s-2/edit',
        },
      ],
    });
  });

  it('opens a scan on its receipt, as the Documents list does, not on its hidden statement', async () => {
    const statementRepo = createRepoMock([
      { id: 's-scan', fileName: 'other', status: 'completed', parsingDetails: scanDetails },
      { id: 's-mail', fileName: 'mail', status: 'completed', parsingDetails: scanDetails },
      { id: 's-bank', fileName: 'other bank', status: 'completed', parsingDetails: null },
    ]);
    const receiptRepo = createRepoMock([
      { id: 'r-1', statementId: 's-scan', source: ReceiptSource.SCAN },
      { id: 'r-2', statementId: 's-mail', source: ReceiptSource.GMAIL },
    ]);
    const service = new SearchService(
      createRepoMock(),
      statementRepo,
      createRepoMock(),
      createRepoMock(),
      receiptRepo,
    );

    const result = await service.search('ws-1', 'other');

    expect(result.results.map(item => item.href)).toEqual([
      '/storage/receipts/r-1',
      '/storage/gmail-receipts/r-2',
      '/statements/s-bank/edit',
    ]);
    // Only scans are looked up, and only inside the workspace.
    expect(receiptRepo.find).toHaveBeenCalledTimes(1);
    const { where } = receiptRepo.find.mock.calls[0][0];
    expect(where.workspaceId).toBe('ws-1');
    expect(where.statementId.value).toEqual(['s-scan', 's-mail']);
  });

  it('skips the receipt lookup when nothing found is a scan', async () => {
    const receiptRepo = createRepoMock();
    const service = new SearchService(
      createRepoMock(),
      createRepoMock([{ id: 's-1', fileName: 'march.pdf', status: 'parsed', parsingDetails: {} }]),
      createRepoMock(),
      createRepoMock(),
      receiptRepo,
    );

    await service.search('ws-1', 'march');

    expect(receiptRepo.find).not.toHaveBeenCalled();
  });
});
