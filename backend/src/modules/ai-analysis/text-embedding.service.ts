import * as path from 'node:path';
import { env, pipeline } from '@huggingface/transformers';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

type FeatureExtractor = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array | number[] }>;

/** Same multilingual model the categoriser already ships with. */
export const EMBEDDING_MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

/**
 * Turns text into vectors using the model already installed for categorisation.
 *
 * Vectors come out L2-normalised, so cosine similarity is a plain dot product —
 * no norms need storing or recomputing at query time.
 */
@Injectable()
export class TextEmbeddingService {
  private readonly logger = new Logger(TextEmbeddingService.name);
  private extractor: FeatureExtractor | null = null;
  private initPromise: Promise<void> | null = null;
  private loadError: Error | null = null;

  async isAvailable(): Promise<boolean> {
    await this.initialize();
    return this.extractor !== null;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    await this.initialize();

    if (!this.extractor) {
      // Not installed on this server: a state of the deployment, not a failed request.
      this.logger.warn(
        `Embedding model is not available: ${this.loadError?.message ?? 'not loaded'}`,
      );
      throw new ServiceUnavailableException('The local embedding model is not installed');
    }

    const vectors: Float32Array[] = [];
    for (const text of texts) {
      const output = await this.extractor(text, { pooling: 'mean', normalize: true });
      vectors.push(Float32Array.from(output.data));
    }

    return vectors;
  }

  private async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.loadModel();
    }
    return this.initPromise;
  }

  private async loadModel(): Promise<void> {
    // Never reach out to the network: the model is installed on disk by the
    // existing local-categorisation flow, and a silent download would be a
    // surprise egress from a self-hosted deployment.
    env.allowRemoteModels = false;
    env.localModelPath = this.modelRoot();

    try {
      this.extractor = (await pipeline('feature-extraction', EMBEDDING_MODEL_ID, {
        dtype: 'fp32',
      })) as unknown as FeatureExtractor;
    } catch (error) {
      this.loadError = error instanceof Error ? error : new Error(String(error));
      this.extractor = null;
      this.logger.warn({
        type: 'embedding_model_unavailable',
        message: this.loadError.message,
      });
    }
  }

  private modelRoot(): string {
    return (
      process.env.LOCAL_CATEGORIZATION_MODEL_ROOT ||
      path.join(process.cwd(), '.local-models', 'categorization')
    );
  }
}
