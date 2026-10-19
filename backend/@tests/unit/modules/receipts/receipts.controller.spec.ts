import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../../../src/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../src/common/guards/permissions.guard';
import { WorkspaceContextGuard } from '../../../../src/common/guards/workspace-context.guard';
import { ReceiptsController } from '../../../../src/modules/receipts/receipts.controller';
import { ReceiptsService } from '../../../../src/modules/receipts/receipts.service';
import { ReceiptLocationService } from '../../../../src/modules/receipts/services/receipt-location.service';
import { ReceiptStageService } from '../../../../src/modules/receipts/services/receipt-stage.service';
import { ReceiptMatchService } from '../../../../src/modules/receipts/services/receipt-match.service';
import { ReceiptSplitService } from '../../../../src/modules/receipts/services/receipt-split.service';
import { ReceiptPlaceSuggestionService } from '../../../../src/modules/receipts/services/receipt-place-suggestion.service';

describe('ReceiptsController', () => {
  let controller: ReceiptsController;
  let locationService: { setManual: jest.Mock; resetToAuto: jest.Mock };
  let placeSuggestionService: { suggest: jest.Mock };
  let service: {
    createFromUpload: jest.Mock;
    createFromScan: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    approve: jest.Mock;
    bulkApprove: jest.Mock;
    delete: jest.Mock;
    getFilePayload: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      createFromUpload: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
      createFromScan: jest.fn().mockResolvedValue({ id: 'receipt-2' }),
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
      findOne: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
      update: jest.fn().mockResolvedValue({ id: 'receipt-1', status: 'draft' }),
      approve: jest.fn().mockResolvedValue({
        receipt: { id: 'receipt-1', status: 'approved' },
        transaction: { id: 'tx-1' },
      }),
      bulkApprove: jest.fn().mockResolvedValue({ approved: 2, failed: 0, errors: [] }),
      delete: jest.fn().mockResolvedValue({ success: true }),
      getFilePayload: jest.fn().mockResolvedValue({
        buffer: Buffer.from('file-data'),
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg',
      }),
    };

    locationService = {
      setManual: jest.fn().mockResolvedValue({ id: 'receipt-1', locationSource: 'manual' }),
      resetToAuto: jest.fn().mockResolvedValue({ id: 'receipt-1', locationSource: 'device' }),
    };

    placeSuggestionService = { suggest: jest.fn().mockResolvedValue({ needed: false }) };

    const moduleBuilder = Test.createTestingModule({
      controllers: [ReceiptsController],
      providers: [
        { provide: ReceiptsService, useValue: service },
        { provide: ReceiptLocationService, useValue: locationService },
        { provide: ReceiptStageService, useValue: {} },
        { provide: ReceiptMatchService, useValue: { refresh: jest.fn(), candidates: jest.fn() } },
        { provide: ReceiptSplitService, useValue: { suggest: jest.fn(), apply: jest.fn() } },
        { provide: ReceiptPlaceSuggestionService, useValue: placeSuggestionService },
      ],
    });

    moduleBuilder.overrideGuard(JwtAuthGuard).useValue({ canActivate: jest.fn().mockReturnValue(true) });
    moduleBuilder
      .overrideGuard(WorkspaceContextGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) });
    moduleBuilder
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get(ReceiptsController);
  });

  it('delegates upload to service', async () => {
    const user = { id: 'user-1' } as any;
    await controller.upload(
      [
        {
          originalname: 'receipt.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          filename: 'receipt.jpg',
          path: '/tmp/receipt.jpg',
        } as Express.Multer.File,
      ],
      { language: 'eng' } as any,
      user,
      'workspace-1',
    );

    expect(service.createFromUpload).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', workspaceId: 'workspace-1', language: 'eng' }),
    );
  });

  it('delegates scan upload to service', async () => {
    const user = { id: 'user-1' } as any;
    await controller.scan(
      {
        originalname: 'scan.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        filename: 'scan.jpg',
        path: '/tmp/scan.jpg',
      } as Express.Multer.File,
      { language: 'auto' } as any,
      user,
      'workspace-1',
    );

    expect(service.createFromScan).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', workspaceId: 'workspace-1', language: 'auto' }),
    );
  });

  it('delegates approval to service', async () => {
    await controller.approve('receipt-1', 'workspace-1', { id: 'user-1' } as any, {
      transactionId: null,
    });

    expect(service.approve).toHaveBeenCalledWith('receipt-1', 'workspace-1', 'user-1', {
      attachTo: null,
    });
  });

  it('delegates bulk approval to service', async () => {
    await controller.bulkApprove(
      { receiptIds: ['receipt-1', 'receipt-2'] } as any,
      'workspace-1',
      { id: 'user-1' } as any,
    );

    expect(service.bulkApprove).toHaveBeenCalledWith(
      ['receipt-1', 'receipt-2'],
      'workspace-1',
      'user-1',
      undefined,
    );
  });

  it('passes the editing user to update', async () => {
    await controller.update('receipt-1', 'workspace-1', { status: 'reviewed' } as any, {
      id: 'user-1',
    } as any);

    expect(service.update).toHaveBeenCalledWith(
      'receipt-1',
      'workspace-1',
      { status: 'reviewed' },
      'user-1',
    );
  });

  it('delegates delete to service', async () => {
    await controller.delete('receipt-1', 'workspace-1', { id: 'user-1' } as any);

    expect(service.delete).toHaveBeenCalledWith('receipt-1', 'workspace-1', 'user-1');
  });

  it('returns receipt file content', async () => {
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as any;

    await controller.getFile('receipt-1', 'workspace-1', response);

    expect(service.getFilePayload).toHaveBeenCalledWith('receipt-1', 'workspace-1');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(response.send).toHaveBeenCalledWith(Buffer.from('file-data'));
  });

  it('returns 404 when receipt file is missing', async () => {
    service.getFilePayload.mockResolvedValue(null);

    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    } as any;

    await controller.getFile('receipt-1', 'workspace-1', response);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('forwards the device point sent with a scan', async () => {
    await controller.scan(
      {
        originalname: 'scan.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        filename: 'scan.jpg',
        path: '/tmp/scan.jpg',
      } as Express.Multer.File,
      { language: 'eng', latitude: 43.2383, longitude: 76.9453, accuracy: 12.4 } as any,
      { id: 'user-1' } as any,
      'workspace-1',
    );

    expect(service.createFromScan).toHaveBeenCalledWith(
      expect.objectContaining({
        captureLocation: { lat: 43.2383, lng: 76.9453, accuracyM: 12 },
      }),
    );
  });

  it('pins a manual location inside the workspace', async () => {
    await expect(
      controller.setLocation('receipt-1', 'workspace-1', { latitude: 1, longitude: 2 }, {
        id: 'user-1',
      } as any),
    ).resolves.toMatchObject({ locationSource: 'manual' });

    expect(locationService.setManual).toHaveBeenCalledWith(
      'receipt-1',
      'workspace-1',
      { latitude: 1, longitude: 2 },
      'user-1',
    );
  });

  it('rejects a manual location for a receipt outside the workspace', async () => {
    locationService.setManual.mockResolvedValue(null);

    await expect(
      controller.setLocation('receipt-1', 'workspace-2', { latitude: 1, longitude: 2 }, {
        id: 'user-1',
      } as any),
    ).rejects.toThrow('Receipt not found');
  });

  it('resets the location to automatic', async () => {
    const user = { id: 'user-1' } as any;
    await expect(controller.resetLocation('receipt-1', 'workspace-1', user)).resolves.toMatchObject({
      locationSource: 'device',
    });
    expect(locationService.resetToAuto).toHaveBeenCalledWith('receipt-1', 'workspace-1', 'user-1');

    locationService.resetToAuto.mockResolvedValue(null);
    await expect(controller.resetLocation('receipt-1', 'workspace-2', user)).rejects.toThrow(
      'Receipt not found',
    );
  });

  it('passes a picked shop through to the location service', async () => {
    const place = { name: 'Carrefour', category: 'shop', osmType: 'node', osmId: '274497719' };
    locationService.setManual.mockResolvedValue({ id: 'receipt-1', locationSource: 'place' });

    await expect(
      controller.setLocation('receipt-1', 'workspace-1', { latitude: 1, longitude: 2, place }, {
        id: 'user-1',
      } as any),
    ).resolves.toMatchObject({ locationSource: 'place' });
    expect(locationService.setManual).toHaveBeenCalledWith(
      'receipt-1',
      'workspace-1',
      { latitude: 1, longitude: 2, place },
      'user-1',
    );
  });

  it('suggests places for a statement inside the workspace', async () => {
    const dto = { statementId: 'statement-1', latitude: 43.73, longitude: 7.417, accuracy: 30 };
    placeSuggestionService.suggest.mockResolvedValue({ needed: true, candidates: [] });

    await expect(controller.placeSuggestions('workspace-1', dto)).resolves.toMatchObject({
      needed: true,
    });
    expect(placeSuggestionService.suggest).toHaveBeenCalledWith('statement-1', 'workspace-1', dto);

    placeSuggestionService.suggest.mockResolvedValue(null);
    await expect(controller.placeSuggestions('workspace-2', dto)).rejects.toThrow(
      'Receipt not found',
    );
  });
});
