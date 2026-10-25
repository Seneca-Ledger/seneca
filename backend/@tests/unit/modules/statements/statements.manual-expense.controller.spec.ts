vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { StatementsController } from '@/modules/statements/statements.controller';

describe('StatementsController manual expense', () => {
  it('delegates manual expense creation to the service', async () => {
    const statementsService = {
      createManualExpense: vi.fn().mockResolvedValue({ id: 'manual-statement-1' }),
    };
    const idempotencyService = {
      checkKey: vi.fn(),
      storeKey: vi.fn(),
    };

    const controller = new StatementsController(
      statementsService as any,
      idempotencyService as any,
    );

    const user = { id: 'user-1' } as any;
    const workspaceId = 'ws-1';
    const files = [] as Express.Multer.File[];
    const payload = {
      amount: '222',
      currency: 'KZT',
      merchant: 'Cafe',
      description: 'Lunch',
      date: '2026-02-20',
      allowDuplicates: true,
    };

    const result = await controller.createManualExpense(files, payload as any, user, workspaceId);

    expect(statementsService.createManualExpense).toHaveBeenCalledWith({
      user,
      workspaceId,
      files,
      payload,
    });
    expect(result).toEqual({ id: 'manual-statement-1' });
  });

  it('delegates statement file attach to the service', async () => {
    const statementsService = {
      createManualExpense: vi.fn(),
      attachFile: vi.fn().mockResolvedValue({ id: 'statement-1' }),
    };
    const idempotencyService = {
      checkKey: vi.fn(),
      storeKey: vi.fn(),
    };

    const controller = new StatementsController(
      statementsService as any,
      idempotencyService as any,
    );

    const user = { id: 'user-1' } as any;
    const workspaceId = 'ws-1';
    const file = {
      originalname: 'receipt.pdf',
      mimetype: 'application/pdf',
      size: 120,
      path: '/tmp/receipt.pdf',
    } as Express.Multer.File;

    const result = await controller.attachFile('statement-1', file, user, workspaceId);

    expect(statementsService.attachFile).toHaveBeenCalledWith(
      'statement-1',
      'user-1',
      'ws-1',
      file,
    );
    expect(result).toEqual({ id: 'statement-1' });
  });
});
