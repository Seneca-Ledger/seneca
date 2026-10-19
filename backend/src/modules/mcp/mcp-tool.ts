import type { Schema } from 'effect';
import type { AuditActor } from '../../common/audit-actor.context';
import type { PermissionSubject } from '../../common/authz/request-permissions';
import type { Permission } from '../../common/enums/permissions.enum';
import type { User } from '../../entities/user.entity';

/** Who calls a tool: the API key's owner, in the key's workspace. */
export interface McpToolContext {
  user: User;
  workspaceId: string;
  /** The caller's membership, which decides whose private rows they see. */
  memberId: string | null;
  /** What `PermissionsGuard` would check for the same request. */
  subject: PermissionSubject;
  /** Writes are audited as the key, like its REST calls. */
  auditActor: AuditActor;
}

type Codec<S extends Schema.Top> = S & Schema.Codec<S['Type'], S['Encoded'], never, never>;

export interface McpTool<S extends Schema.Top = Schema.Top> {
  name: string;
  description: string;
  /** Decoded strictly: an argument the schema does not name is refused. */
  input: Codec<S>;
  /** The same permissions as the REST route the tool stands in for. */
  permissions: readonly Permission[];
  /** The REST route's response contract: the answer is reduced to what it declares. */
  output?: Schema.Top;
  readOnly: boolean;
  run(ctx: McpToolContext, args: S['Type']): Promise<unknown>;
}

/** Keeps the arguments typed inside `run` while tools of different inputs share one list. */
export const defineTool = <S extends Schema.Top>(tool: McpTool<S>): McpTool =>
  tool as unknown as McpTool;
