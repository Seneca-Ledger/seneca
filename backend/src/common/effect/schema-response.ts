import {
  type CallHandler,
  type ExecutionContext,
  InternalServerErrorException,
  Logger,
  type NestInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { Exit, Schema, SchemaAST } from 'effect';
import { map, type Observable } from 'rxjs';
import { appError } from '../errors/app-error';
import { describeSchemaFailure } from './schema-issues';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A union flattened into its members, suspensions resolved, each on its encoded side. */
const membersOf = (ast: SchemaAST.AST): SchemaAST.AST[] => {
  if (ast._tag === 'Suspend') return membersOf(SchemaAST.toEncoded(ast.thunk()));
  if (ast._tag === 'Union')
    return ast.types.flatMap(member => membersOf(SchemaAST.toEncoded(member)));
  return [ast];
};

/** Members that say nothing about the shape: whatever they hold passes as it is. */
const isOpaque = (ast: SchemaAST.AST): boolean =>
  ast._tag === 'Unknown' ||
  ast._tag === 'Any' ||
  ast._tag === 'ObjectKeyword' ||
  ast._tag === 'Declaration';

/**
 * `value` reduced to what the schemas declare, at any depth: an object keeps
 * the keys some member names (every key, under an index signature such as
 * `Record` or `StructWithRest`), an array projects each element. It never
 * fails, so a value that drifts from its contract still loses its undeclared
 * keys; the check after it reports the drift.
 */
const projectAgainst = (asts: SchemaAST.AST[], value: unknown): unknown => {
  const members = asts.flatMap(membersOf);
  if (members.some(isOpaque)) return value;
  if (Array.isArray(value)) {
    const arrays = members.filter(member => member._tag === 'Arrays');
    if (arrays.length === 0) return value;
    return value.map((item, index) =>
      projectAgainst(
        arrays.flatMap(array => {
          const element = array.elements[index] ?? array.rest[0];
          return element ? [element] : [];
        }),
        item,
      ),
    );
  }
  if (!isRecord(value)) return value;
  const objects = members.filter(member => member._tag === 'Objects');
  if (objects.length === 0) return value;
  const projected: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const types = objects.flatMap(object => [
      ...object.propertySignatures
        .filter(property => property.name === key)
        .map(property => property.type),
      ...object.indexSignatures.map(index => index.type),
    ]);
    if (types.length > 0) projected[key] = projectAgainst(types, item);
  }
  return projected;
};

export const projectToContract = (ast: SchemaAST.AST, value: unknown): unknown =>
  projectAgainst([ast], value);

/** The value as it goes over the wire: dates as ISO strings, class instances as plain objects. */
const toWire = (value: unknown): unknown =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

type ResponseSchema<S extends Schema.Top> = S & Schema.Codec<S['Type'], S['Encoded'], never, never>;

export class ContractResponseInterceptor<S extends Schema.Top> implements NestInterceptor {
  private readonly logger = new Logger(ContractResponseInterceptor.name);
  private readonly ast: SchemaAST.AST;
  private readonly check;

  constructor(schema: ResponseSchema<S>) {
    this.ast = SchemaAST.toEncoded(schema.ast);
    this.check = Schema.decodeUnknownExit(schema, { errors: 'all' });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(value => this.answer(context, value)));
  }

  private answer(context: ExecutionContext, value: unknown): unknown {
    const wire = toWire(value);
    if (wire === undefined) return value;
    const projected = projectToContract(this.ast, wire);
    const exit = this.check(projected);
    if (Exit.isFailure(exit)) {
      const handler = `${context.getClass().name}.${context.getHandler().name}`;
      const issues = describeSchemaFailure(exit.cause);
      this.logger.error(`${handler} answered outside its contract: ${issues.join('; ')}`);
      // Outside production a drifted answer fails loudly, so e2e catches it;
      // in production it is logged and still leaves with only declared keys.
      if (process.env.NODE_ENV !== 'production') {
        throw new InternalServerErrorException(
          appError('CONTRACT_RESPONSE_DRIFT', { handler, issues: issues.join('; ') }),
        );
      }
    }
    return projected;
  }
}

/**
 * Sends only what the contract declares. The answer is serialized, reduced to
 * the contract's keys at every depth, and checked: an entity row can no longer
 * hand out a column, a relation or an account row the contract does not name.
 */
export function SchemaResponse<S extends Schema.Top>(schema: ResponseSchema<S>): MethodDecorator {
  return (target, key, descriptor) => {
    UseInterceptors(new ContractResponseInterceptor(schema))(target, key, descriptor);
    ApiOkResponse({ schema: Schema.toJsonSchemaDocument(schema).schema as object })(
      target,
      key,
      descriptor,
    );
  };
}
