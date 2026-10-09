import { appDefaultCurrency } from '@/common/utils/currency.util';
import { BaseAiHelper } from '@/common/helpers/base-ai.helper';
import { AiTransactionExtractor } from '@/modules/parsing/helpers/ai-transaction-extractor.helper';

const mockFetch = jest.fn();

const mockIsAiEnabled = jest.fn().mockReturnValue(true);
const mockIsAiCircuitOpen = jest.fn().mockReturnValue(false);
const mockRecordAiSuccess = jest.fn();
const mockRecordAiFailure = jest.fn();
const mockWithAiConcurrency = jest.fn().mockImplementation(fn => fn());
const mockRedactSensitive = jest.fn().mockImplementation(value => value);

jest.mock('@/modules/parsing/helpers/ai-runtime.util', () => ({
  isAiEnabled: (...args: unknown[]) => mockIsAiEnabled(...args),
  isAiCircuitOpen: (...args: unknown[]) => mockIsAiCircuitOpen(...args),
  recordAiSuccess: (...args: unknown[]) => mockRecordAiSuccess(...args),
  recordAiFailure: (...args: unknown[]) => mockRecordAiFailure(...args),
  withAiConcurrency: (...args: unknown[]) => mockWithAiConcurrency(...args),
  redactSensitive: (...args: unknown[]) => mockRedactSensitive(...args),
}));

describe('AiTransactionExtractor', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AI_BASE_URL = 'http://localhost:11434';
    process.env.AI_MODEL = 'llama3.1';
    global.fetch = mockFetch;
    mockIsAiEnabled.mockReturnValue(true);
    mockIsAiCircuitOpen.mockReturnValue(false);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.AI_BASE_URL = undefined;
    process.env.AI_MODEL = undefined;
  });

  it('maps AI transactions into parsed transactions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
            transactions: [
              {
                date: '2026-01-15',
                document_number: 'DOC-1',
                counterparty_name: 'Acme',
                amount_debit: '1200.50',
                purpose: 'Invoice payment',
              },
            ],
              }),
            },
          },
        ],
      }),
    } as Response);

    const extractor = new AiTransactionExtractor('fake-api-key');
    const result = await extractor.extractTransactions('statement text');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      documentNumber: 'DOC-1',
      counterpartyName: 'Acme',
      debit: 1200.5,
      paymentPurpose: 'Invoice payment',
      currency: appDefaultCurrency(),
    });
    expect(mockRecordAiSuccess).toHaveBeenCalled();
  });

  it('parses transactions even when the backend wraps JSON in a markdown code fence (regression)', async () => {
    // Some OpenAI-compatible backends (self-hosted/local models) still fence
    // JSON replies despite response_format:json_object being requested.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `\`\`\`json\n${JSON.stringify({
                transactions: [
                  {
                    date: '2026-01-15',
                    document_number: 'DOC-1',
                    counterparty_name: 'Acme',
                    amount_debit: '1200.50',
                    purpose: 'Invoice payment',
                  },
                ],
              })}\n\`\`\``,
            },
          },
        ],
      }),
    } as Response);

    const extractor = new AiTransactionExtractor('fake-api-key');
    const result = await extractor.extractTransactions('statement text');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ documentNumber: 'DOC-1', debit: 1200.5 });
  });

  it('extends BaseAiHelper', () => {
    const extractor = new AiTransactionExtractor('fake-api-key');

    expect(extractor).toBeInstanceOf(BaseAiHelper);
  });

  it('returns empty array when circuit breaker is open', async () => {
    mockIsAiCircuitOpen.mockReturnValue(true);

    const extractor = new AiTransactionExtractor('fake-api-key');
    await expect(extractor.extractTransactions('statement text')).resolves.toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
