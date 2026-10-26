import { Schema } from 'effect';

export interface ToolInputSchema {
  [key: string]: unknown;
  type: 'object';
}

const NO_ARGUMENTS: ToolInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

/**
 * The JSON Schema MCP clients read for a tool's arguments. Extra arguments are
 * refused when the call is decoded, so the schema says so too.
 */
export function toToolInputSchema(schema: Schema.Top): ToolInputSchema {
  const ast = schema.ast;
  // Effect renders an empty struct as "anything but null"; a tool without arguments takes `{}`.
  if (
    ast._tag === 'Objects' &&
    ast.propertySignatures.length === 0 &&
    ast.indexSignatures.length === 0
  ) {
    return NO_ARGUMENTS;
  }
  const document = Schema.toJsonSchemaDocument(schema);
  const root = document.schema as Record<string, unknown>;
  if (root.type !== 'object') {
    throw new Error(`An MCP tool input must be an object schema, got ${String(root.type)}`);
  }
  const definitions = document.definitions as Record<string, unknown> | undefined;
  return {
    ...root,
    type: 'object',
    additionalProperties: false,
    ...(definitions && Object.keys(definitions).length > 0 ? { $defs: definitions } : {}),
  };
}
