import type { MockedFunction } from 'vitest';
import { env, pipeline } from '@huggingface/transformers';
import { TransactionCategorizer } from '@/modules/classification/helpers/transaction-categorizer';

vi.mock('@huggingface/transformers', () => ({
  env: {
    allowRemoteModels: true,
    localModelPath: undefined,
  },
  pipeline: vi.fn(),
}));

const mockedPipeline = pipeline as MockedFunction<typeof pipeline>;

describe('TransactionCategorizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.allowRemoteModels = true;
    env.localModelPath = undefined;
  });

  it('returns a deterministic substring match without loading the model', async () => {
    const categorizer = new TransactionCategorizer({
      categories: ['Продукты', 'Транспорт'],
      rules: [{ match: 'lidl', category: 'Продукты' }],
    });

    await expect(categorizer.categorize('LIDL Berlin')).resolves.toBe('Продукты');
    expect(mockedPipeline).not.toHaveBeenCalled();
  });

  it('returns a deterministic regex match without loading the model', async () => {
    const categorizer = new TransactionCategorizer({
      categories: ['Продукты', 'Транспорт'],
      rules: [{ match: /uber|bolt|gettaxi/i, category: 'Транспорт' }],
    });

    await expect(categorizer.categorize('Uber BV')).resolves.toBe('Транспорт');
    expect(mockedPipeline).not.toHaveBeenCalled();
  });

  it('returns the closest semantic category above the threshold and caches category vectors', async () => {
    const extractor = vi.fn(async (text: string) => {
      const vectors: Record<string, number[]> = {
        продукты: [1, 0],
        транспорт: [0, 1],
        'fresh market': [0.9, 0.1],
        grocery: [0.8, 0.2],
      };

      return { data: vectors[text] ?? [0, 0] };
    });

    mockedPipeline.mockResolvedValue(extractor as never);

    const categorizer = new TransactionCategorizer({
      categories: ['Продукты', 'Транспорт'],
      threshold: 0.35,
      allowRemoteModels: false,
      localModelPath: '/models',
    });

    await expect(categorizer.categorize('Fresh Market')).resolves.toBe('Продукты');
    await expect(categorizer.categorize('Grocery')).resolves.toBe('Продукты');

    expect(mockedPipeline).toHaveBeenCalledTimes(1);
    expect(mockedPipeline).toHaveBeenCalledWith('feature-extraction', expect.any(String), {
      dtype: 'q8',
    });
    expect(extractor).toHaveBeenCalledTimes(4);
    expect(extractor).toHaveBeenCalledWith('продукты', {
      pooling: 'mean',
      normalize: true,
    });
    expect(extractor).toHaveBeenCalledWith('транспорт', {
      pooling: 'mean',
      normalize: true,
    });
    expect(env.allowRemoteModels).toBe(false);
    expect(env.localModelPath).toBe('/models');
  });

  it('returns null when the closest semantic category is below the threshold', async () => {
    mockedPipeline.mockResolvedValue(
      vi.fn(async (text: string) => {
        const vectors: Record<string, number[]> = {
          продукты: [1, 0],
          транспорт: [0, 1],
          unknown: [0.2, 0.98],
        };

        return { data: vectors[text] ?? [0, 0] };
      }) as never,
    );

    const categorizer = new TransactionCategorizer({
      categories: ['Продукты', 'Транспорт'],
      threshold: 0.99,
    });

    await expect(categorizer.categorize('Unknown')).resolves.toBeNull();
  });

  it('normalizes category labels before caching semantic vectors', async () => {
    mockedPipeline.mockResolvedValue(
      vi.fn(async (text: string) => {
        const vectors: Record<string, number[]> = {
          продукты: [0, 1],
          здоровье: [1, 0],
          аптека: [1, 0],
        };

        return { data: vectors[text] ?? [0, 0] };
      }) as never,
    );

    const categorizer = new TransactionCategorizer({
      categories: ['Продукты', 'Здоровье'],
      threshold: 0.5,
    });

    await expect(categorizer.categorize('Аптека')).resolves.toBe('Здоровье');
  });

  it('returns null for semantic categorization when the model fails to load', async () => {
    mockedPipeline.mockRejectedValue(new Error('missing local model'));

    const categorizer = new TransactionCategorizer({
      categories: ['Продукты', 'Транспорт'],
      rules: [{ match: 'lidl', category: 'Продукты' }],
      allowRemoteModels: false,
    });

    await expect(categorizer.categorize('Unknown merchant')).resolves.toBeNull();
    await expect(categorizer.categorize('Lidl')).resolves.toBe('Продукты');
    expect(categorizer.getModelLoadError()?.message).toBe('missing local model');
  });
});
