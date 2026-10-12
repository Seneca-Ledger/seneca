import { Logger } from '@nestjs/common';
import { Data, Duration, Effect, Option, Schedule, Schema } from 'effect';
import {
  isAiCircuitOpen,
  isAiEnabled,
  recordAiFailure,
  recordAiSuccess,
  withAiConcurrency,
} from '../../modules/parsing/helpers/ai-runtime.util';
import { fetchPublicUrl } from '../utils/egress-url.util';

type GenerateJsonOptions = {
  timeoutMs: number;
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

type AiInlineDataPart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

type AiTextPart = {
  text: string;
};

type AiContent = {
  role: 'user' | 'model';
  parts: Array<AiInlineDataPart | AiTextPart>;
};

type OpenAiMessageContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

type OpenAiChatMessage = {
  role: 'user' | 'assistant';
  content: OpenAiMessageContent;
};

const OpenAiChatResponse = Schema.Struct({
  choices: Schema.optional(
    Schema.Array(
      Schema.Struct({
        message: Schema.optional(
          Schema.Struct({ content: Schema.optional(Schema.NullOr(Schema.String)) }),
        ),
      }),
    ),
  ),
});
const decodeChatResponse = Schema.decodeUnknownOption(OpenAiChatResponse);

/** The endpoint answered with an error status, or the request never got an answer. */
class AiRequestFailed extends Data.TaggedError('AiRequestFailed')<{
  readonly status?: number;
}> {}

/** No status (network) or one that may pass on a second try. */
const isTransient = (error: AiRequestFailed | { readonly _tag: 'TimeoutError' }) =>
  error._tag === 'TimeoutError' ||
  error.status === undefined ||
  error.status === 429 ||
  error.status >= 500;

export type BaseAiClientConfig = {
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
};

export abstract class BaseAiHelper {
  protected readonly logger = new Logger(this.constructor.name);
  protected aiBaseUrl: string | null = null;
  protected aiApiKey: string | null = null;
  protected aiModel: string | null = null;
  /**
   * True when the endpoint came from the operator's own AI_BASE_URL env var,
   * where a private address is a legitimate self-hosted setup (Ollama on
   * localhost). Workspace- and user-supplied endpoints are not trusted that
   * way — they already have to pass assertPublicEgressUrl when saved, so the
   * call below enforces the same rule and refuses redirects off it.
   */
  private aiBaseUrlIsOperatorConfigured = false;

  constructor(apiKey: string | undefined = process.env.AI_API_KEY) {
    const baseUrl = process.env.AI_BASE_URL;
    const model = process.env.AI_MODEL;

    if (baseUrl && model && isAiEnabled()) {
      this.aiBaseUrl = baseUrl.replace(/\/+$/, '');
      this.aiApiKey = apiKey || null;
      this.aiModel = model;
      this.aiBaseUrlIsOperatorConfigured = true;
    }
  }

  configureAiClient(config: BaseAiClientConfig): void {
    if (config.baseUrl && config.model && isAiEnabled()) {
      this.aiBaseUrl = config.baseUrl.replace(/\/+$/, '');
      this.aiApiKey = config.apiKey || null;
      this.aiModel = config.model;
      this.aiBaseUrlIsOperatorConfigured = false;
      return;
    }

    this.aiBaseUrl = null;
    this.aiApiKey = null;
    this.aiModel = null;
    this.aiBaseUrlIsOperatorConfigured = false;
  }

  private aiFetch(url: string, init: RequestInit): Promise<Response> {
    return this.aiBaseUrlIsOperatorConfigured ? fetch(url, init) : fetchPublicUrl(url, init);
  }

  isAvailable(): boolean {
    return Boolean(this.aiBaseUrl && this.aiModel) && isAiEnabled() && !isAiCircuitOpen();
  }

  protected async generateJsonContent(
    contents: AiContent[],
    options: GenerateJsonOptions,
  ): Promise<string | null> {
    if (!(this.aiBaseUrl && this.aiModel && this.isAvailable())) {
      return null;
    }

    const url = `${this.aiBaseUrl}/v1/chat/completions`;
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.aiApiKey ? { Authorization: `Bearer ${this.aiApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.aiModel,
        messages: this.toOpenAiMessages(contents),
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    };

    // A timeout interrupts the attempt, which aborts the request and frees its
    // concurrency slot; the old Promise.race left the fetch running and the
    // slot held until the endpoint finally answered.
    const attempt = Effect.tryPromise({
      try: signal => withAiConcurrency(() => this.aiFetch(url, { ...init, signal })),
      catch: () => new AiRequestFailed({}),
    }).pipe(
      Effect.flatMap(response =>
        response.ok
          ? Effect.tryPromise({ try: () => response.json(), catch: () => new AiRequestFailed({}) })
          : Effect.fail(new AiRequestFailed({ status: response.status })),
      ),
      Effect.timeout(options.timeoutMs),
    );

    const maxDelay = Duration.millis(options.maxDelayMs);
    const content = await Effect.runPromise(
      attempt.pipe(
        Effect.retry({
          times: options.retries,
          while: isTransient,
          schedule: Schedule.exponential(options.baseDelayMs).pipe(
            Schedule.jittered,
            Schedule.modifyDelay(({ duration }) =>
              Effect.succeed(Duration.min(duration, maxDelay)),
            ),
          ),
        }),
        Effect.map(
          body => Option.getOrUndefined(decodeChatResponse(body))?.choices?.[0]?.message?.content,
        ),
        Effect.orElseSucceed(() => undefined),
      ),
    );

    if (!content) {
      recordAiFailure();
      return null;
    }
    recordAiSuccess();
    return content;
  }

  private toOpenAiMessages(contents: AiContent[]): OpenAiChatMessage[] {
    return contents.map(content => ({
      role: content.role === 'model' ? 'assistant' : 'user',
      content: this.toOpenAiContent(content.parts),
    }));
  }

  private toOpenAiContent(parts: Array<AiInlineDataPart | AiTextPart>): OpenAiMessageContent {
    const openAiParts = parts.map(part => {
      if ('text' in part) {
        return { type: 'text' as const, text: part.text };
      }

      return {
        type: 'image_url' as const,
        image_url: {
          url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        },
      };
    });

    if (openAiParts.every(part => part.type === 'text')) {
      return openAiParts.map(part => ('text' in part ? part.text : '')).join('\n');
    }

    return openAiParts;
  }
}
