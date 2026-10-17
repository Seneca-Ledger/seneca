import { Schema } from 'effect';

export interface ToolInputSchema {
  [key: string]: unknown;
  type: 'object';
}

/**
 * The JSON Schema MCP clients read for a tool's arguments. Extra arguments are
 * refused when the call is decoded, so the schema says so too.
 */
export function toToolInputSchema(schema: Schema.Top): ToolInputSchema {
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
