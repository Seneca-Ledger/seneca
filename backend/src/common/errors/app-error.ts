/**
 * Catalogue of domain error codes and their English messages.
 *
 * The English text here is the wire-level fallback: the frontend translates by
 * `code` when it knows one, and renders `message` verbatim when it does not.
 * Never localise these strings on the backend — see HttpExceptionFilter.
 */
export const ERR = {
  // ── custom-tables: table ────────────────────────────────────────────────
  TABLE_NOT_FOUND: 'Table not found',
  TABLE_ID_INVALID: 'Invalid table identifier',
  TABLE_SCHEMA_OUTDATED:
    'The database schema is not up to date for Custom Tables. Run the migrations (`npm -C backend run migration:run`) or enable automatic migrations (env `RUN_MIGRATIONS=true`) and restart the backend.',
  TABLE_COLUMNS_BUILD_FAILED: 'Could not build table columns',
  TABLE_NO_COLUMNS: 'Table has no columns',
  TABLE_NO_COLUMNS_TO_CONVERT: 'Table has no columns to convert',
  TABLE_NO_ROWS_TO_CONVERT: 'Table has no rows to convert',
  TABLE_NO_VALID_ROWS_TO_CONVERT: 'Table has no valid rows to convert',
  TABLE_NOT_LINKED_TO_DATA_ENTRY: 'Table is not linked to data entry',
  TABLE_NOT_LINKED_TO_SOURCE: 'Table is not linked to an app data source',
  SOURCE_KIND_UNKNOWN: 'Unknown data source',
  SOURCE_EMPTY: 'No records match the selected filters',
  SOURCE_TOO_MANY_ROWS: 'Too many records match the filters (limit {{limit}}); narrow them down',
  SOURCE_FILTER_INVALID: 'Invalid data source filter value',
  SOURCE_COLUMNS_NOT_FOUND: 'The table has no columns linked to its data source',
  // ── entity imports (spreadsheet → app records) ──────────────────────────
  IMPORT_TARGET_UNKNOWN: 'Unknown import target',
  IMPORT_MAPPING_INCOMPLETE: 'Required columns are not mapped: {{fields}}',
  IMPORT_NO_VALID_ROWS: 'No rows could be imported',
  IMPORT_BATCH_NOT_FOUND: 'Import batch not found',
  IMPORT_BATCH_ALREADY_UNDONE: 'This import has already been undone',
  TABLES_NOT_FOUND: 'One or more tables were not found',
  TOO_MANY_CUSTOM_COLUMNS:
    'Too many custom columns ({{count}}). Simplify the names or build the table from a single tab (limit {{limit}}).',
  REQUIRED_COLUMNS_UNRESOLVED: 'Could not determine the required columns: {{columns}}',

  // ── custom-tables: rows & columns ───────────────────────────────────────
  ROW_NOT_FOUND: 'Row not found',
  ROW_ID_INVALID: 'Invalid row identifier',
  COLUMN_NOT_FOUND: 'Column not found',
  COLUMN_NOT_FOUND_NAMED: 'Column not found: {{column}}',
  COLUMN_SOME_NOT_FOUND: 'One of the columns was not found',
  COLUMN_ID_INVALID: 'Invalid column identifier',
  COLUMN_KEY_REQUIRED: 'columnKey is required',
  COLUMN_TITLE_REQUIRED: 'Enter a column name',
  COLUMN_NAME_TAKEN: 'A column with this name already exists',
  COLUMN_REQUIRED_VALUE: 'Column "{{column}}" is required',
  VALUE_DUPLICATE_IN_BATCH: 'Value "{{value}}" in column "{{column}}" is repeated in this upload',
  VALUE_DUPLICATE_IN_TABLE: 'Value "{{value}}" in column "{{column}}" already exists in the table',
  COLUMN_RELATION_TARGET_REQUIRED: 'A relation column requires a target table',
  COLUMN_RELATION_TARGET_MISSING: 'The relation column has no target table',
  COLUMN_NOT_RELATION: 'Column is not a relation',
  RELATION_COLUMN_REQUIRED: 'No relation column specified',
  COLUMN_FORMULA_REQUIRED: 'A formula column requires a formula',
  COLUMN_FORMULA_CYCLE: 'The formula refers to itself through other formula columns',
  COLUMN_CURRENCY_INVALID: 'Currency must be a 3-letter ISO 4217 code',
  COLUMN_PRECISION_INVALID: 'Decimal places must be a whole number from 0 to 6',
  COLUMN_FORMAT_INVALID: 'Number format must be "plain" or "percent"',
  COLUMN_OPTIONS_INVALID:
    'Select options must be unique non-empty values with optional #rrggbb colours',
  COLUMN_NOT_AI: 'Column is not an AI column',
  COLUMN_AI_PROMPT_MISSING: 'The AI column has no prompt',
  COLUMN_DISPLAY_INVALID: 'Invalid display column',
  COLUMN_DISPLAY_NOT_FOUND: 'Display column not found: {{column}}',

  // ── custom-tables: query (filter / sort / aggregate / group) ────────────
  FILTER_INVALID: 'Invalid filter',
  FILTER_FORMAT_INVALID: 'Invalid filters format',
  FILTER_JSON_INVALID: 'Invalid JSON in filters',
  FILTER_TOO_MANY: 'Too many filters',
  FILTER_COLUMN_NOT_FOUND: 'Filter column not found: {{column}}',
  FILTER_OPERATOR_UNKNOWN: 'Unknown filter operator: {{operator}}',
  FILTER_OPERATOR_UNSUPPORTED: 'Operator {{operator}} is not supported for type {{type}}',
  FILTER_BETWEEN_UNSUPPORTED: 'The between operator is not supported for type {{type}}',
  SORT_INVALID: 'Invalid sort',
  SORT_FORMAT_INVALID: 'Invalid sort format',
  SORT_JSON_INVALID: 'Invalid JSON in sort',
  SORT_DIRECTION_INVALID: 'Sort direction must be asc or desc',
  SORT_COLUMN_NOT_FOUND: 'Sort column not found: {{column}}',
  AGG_INVALID: 'Invalid aggregate',
  AGG_FORMAT_INVALID: 'Invalid aggs format',
  AGG_JSON_INVALID: 'Invalid JSON in aggs',
  AGG_TOO_MANY: 'Too many aggregates',
  AGG_COLUMN_NOT_FOUND: 'Aggregate column not found: {{column}}',
  AGG_FUNCTION_UNKNOWN: 'Unknown aggregate function: {{fn}}',
  AGG_FUNCTION_UNSUPPORTED: 'Function {{fn}} is not supported for type {{type}}',
  AGG_TOTAL_FUNCTION_UNKNOWN: 'Unknown total function on column {{column}}: {{fn}}',
  GROUP_COLUMN_REQUIRED: 'No grouping column specified',
  GROUP_COLUMN_NOT_FOUND: 'Grouping column not found: {{column}}',
  DUPLICATE_KEY_COLUMNS_REQUIRED: 'No columns specified for duplicate detection',
  DUPLICATE_KEY_TOO_MANY_COLUMNS: 'Too many columns in the key',

  // ── custom-tables: views, rules, comments, shares, schedules ────────────
  VIEW_NOT_FOUND: 'Custom view not found',
  VIEW_EMPTY: 'This custom view has no records',
  VIEW_ID_DUPLICATE: 'Duplicate view identifier: {{id}}',
  VIEW_ACTIVE_MISSING: 'The active view is not in the list',
  RULE_TARGET_INVALID: 'A rule must target cell or row',
  RULE_COLUMN_NOT_FOUND: 'Rule column not found: {{column}}',
  COMMENT_NOT_FOUND: 'Comment not found',
  COMMENT_EMPTY: 'Comment is empty',
  COMMENT_TOO_LONG: 'Comment is too long',
  SHARE_LINK_NOT_FOUND: 'Link not found',
  SHARE_LINK_REVOKED: 'Link has been revoked',
  SHARE_LINK_EXPIRED: 'Link has expired',
  SCHEDULE_NOT_FOUND: 'Schedule not found',
  JOB_NOT_FOUND: 'Job not found',

  // ── custom-tables: import / export / sync ───────────────────────────────
  EXPORT_NO_COLUMNS: 'No columns to export',
  EXPORT_TOO_MANY_ROWS:
    'Too many rows to export: {{total}}. Narrow the selection with filters (maximum {{max}}).',
  EXPORT_FILE_NOT_READY: 'The generated file is not ready yet',
  EXPORT_FILE_UNAVAILABLE: 'The export file is unavailable',
  IMPORT_COLUMN_REQUIRED: 'Select at least one column to import',
  IMPORT_USER_UNRESOLVED: 'Could not determine the user for the import',
  IMPORT_NO_ROWS: 'No rows to import',
  SYNC_SOURCE_REQUIRED: 'Specify a synchronisation source first',
  SYNC_SOURCE_NOT_CONFIGURED: 'The table has no synchronisation source configured',
  SYNC_TYPE_REQUIRED: 'No synchronisation type specified',
  SYNC_COLUMNS_NOT_FOUND: 'Columns to synchronise were not found: {{columns}}',
  DATA_ENTRY_EMPTY: 'No “Data entry” records to build a table from',

  // ── workspaces ──────────────────────────────────────────────────────────
  WORKSPACE_NOT_FOUND: 'Workspace not found',
  WORKSPACE_OWNER_NOT_FOUND: 'Workspace owner not found',
  WORKSPACE_NOT_A_MEMBER: 'You are not a member of this workspace',
  WORKSPACE_ONLY_OWNER_CAN_DELETE: 'Only the owner can delete the workspace',
  WORKSPACE_ONLY_OWNER_CAN_MANAGE_ADMINS: 'Only the owner can manage administrators',
  WORKSPACE_ONLY_OWNER_CAN_MANAGE_ADMINS_AND_OWNER:
    'Only the owner can manage administrators and ownership',
  WORKSPACE_ONLY_OWNER_CAN_TRANSFER: 'Only the current owner can transfer ownership',
  WORKSPACE_ADMIN_REQUIRED_TO_INVITE: 'Only the owner or an administrator can invite members',
  WORKSPACE_ADMIN_REQUIRED_TO_EDIT_SETTINGS:
    'Only the owner or an administrator can change settings',
  WORKSPACE_TRANSFER_OWNERSHIP_FIRST: 'Transfer ownership to another member first',
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

  // ── ledger ────────────────────────────────────────────────────────────────
  LEDGER_DISABLED: 'The ledger is not enabled for this workspace',
  LEDGER_ENTRY_NOT_FOUND: 'Journal entry not found',
  LEDGER_ENTRY_NOT_DRAFT: 'A posted journal entry cannot be changed; reverse it instead',
  LEDGER_ENTRY_TOO_FEW_LINES: 'A journal entry needs at least two lines',
  LEDGER_ENTRY_UNBALANCED: 'Debits and credits differ by {{difference}} {{currency}}',
  LEDGER_ENTRY_NOT_REVERSIBLE: 'Only a posted entry that is not itself a reversal can be reversed',
  LEDGER_ACCOUNT_NOT_FOUND: 'Ledger account not found',
  LEDGER_ACCOUNT_SYSTEM_LOCKED: 'System accounts keep their code and parent and cannot be deleted',
  LEDGER_ACCOUNT_PARENT_NOT_FOUND: 'Parent account not found',
  LEDGER_ACCOUNT_PARENT_TYPE: 'Parent account must be of the same type',
  LEDGER_ACCOUNT_PARENT_NOT_HEADER: 'Parent account must be a section header',
  LEDGER_ACCOUNT_CYCLE: 'An account cannot be moved under its own sub-account',
  LEDGER_ACCOUNT_HAS_CHILDREN: 'Move or delete the sub-accounts first',
  LEDGER_ACCOUNT_HAS_LINES: 'The account has journal lines and cannot be deleted',
  LEDGER_ACCOUNT_HAS_CATEGORIES: 'Categories book to this account; map them elsewhere first',
  LEDGER_ACCOUNT_CODE_TAKEN: 'Account code {{code}} is already in use',
  LEDGER_ACCOUNT_NOT_POSTABLE: 'Account {{code}} is a section header and takes no lines',
  LEDGER_ACCOUNT_CURRENCY_MISMATCH: 'Account {{code}} only takes lines in {{currency}}',
  LEDGER_LINE_REFERENCE_NOT_FOUND:
    'Line {{line}} refers to a category or branch not in this workspace',
  LEDGER_FX_RATE_MISSING: 'No {{from}} to {{to}} exchange rate for {{date}}',
  LEDGER_NOT_UP_TO_DATE:
    '{{pending}} transactions are still waiting to be booked; the report would be incomplete',
  LEDGER_BASE_CURRENCY_LOCKED:
    'The ledger already has entries in {{currency}}; its base currency can no longer change',
  LEDGER_REVALUATION_FUTURE: 'Balances cannot be revalued at a future date',
  LEDGER_REVALUATION_BACKDATED:
    'Balances were already revalued on {{date}}; revalue on that day or later',

  // Payables
  PAYABLE_PAYMENT_NOT_POSITIVE: 'A payment must be more than zero',
  PAYABLE_PAYMENT_EXCEEDS_OUTSTANDING:
    'That is more than the {{outstanding}} still outstanding on this bill',
  PAYABLE_PAYMENT_NOT_FOUND: 'Payment not found',
  PAYABLE_PAYMENT_AMBIGUOUS: 'Link a transaction or pay from a wallet, not both',
  PAYABLE_WALLET_NOT_FOUND: 'Wallet not found in this workspace',
  PAYABLE_WALLET_CURRENCY_MISMATCH:
    'The wallet holds {{walletCurrency}}; the bill is in {{currency}}',
  PAYABLE_ALREADY_LINKED: 'This bill is already linked to a transaction',
  PAYABLE_CATEGORY_NOT_FOUND: 'Category not found in this workspace',

  // ── invoices ─────────────────────────────────────────────────────────────
  INVOICE_NOT_DRAFT: 'Only a draft invoice can be edited',
  INVOICE_ALREADY_SENT: 'This invoice was already sent',
  INVOICE_ZERO_TOTAL: 'An invoice with no line items cannot be sent',
  INVOICE_NOT_VOIDABLE: 'A paid invoice cannot be voided',
  INVOICE_CLIENT_NOT_FOUND: 'Client not found in this workspace',
  INVOICE_PROFILE_INCOMPLETE:
    'Fill in your business details before sending an invoice (missing: {{fields}})',
  INVOICE_NOT_SENT_YET: 'Issue the invoice before emailing it',
  INVOICE_NO_RECIPIENT: 'This client has no email address, and none was given',

  // ── credit notes ─────────────────────────────────────────────────────────
  CREDIT_NOTE_INVOICE_NOT_CREDITABLE: 'Only an issued invoice can be credited',
  CREDIT_NOTE_EXCEEDS_INVOICE:
    'Invoice {{number}} has only {{creditable}} left that can be credited',
  CREDIT_NOTE_MIXED_CLIENTS: 'One credit note covers the invoices of one client',
  CREDIT_NOTE_MIXED_CURRENCIES: 'One credit note covers invoices in one currency',
  CREDIT_NOTE_ZERO_TOTAL: 'A credit note must credit more than zero',
  CREDIT_NOTE_ALREADY_VOID: 'This credit note is already void',
} as const;

export type ErrorCode = keyof typeof ERR;

const interpolate = (template: string, params: Record<string, string | number>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));

export type AppErrorBody = {
  code: ErrorCode;
  message: string;
  params?: Record<string, string | number>;
};

/**
 * Builds the body for a Nest HttpException so the global filter can emit a
 * machine-readable `code` alongside the English `message`.
 *
 * @example throw new NotFoundException(appError('TABLE_NOT_FOUND'))
 * @example throw new BadRequestException(appError('COLUMN_NOT_FOUND_NAMED', { column: key }))
 */
export const appError = (
  code: ErrorCode,
  params?: Record<string, string | number>,
): AppErrorBody => ({
  code,
  message: params ? interpolate(ERR[code], params) : ERR[code],
  ...(params ? { params } : {}),
});

export const isAppErrorBody = (value: unknown): value is AppErrorBody =>
  typeof value === 'object' &&
  value !== null &&
  'code' in value &&
  typeof (value as AppErrorBody).code === 'string' &&
  (value as AppErrorBody).code in ERR;
