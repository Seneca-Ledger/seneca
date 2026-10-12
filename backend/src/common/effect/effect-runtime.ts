import { Global, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { Cause, type Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { FetchHttpClient, HttpClient } from 'effect/http';
import { DomainError, toHttpException } from './domain-error';

/** Infrastructure every Effect in the backend may use. Nest services provide the rest per call. */
const AppLayer = Layer.mergeAll(
  FetchHttpClient.layer.pipe(
    // effect caches its default `globalThis.fetch` on first use; reading it per
    // request keeps `global.fetch` mocks in tests working.
    Layer.provide(
      Layer.succeed(FetchHttpClient.Fetch, (input, init) => globalThis.fetch(input, init)),
    ),
  ),
  // The client would add `traceparent`/`b3` headers to every request. There is
  // no tracer to join them to, and they would hand our ids to third parties.
  Layer.succeed(HttpClient.TracerPropagationEnabled, false),
);
export type AppServices = HttpClient.HttpClient;

/**
 * The one place Effects are run from Nest code. A `DomainError` failure
 * becomes the matching HttpException, so the global filter answers exactly as
 * for a thrown one; any other failure or defect is rethrown as-is and ends up
 * as a logged 500.
 */
@Injectable()
export class EffectRuntime implements OnModuleDestroy {
  private readonly runtime = ManagedRuntime.make(AppLayer);

  async run<A, E>(
    effect: Effect.Effect<A, E, AppServices>,
    options?: { readonly signal?: AbortSignal },
  ): Promise<A> {
    const exit = await this.runtime.runPromiseExit(effect, options);
    if (Exit.isSuccess(exit)) {
      return exit.value;
    }
    const error = Cause.squash(exit.cause);
    throw error instanceof DomainError ? toHttpException(error) : error;
  }

  onModuleDestroy(): Promise<void> {
    return this.runtime.dispose();
  }
}

@Global()
@Module({ providers: [EffectRuntime], exports: [EffectRuntime] })
export class EffectRuntimeModule {}
