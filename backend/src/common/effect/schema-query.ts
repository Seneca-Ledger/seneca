import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
  type PipeTransform,
} from '@nestjs/common';
import { Exit, Schema } from 'effect';
import type { Request } from 'express';
import { appError } from '../errors/app-error';
import { describeSchemaFailure, describeUnstorableText } from './schema-issues';

/**
 * Decodes a query string or the route parameters with an Effect Schema.
 * Unknown keys are rejected, a failure is a 400 REQUEST_INVALID with
 * `details.issues` (as for bodies), and an empty
 * value (`?page=`) counts as absent, as the DTOs' transformers had it.
 */
export class EffectSchemaQueryPipe<S extends Schema.Top>
  implements PipeTransform<unknown, S['Type']>
{
  private readonly decode;

  constructor(
    schema: S & Schema.Codec<S['Type'], S['Encoded'], never, never>,
    private readonly what: string,
  ) {
    this.decode = Schema.decodeUnknownExit(schema, { onExcessProperty: 'error', errors: 'all' });
  }

  transform(value: unknown): S['Type'] {
    const present =
      typeof value === 'object' && value !== null
        ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== ''))
        : {};
    const unstorable = describeUnstorableText(present);
    const exit = this.decode(present);
    if (!unstorable && Exit.isSuccess(exit)) {
      return exit.value;
    }
    const messages = unstorable
      ? [unstorable]
      : Exit.isFailure(exit)
        ? describeSchemaFailure(exit.cause)
        : [];
    throw new BadRequestException({
      ...appError('REQUEST_INVALID'),
      issues: messages.length > 0 ? messages : [`Invalid ${this.what}`],
    });
  }
}

// Custom decorators: the global ValidationPipe leaves them alone
// (validateCustomDecorators is off), so only the schema decides.
const RequestQuery = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): unknown =>
    ctx.switchToHttp().getRequest<Request>().query,
);
const RequestParams = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): unknown =>
    ctx.switchToHttp().getRequest<Request>().params,
);

/** `@Query()` decoded by a schema from packages/contracts. */
export function SchemaQuery<S extends Schema.Top>(
  schema: S & Schema.Codec<S['Type'], S['Encoded'], never, never>,
): ParameterDecorator {
  return RequestQuery(new EffectSchemaQueryPipe(schema, 'query'));
}

/** `@Param()` decoded by a schema from packages/contracts. */
export function SchemaParams<S extends Schema.Top>(
  schema: S & Schema.Codec<S['Type'], S['Encoded'], never, never>,
): ParameterDecorator {
  return RequestParams(new EffectSchemaQueryPipe(schema, 'route parameters'));
}
