import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

/**
 * Where the last in-app update got to, as the updater container reports it.
 * `idle` until the first run; a run walks backup → pull → restart → health.
 */
export const SystemUpdateRun = Schema.Struct({
  state: Schema.Literals(['idle', 'running', 'succeeded', 'failed']),
  tag: Schema.NullOr(Schema.String),
  step: Schema.NullOr(Schema.String),
  /** The updater's error output when a step failed. */
  message: Schema.NullOr(Schema.String),
  /** File name of the database dump taken before the update, in the install directory. */
  backup: Schema.NullOr(Schema.String),
  startedAt: Schema.NullOr(Schema.String),
  finishedAt: Schema.NullOr(Schema.String),
});
export type SystemUpdateRun = Wire<typeof SystemUpdateRun>;

/** `GET /system/update` and `POST /system/update` (instance admins only). */
export const SystemUpdateStatus = Schema.Struct({
  /** Release tag baked into the running backend image; null for a local build. */
  currentVersion: Schema.NullOr(Schema.String),
  /** Newest published GitHub release; null when GitHub could not be reached. */
  latestVersion: Schema.NullOr(Schema.String),
  releaseUrl: Schema.NullOr(Schema.String),
  updateAvailable: Schema.Boolean,
  /** The updater container is running (compose profile `updater`). */
  updaterAvailable: Schema.Boolean,
  run: SystemUpdateRun,
});
export type SystemUpdateStatus = Wire<typeof SystemUpdateStatus>;
