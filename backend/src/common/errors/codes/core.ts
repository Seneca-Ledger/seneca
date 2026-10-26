import { APP_NAME } from '../../brand';

/** Error codes and English messages: core. Gathered into ERR in ../app-error.ts. */
export const CORE_ERRORS = {
  // ── workspaces ──────────────────────────────────────────────────────────
  WORKSPACE_NOT_FOUND: 'Workspace not found',
  WORKSPACE_OWNER_NOT_FOUND: 'Workspace owner not found',
  WORKSPACE_NOT_A_MEMBER: 'You are not a member of this workspace',
  // A past version: the message must not say "workspace" — the client reads
  // any 403 that does as "you lost access" and switches workspaces.
  VERSION_READ_ONLY: 'This is a past version and can only be viewed',
  VERSION_OWNER_ONLY: 'Only the owner can open past versions',
  WORKSPACE_ONLY_OWNER_CAN_DELETE: 'Only the owner can delete the workspace',
  WORKSPACE_ONLY_OWNER_CAN_MANAGE_ADMINS: 'Only the owner can manage administrators',
  WORKSPACE_ONLY_OWNER_CAN_MANAGE_ADMINS_AND_OWNER:
    'Only the owner can manage administrators and ownership',
  WORKSPACE_ONLY_OWNER_CAN_TRANSFER: 'Only the current owner can transfer ownership',
  WORKSPACE_ADMIN_REQUIRED_TO_INVITE: 'Only the owner or an administrator can invite members',
  WORKSPACE_ADMIN_REQUIRED_TO_EDIT_SETTINGS:
    'Only the owner or an administrator can change settings',
  WORKSPACE_TRANSFER_OWNERSHIP_FIRST: 'Transfer ownership to another member first',
  PLUGIN_DISABLED: 'The {{plugin}} plugin is turned off for this workspace',
  MEMBER_NOT_FOUND: 'Member not found',
  MEMBER_ALREADY_IN_WORKSPACE: 'User is already in the workspace',
  MEMBER_CANNOT_REMOVE_OWNER: 'The workspace owner cannot be removed',
  MEMBER_CANNOT_CHANGE_OWN_ROLE: 'You cannot change your own role',
  MEMBER_PERMISSIONS_ROLE_INVALID: 'Only members have individual permissions',
  TRANSACTION_PRIVATE_NOT_OWNER:
    'Only the person a transaction belongs to can make it private; assign it to yourself first',
  INVITATION_NOT_FOUND: 'Invitation not found',
  INVITATION_NOT_FOUND_OR_USED: 'Invitation not found or already used',
  INVITATION_INVALID: 'Invalid invitation',
  INVITATION_TOKEN_INVALID: 'Invalid invitation token',
  INVITATION_UNAVAILABLE: 'Invitation is unavailable',
  INVITATION_REVOKED: 'Invitation has been revoked',
  INVITATION_EXPIRED: 'Invitation has expired',
  INVITATION_WRONG_ACCOUNT: 'Sign in as {{email}}',
  // ── data-entry ──────────────────────────────────────────────────────────
  ENTRY_NOT_FOUND: 'Record not found',
  ENTRY_CUSTOM_COLUMN_TITLE_REQUIRED: 'Enter a custom column name',
  // ── statements ──────────────────────────────────────────────────────────
  STATEMENT_NOT_FOUND: 'Statement not found',
  STATEMENT_NOT_AWAITING_BALANCE: 'The statement is not awaiting balance confirmation',
  STATEMENT_DUPLICATE_FILE: 'This statement has already been uploaded (duplicate file)',
  STATEMENT_DUPLICATE_RECENT: 'A similar statement was uploaded recently',
  STATEMENT_EDIT_FORBIDDEN: 'Not enough permissions to edit this statement',
  STATEMENTS_EDIT_FORBIDDEN: 'Not enough permissions to edit statements',
  EXPENSE_DUPLICATE: 'A similar expense already exists',
  // ── shared ──────────────────────────────────────────────────────────────
  CATEGORY_NOT_FOUND: 'Category not found',
  USER_NOT_FOUND: 'User not found',
  USER_INVALID: 'Invalid user',
  FILE_NOT_UPLOADED: 'No file uploaded',
  SHARING_FORBIDDEN: 'Not enough permissions to create links and grant access',
  CATEGORIES_EDIT_FORBIDDEN: 'Not enough permissions to edit categories',
  TABLES_EDIT_FORBIDDEN: 'Not enough permissions to edit tables',
  DATA_ENTRY_EDIT_FORBIDDEN: 'Not enough permissions to edit data entry',
  // ── notes ─────────────────────────────────────────────────────────────────
  NOTE_NOT_FOUND: 'Note not found',
  NOTE_EMPTY: 'Note is empty',
  NOTE_TOO_LONG: 'Note is too long',
  NOTE_TARGET_NOT_FOUND: 'The item this note belongs to was not found',
  NOTE_MENTION_NOT_A_MEMBER: 'One of the mentioned users is not a workspace member',
  NOTE_DELETE_FORBIDDEN: 'Only the author or a workspace admin can delete this note',
  // ── system update ───────────────────────────────────────────────────────
  SYSTEM_UPDATE_ADMIN_ONLY: `Only an instance administrator can update ${APP_NAME}`,
  SYSTEM_UPDATER_UNAVAILABLE:
    'The updater is not running. Add COMPOSE_PROFILES=updater to .env and run docker compose up -d, or run make upgrade on the server.',
  SYSTEM_UPDATE_IN_PROGRESS: 'An update is already running',
  SYSTEM_UPDATE_NOT_AVAILABLE: 'This instance already runs the newest release',
  // ── versions ──────────────────────────────────────────────────────────────
  VERSION_SNAPSHOT_RUNNING: 'A snapshot is being taken right now; try again in a moment',
  VERSION_LIST_OWNER_ONLY: 'Only the owner can see and take snapshots',
  VERSION_NOT_FOUND: 'This version is not available',
  // ── request validation (SchemaBody / SchemaQuery) ───────────────────────
  REQUEST_INVALID: 'The request is invalid',
} as const;
