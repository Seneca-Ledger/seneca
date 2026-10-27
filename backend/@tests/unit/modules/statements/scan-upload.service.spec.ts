import { ConflictException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Statement } from '@/entities/statement.entity';
import type { User } from '@/entities/user.entity';
import type { ParserFactoryService } from '@/modules/parsing/services/parser-factory.service';
import type { ReceiptStatementService } from '@/modules/statements/services/receipt-statement.service';
import { ScanUploadService } from '@/modules/statements/services/scan-upload.service';
import type { StatementsService } from '@/modules/statements/statements.service';

const isBankStatementScan = vi.hoisted(() => vi.fn());
vi.mock('@/modules/parsing/helpers/scan-statement.helper', () => ({ isBankStatementScan }));
vi.mock('@/common/utils/file-validator.util', () => ({
  assertReceiptFileSupported: vi.fn(),
  unlinkAll: vi.fn(),
  validateFiles: vi.fn(),
}));

const file = (name: string) =>
  ({ originalname: name, mimetype: 'application/pdf', path: `/uploads/${name}` }) as Express.Multer.File;

describe('ScanUploadService', () => {
  const user = { id: 'user-1' } as User;
  const statementsService = { create: vi.fn() };
  const receiptStatementService = { createFromReceiptScan: vi.fn() };
  const statementRepository = { findOne: vi.fn() };
  const service = new ScanUploadService(
    statementRepository as unknown as Repository<Statement>,
    statementsService as unknown as StatementsService,
    receiptStatementService as unknown as ReceiptStatementService,
    {} as ParserFactoryService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a statement for its transactions and books a receipt, in the order sent', async () => {
    const statement = file('statement.pdf');
    const receipt = file('receipt.pdf');
    isBankStatementScan.mockImplementation(async (f: Express.Multer.File) => f === statement);
    statementsService.create.mockResolvedValue({ id: 'parsed' });
    receiptStatementService.createFromReceiptScan.mockResolvedValue([{ id: 'receipt' }]);

    const result = await service.upload({ user, workspaceId: 'ws-1', files: [receipt, statement] });

    expect(result.map(s => s.id)).toEqual(['receipt', 'parsed']);
    expect(statementsService.create).toHaveBeenCalledWith(user, 'ws-1', statement);
    expect(receiptStatementService.createFromReceiptScan).toHaveBeenCalledWith(
      expect.objectContaining({ files: [receipt], workspaceId: 'ws-1' }),
    );
  });

  it('hands back the statement already filed when the same file comes again', async () => {
    isBankStatementScan.mockResolvedValue(true);
    statementsService.create.mockRejectedValue(
      new ConflictException({ code: 'STATEMENT_DUPLICATE_FILE', duplicateStatementId: 'old' }),
    );
    statementRepository.findOne.mockResolvedValue({ id: 'old' });

    const result = await service.upload({ user, workspaceId: 'ws-1', files: [file('again.pdf')] });

    expect(result.map(s => s.id)).toEqual(['old']);
    expect(statementRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'old', workspaceId: 'ws-1' },
    });
  });

  it('uploads a statement again when its earlier copy is in the trash', async () => {
    const again = file('trashed.pdf');
    isBankStatementScan.mockResolvedValue(true);
    statementsService.create
      .mockRejectedValueOnce(
        new ConflictException({ code: 'STATEMENT_DUPLICATE_FILE', duplicateStatementId: 'gone' }),
      )
      .mockResolvedValueOnce({ id: 'new' });
    statementRepository.findOne
      .mockResolvedValueOnce({ id: 'gone', fileHash: 'hash', deletedAt: new Date() })
      .mockResolvedValueOnce(null);

    const result = await service.upload({ user, workspaceId: 'ws-1', files: [again] });

    expect(result.map(s => s.id)).toEqual(['new']);
    expect(statementsService.create).toHaveBeenLastCalledWith(
      user,
      'ws-1',
      again,
      undefined,
      undefined,
      true,
    );
  });

  it('still refuses any other failure', async () => {
    isBankStatementScan.mockResolvedValue(true);
    statementsService.create.mockRejectedValue(new Error('disk full'));

    await expect(
      service.upload({ user, workspaceId: 'ws-1', files: [file('broken.pdf')] }),
    ).rejects.toThrow('disk full');
  });
});
