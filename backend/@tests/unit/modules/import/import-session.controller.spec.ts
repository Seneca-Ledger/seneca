import { NotFoundException } from '@nestjs/common';
import { StatementStatus } from '@/entities/statement.entity';
import { ImportSessionController } from '@/modules/import/import-session.controller';

describe('ImportSessionController', () => {
  const importSessionService = {
    getSession: jest.fn(),
    getSessionSummary: jest.fn(),
    resolveConflicts: jest.fn(),
    cancelSession: jest.fn(),
  };
  const statementProcessingService = {
    processStatement: jest.fn(),
    commitImport: jest.fn(),
  };
  const statementRepository = {
    findOne: jest.fn(),
  };
  const transactionRepository = {
    count: jest.fn(),
  };

  let controller: ImportSessionController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ImportSessionController(
      importSessionService as any,
      statementProcessingService as any,
      statementRepository as any,
      transactionRepository as any,
    );
  });

  describe('getImportPreview', () => {
    it('returns the recorded preview without touching the processing pipeline', async () => {
      statementRepository.findOne.mockResolvedValue({
        id: 'stmt-1',
        status: StatementStatus.PARSED,
        parsingDetails: { importPreview: { sessionId: 'session-1', transactions: [] } },
      });

      const result = await controller.getImportPreview('stmt-1', 'ws-1');

      expect(result.importPreview).toEqual({ sessionId: 'session-1', transactions: [] });
      expect(statementProcessingService.processStatement).not.toHaveBeenCalled();
    });

    it('returns null and does not trigger parsing when nothing was recorded yet', async () => {
      statementRepository.findOne.mockResolvedValue({
        id: 'stmt-1',
        status: StatementStatus.UPLOADED,
        parsingDetails: null,
      });

      const result = await controller.getImportPreview('stmt-1', 'ws-1');

      expect(result).toEqual({
        statementId: 'stmt-1',
        status: StatementStatus.UPLOADED,
        importPreview: null,
      });
      // A read (STATEMENT_VIEW) endpoint must never itself trigger parsing.
      expect(statementProcessingService.processStatement).not.toHaveBeenCalled();
      expect(transactionRepository.count).not.toHaveBeenCalled();
    });

    it('returns null for an already-completed statement without touching the pipeline', async () => {
      statementRepository.findOne.mockResolvedValue({
        id: 'stmt-1',
        status: StatementStatus.COMPLETED,
        parsingDetails: null,
      });

      const result = await controller.getImportPreview('stmt-1', 'ws-1');

      expect(result.importPreview).toBeNull();
      expect(statementProcessingService.processStatement).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the statement does not exist', async () => {
      statementRepository.findOne.mockResolvedValue(null);

      await expect(controller.getImportPreview('missing', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
