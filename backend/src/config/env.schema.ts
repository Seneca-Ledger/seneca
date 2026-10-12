import { Exit, Schema } from 'effect';
import { describeSchemaFailure } from '../common/effect/schema-issues';

// Every check carries its own message: the default ones quote the offending
// value, and these values are connection strings and secrets.
const matching = (pattern: RegExp, message: string) =>
  Schema.String.check(Schema.isPattern(pattern, { message }));

const PostgresUrl = matching(/^postgres(ql)?:\/\/\S+$/, 'must be a postgres:// URL');
const RedisUrl = matching(/^rediss?:\/\/\S+$/, 'must be a redis:// URL');
const Port = matching(/^\d{1,5}$/, 'must be a port number');
const Secret = matching(/\S/, 'must not be empty');

/** Outside production every variable is optional: the code falls back to local defaults. */
const DevelopmentEnv = Schema.Struct({
  DATABASE_URL: Schema.optional(PostgresUrl),
  REDIS_URL: Schema.optional(RedisUrl),
  PORT: Schema.optional(Port),
});

/** Production must not start on a dev fallback: no default database, no published secret. */
const ProductionEnv = Schema.Struct({
  ...DevelopmentEnv.fields,
  DATABASE_URL: PostgresUrl,
  JWT_SECRET: Secret,
  JWT_REFRESH_SECRET: Secret,
  INTEGRATIONS_ENCRYPTION_KEY: Secret,
});

/**
 * ConfigModule `validate` hook. Reports every problem at once, naming the
 * variables only, and returns the config untouched (values stay strings).
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const schema = config.NODE_ENV === 'production' ? ProductionEnv : DevelopmentEnv;
  // `KEY=` in an .env file means unset: the code reads it with `|| default`.
  const present = Object.fromEntries(Object.entries(config).filter(([, value]) => value !== ''));
  const exit = Schema.decodeUnknownExit(schema, { errors: 'all' })(present);
  if (Exit.isSuccess(exit)) {
    return config;
  }
  const lines = describeSchemaFailure(exit.cause).map(line => `  ${line}`);
  throw new Error(`Invalid environment:\n${lines.join('\n')}`);
}
