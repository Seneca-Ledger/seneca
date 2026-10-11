import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
  type PipeTransform,
} from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { Exit, Schema } from 'effect';
import type { Request } from 'express';
import { describeSchemaFailure } from './schema-issues';

/**
 * Decodes a request body with an Effect Schema. Mirrors the global
 * ValidationPipe: unknown properties are rejected and the 400 body has the
 * class-validator shape (`message: string[]`), so clients see no difference.
 */
export class EffectSchemaPipe<S extends Schema.Top> implements PipeTransform<unknown, S['Type']> {
  private readonly decode;

  constructor(schema: S & Schema.Codec<S['Type'], S['Encoded'], never, never>) {
    this.decode = Schema.decodeUnknownExit(schema, { onExcessProperty: 'error', errors: 'all' });
  }

  transform(value: unknown): S['Type'] {
    const exit = this.decode(value);
    if (Exit.isSuccess(exit)) {
      return exit.value;
    }
    const messages = describeSchemaFailure(exit.cause);
    throw new BadRequestException({
      message: messages.length > 0 ? messages : ['Invalid request body'],
      error: 'Bad Request',
      statusCode: 400,
    });
  }
}

/**
 * The request body through a custom decorator: the global ValidationPipe
 * leaves custom parameters alone (validateCustomDecorators is off), so only
 * the schema decides what gets through.
 */
const RequestBody = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): unknown => ctx.switchToHttp().getRequest<Request>().body,
);

/** `@Body()` decoded by a schema from packages/contracts and documented in Swagger from it. */
export function SchemaBody<S extends Schema.Top>(
  schema: S & Schema.Codec<S['Type'], S['Encoded'], never, never>,
): ParameterDecorator {
  return (target, key, index) => {
    RequestBody(new EffectSchemaPipe(schema))(target, key, index);
    const method = key === undefined ? undefined : Object.getOwnPropertyDescriptor(target, key);
    if (key !== undefined && method) {
      ApiBody({ schema: Schema.toJsonSchemaDocument(schema).schema as object })(
        target,
        key,
        method,
      );
    }
  };
}
