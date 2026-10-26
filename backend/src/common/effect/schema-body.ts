import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
  type PipeTransform,
} from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { Exit, Schema } from 'effect';
import type { Request } from 'express';
import { appError } from '../errors/app-error';
import { describeSchemaFailure, describeUnstorableText } from './schema-issues';

/**
 * Decodes a request body with an Effect Schema. Unknown properties are
 * rejected; a failure is a 400 REQUEST_INVALID whose `details.issues` names
 * every failing field.
 */
export class EffectSchemaPipe<S extends Schema.Top> implements PipeTransform<unknown, S['Type']> {
  private readonly decode;

  constructor(schema: S & Schema.Codec<S['Type'], S['Encoded'], never, never>) {
    this.decode = Schema.decodeUnknownExit(schema, { onExcessProperty: 'error', errors: 'all' });
  }

  transform(value: unknown): S['Type'] {
    // A request without a body reaches the pipe as undefined (Express 5); the
    // DTOs read that as an empty object, so an all-optional body still passes.
    const input = value === undefined ? {} : value;
    const unstorable = describeUnstorableText(input);
    const exit = this.decode(input);
    if (!unstorable && Exit.isSuccess(exit)) {
      return exit.value;
    }
    const messages = unstorable
      ? [unstorable]
      : Exit.isFailure(exit)
        ? describeSchemaFailure(exit.cause)
        : [];
    // One code for every invalid request; `issues` names each failing field.
    throw new BadRequestException({
      ...appError('REQUEST_INVALID'),
      issues: messages.length > 0 ? messages : ['Invalid request body'],
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

/** Where `SchemaBody` leaves a handler's body schema, for tools that build valid requests from it. */
export const SCHEMA_BODY_METADATA = 'seneca:schema-body';

/** `@Body()` decoded by a schema from packages/contracts and documented in Swagger from it. */
export function SchemaBody<S extends Schema.Top>(
  schema: S & Schema.Codec<S['Type'], S['Encoded'], never, never>,
): ParameterDecorator {
  return (target, key, index) => {
    RequestBody(new EffectSchemaPipe(schema))(target, key, index);
    if (key !== undefined) Reflect.defineMetadata(SCHEMA_BODY_METADATA, schema, target, key);
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
