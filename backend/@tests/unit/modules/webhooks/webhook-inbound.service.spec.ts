import type { Mock } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { removeUploadedFile, validateFiles } from '../../../../src/common/utils/file-validator.util';
import { WebhookInboundService } from '../../../../src/modules/webhooks/webhook-inbound.service';

// Base64 uploads are written to the uploads directory; keep them out of the real one.
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inbound-spec-'));
const previousUploadsDir = process.env.UPLOADS_DIR;
process.env.UPLOADS_DIR = uploadsDir;

vi.mock('../../../../src/common/utils/file-validator.util', () => ({
  validateFiles: vi.fn(),
  removeUploadedFile: vi.fn(),
}));

const endpoint = {
  id: 'ep-1',
  workspaceId: 'ws-1',
  defaultWalletId: 'wallet-default',
  defaultBranchId: null,
} as any;
const owner = { id: 'user-1' };
const multipartFile = { path: '/uploads/abc.pdf', originalname: 'a.pdf' } as any;

describe('WebhookInboundService', () => {
  const memberRepo = { findOne: vi.fn() };
  const statementsService = { create: vi.fn() };
  const receiptsService = { createFromUpload: vi.fn() };
  const service = new WebhookInboundService(
    memberRepo as any,
    statementsService as any,
    receiptsService as any,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    memberRepo.findOne.mockResolvedValue({ user: owner });
    (validateFiles as Mock).mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env.UPLOADS_DIR = previousUploadsDir;
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  describe('uploadStatement', () => {
    it('validates the file and keeps it once the statement is created', async () => {
      statementsService.create.mockResolvedValue({ id: 'st-1', status: 'uploaded' });

      await service.uploadStatement(endpoint, multipartFile, {});

      expect(validateFiles).toHaveBeenCalledWith([multipartFile]);
      expect(statementsService.create).toHaveBeenCalledWith(
        owner,
        'ws-1',
        multipartFile,
        'wallet-default',
        undefined,
        true,
      );
      expect(removeUploadedFile).not.toHaveBeenCalled();
    });

    it('keeps a base64 upload on disk: the statement points at it', async () => {
      statementsService.create.mockResolvedValue({ id: 'st-1', status: 'uploaded' });
      const content = 'OFXHEADER:100\nDATA:OFXSGML\n<OFX></OFX>';

      await service.uploadStatement(endpoint, null, {
        fileBase64: Buffer.from(content).toString('base64'),
        fileName: 'bank.ofx',
      });

      const file = statementsService.create.mock.calls[0][2];
      expect(file.mimetype).toBe('application/x-ofx');
      expect(fs.readFileSync(file.path, 'utf8')).toBe(content);
      expect(removeUploadedFile).not.toHaveBeenCalled();
    });

    it('removes the file when the statement is refused', async () => {
      statementsService.create.mockRejectedValue(new ConflictException('duplicate'));

      await expect(service.uploadStatement(endpoint, multipartFile, {})).rejects.toThrow(
        ConflictException,
      );
      expect(removeUploadedFile).toHaveBeenCalledWith(multipartFile);
    });

    it('never creates a statement from a file that fails validation', async () => {
      (validateFiles as Mock).mockRejectedValue(new BadRequestException('bad type'));

      await expect(service.uploadStatement(endpoint, multipartFile, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(statementsService.create).not.toHaveBeenCalled();
    });

    it('asks for a file when neither multipart nor base64 is sent', async () => {
      await expect(service.uploadStatement(endpoint, null, {})).rejects.toThrow(
        'No file provided',
      );
    });
  });

  describe('uploadReceipt', () => {
    it('keeps the file once the receipt is created', async () => {
      receiptsService.createFromUpload.mockResolvedValue({ id: 'r-1', status: 'parsed' });

      await service.uploadReceipt(endpoint, multipartFile, { language: 'en' });

      expect(receiptsService.createFromUpload).toHaveBeenCalledWith({
        userId: 'user-1',
        workspaceId: 'ws-1',
        files: [multipartFile],
        language: 'en',
      });
      expect(removeUploadedFile).not.toHaveBeenCalled();
    });

    it('removes the file when the receipt is refused', async () => {
      receiptsService.createFromUpload.mockRejectedValue(new Error('parse failed'));

      await expect(service.uploadReceipt(endpoint, multipartFile, {})).rejects.toThrow(
        'parse failed',
      );
      expect(removeUploadedFile).toHaveBeenCalledWith(multipartFile);
    });
  });
});
