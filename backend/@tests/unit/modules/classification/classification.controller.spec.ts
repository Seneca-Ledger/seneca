import { ClassificationController } from '@/modules/classification/classification.controller';

function createRepoMock() {
  return {
    findOne: jest.fn(),
    save: jest.fn(async value => value),
  };
}

describe('ClassificationController', () => {
  it('scopes single transaction classification by workspaceId', async () => {
    const transactionRepository = createRepoMock();
    const classificationService = {
      classifyTransaction: jest.fn(async () => ({ categoryId: 'cat-1' })),
    };
    const transaction = { id: 'tx-1', workspaceId: 'ws-1' };
    transactionRepository.findOne.mockResolvedValue(transaction);

    const controller = new ClassificationController(
      classificationService as any,
      transactionRepository as any,
    );

    await controller.classifyTransaction('tx-1', { id: 'u1' } as any, 'ws-1');

    expect(transactionRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'tx-1', workspaceId: 'ws-1' },
    });
  });

  it('scopes bulk classification by workspaceId', async () => {
    const transactionRepository = createRepoMock();
    const classificationService = {
      classifyTransaction: jest.fn(async () => ({ categoryId: 'cat-1' })),
    };
    transactionRepository.findOne.mockResolvedValue({ id: 'tx-1', workspaceId: 'ws-1' });
    const controller = new ClassificationController(
      classificationService as any,
      transactionRepository as any,
    );

    await controller.classifyBulk({ transactionIds: ['tx-1'] }, { id: 'u1' } as any, 'ws-1');

    expect(transactionRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { id: 'tx-1', workspaceId: 'ws-1' },
    });
    expect(classificationService.classifyTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-1' }),
      'u1',
      null,
      { bypassCache: true },
    );
  });

  it('leaves a hand-picked category alone during bulk re-classification', async () => {
    const transactionRepository = createRepoMock();
    const classificationService = { classifyTransaction: jest.fn() };
    transactionRepository.findOne.mockResolvedValue({
      id: 'tx-1',
      workspaceId: 'ws-1',
      categorySource: 'manual',
    });
    const controller = new ClassificationController(
      classificationService as any,
      transactionRepository as any,
    );

    const result = await controller.classifyBulk(
      { transactionIds: ['tx-1'] },
      { id: 'u1' } as any,
      'ws-1',
    );

    expect(result).toMatchObject({ total: 1, successful: 0, keptManual: 1 });
    expect(classificationService.classifyTransaction).not.toHaveBeenCalled();
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });
});
