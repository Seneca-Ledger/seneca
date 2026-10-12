import { Cause, Data, Duration, Effect, Exit, Schedule } from 'effect';

/** The attempt threw or rejected; `cause` is what it threw. */
class AttemptFailed extends Data.TaggedError('AttemptFailed')<{ readonly cause: unknown }> {}

/** An attempt ran past its timeout and was abandoned. */
export class AttemptTimedOut extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttemptTimedOut';
  }
}

export interface RetryPolicy {
  /** Per attempt. The attempt's AbortSignal fires when it runs out. */
  readonly timeoutMs: number;
  readonly timeoutMessage: string;
  /** Extra attempts after the first. */
  readonly retries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  /** Whether a thrown error is worth another attempt. Timeouts always are. */
  readonly retryable?: (error: unknown) => boolean;
}

/**
 * Runs `attempt` with a timeout per try and jittered, capped exponential
 * backoff between tries. The promise rejects with what the last attempt
 * threw, or AttemptTimedOut, so callers keep their own error handling.
 *
 * An API that cannot be cancelled (nodemailer's sendMail) keeps running after
 * its timeout: the retry may then deliver twice, as with the old helper.
 */
export async function attemptWithRetry<A>(
  attempt: (signal: AbortSignal) => Promise<A>,
  policy: RetryPolicy,
): Promise<A> {
  const maxDelay = Duration.millis(policy.maxDelayMs);
  const exit = await Effect.runPromiseExit(
    Effect.tryPromise({ try: attempt, catch: cause => new AttemptFailed({ cause }) }).pipe(
      Effect.timeout(policy.timeoutMs),
      Effect.retry({
        times: policy.retries,
        while: error => error._tag === 'TimeoutError' || (policy.retryable?.(error.cause) ?? false),
        schedule: Schedule.exponential(policy.baseDelayMs).pipe(
          Schedule.jittered,
          Schedule.modifyDelay(({ duration }) => Effect.succeed(Duration.min(duration, maxDelay))),
        ),
      }),
    ),
  );
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  const error = Cause.squash(exit.cause);
  if (error instanceof AttemptFailed) {
    throw error.cause;
  }
  if (Cause.isTimeoutError(error)) {
    throw new AttemptTimedOut(policy.timeoutMessage);
  }
  throw error;
}
