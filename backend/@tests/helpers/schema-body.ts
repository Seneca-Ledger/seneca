import { BadRequestException } from '@nestjs/common';
import type { Schema } from 'effect';
import { EffectSchemaPipe } from '@/common/effect/schema-body';

type BodySchema<S extends Schema.Top> = S & Schema.Codec<S['Type'], S['Encoded'], never, never>;

/**
 * What a `@SchemaBody` route makes of a request body: the decoded value, or
 * the `path: message` lines of the 400 it answers with.
 */
export function decodeBody<S extends Schema.Top>(
  schema: BodySchema<S>,
  input: unknown,
): { value: S['Type'] | undefined; errors: string[] } {
  try {
    return { value: new EffectSchemaPipe(schema).transform(input), errors: [] };
  } catch (error) {
    if (error instanceof BadRequestException) {
      const body = error.getResponse() as { message: string[] };
      return { value: undefined, errors: body.message };
    }
    throw error;
  }
}

/** The top-level fields a body was rejected for (as class-validator reported them); empty when it passes. */
export function rejectedFields<S extends Schema.Top>(schema: BodySchema<S>, input: unknown): string[] {
  const fields = decodeBody(schema, input).errors.map(message => message.split(':')[0].split('.')[0]);
  return [...new Set(fields)];
}
