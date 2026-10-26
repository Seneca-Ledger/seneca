import { InvestmentsScheduler } from '@/modules/investments/investments.scheduler';

describe('InvestmentsScheduler', () => {
  function createScheduler(overrides: Partial<Record<string, unknown>> = {}) {
    const investments = {
      workspacesWithPricedHoldings: vi.fn(async () => ['ws-1', 'ws-2']),
      refreshPrices: vi.fn(async () => 2),
      ...overrides,
    } as any;
    const scheduler = new InvestmentsScheduler(investments);
    // The logger would print the caught error into the test output.
    vi.spyOn((scheduler as any).logger, 'error').mockImplementation(() => undefined);
    vi.spyOn((scheduler as any).logger, 'log').mockImplementation(() => undefined);
    return { scheduler, investments };
  }

  it('reprices every workspace that holds something with a price', async () => {
    const { scheduler, investments } = createScheduler();

    await scheduler.refreshAllPrices();

    // Null actor: nobody pressed anything, so the snapshot is the system's.
    expect(investments.refreshPrices).toHaveBeenCalledWith(null, 'ws-1');
    expect(investments.refreshPrices).toHaveBeenCalledWith(null, 'ws-2');
  });

  it('keeps going when one workspace cannot be priced', async () => {
    const refreshPrices = vi
      .fn()
      .mockRejectedValueOnce(new Error('Stooq is down'))
      .mockResolvedValueOnce(1);
    const { scheduler } = createScheduler({ refreshPrices });

    await expect(scheduler.refreshAllPrices()).resolves.toBeUndefined();
    expect(refreshPrices).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no workspace holds a priced position', async () => {
    const { scheduler, investments } = createScheduler({
      workspacesWithPricedHoldings: vi.fn(async () => []),
    });

    await scheduler.refreshAllPrices();

    expect(investments.refreshPrices).not.toHaveBeenCalled();
  });
});
