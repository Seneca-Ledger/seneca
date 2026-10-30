import { APP_NAME } from '../../brand';

/** Error codes and English messages: accounting. Gathered into ERR in ../app-error.ts. */
export const ACCOUNTING_ERRORS = {
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

  // Accounts (wallets)
  WALLET_STATEMENT_NOT_FOUND: 'Statement not found in this workspace',
  WALLET_STATEMENT_CURRENCY_MISMATCH:
    'The account holds {{walletCurrency}}; the statement is in {{currency}}',
  WALLET_NOT_FOUND: 'Account not found in this workspace',
  TRANSFER_SAME_ACCOUNT: 'The transaction is already in this account',
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
  PAYABLE_PAID_THROUGH_PAYMENT:
    'Mark it paid instead: choose the wallet or the bank transaction the money went through',
  PAYABLE_BOOK_NEEDS_SOURCE: 'Choose the bank transaction or the wallet the money went into',
  PAYABLE_PAYMENT_SHORT:
    'That transaction is less than what is still owed; record it as a partial payment',
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
  // ── Peppol ───────────────────────────────────────────────────────────────
  PEPPOL_NOT_CONNECTED: 'Connect a Peppol access point under Integrations first',
  PEPPOL_AUTH_FAILED: 'The access point did not accept this API key and secret',
  PEPPOL_COMPANY_REQUIRED:
    'Your access point account has several companies; enter the id of the one to send as ({{companies}})',
  PEPPOL_COMPANY_NOT_FOUND: 'The access point account has no company with this id',
  PEPPOL_COMPANY_MISSING: 'Create and verify your company in the access point account first',
  PEPPOL_ID_INVALID:
    'A Peppol id is a four-digit scheme, a colon and the number, e.g. 9930:DE123456789',
  PEPPOL_UNAVAILABLE: 'The access point could not be reached; try again later',
  PEPPOL_REJECTED: 'The access point refused the document: {{reason}}',
  PEPPOL_DOCUMENT_INCOMPLETE: 'The document lacks what Peppol requires',
  PEPPOL_RECIPIENT_UNKNOWN: '{{recipient}} is not registered on the Peppol network',
  PEPPOL_RECIPIENT_FORMAT: `{{recipient}} accepts none of the formats ${APP_NAME} writes (Peppol BIS 3.0, XRechnung CII)`,
  PEPPOL_LEITWEG_MISMATCH:
    'An authority addressed by Leitweg-ID {{leitweg}} needs that id as the buyer reference',
  PEPPOL_ALREADY_SENT: 'This document was already sent over Peppol',
  PEPPOL_NOT_ISSUED: 'Only an issued document can be sent over Peppol',
  // ── credit notes ─────────────────────────────────────────────────────────
  CREDIT_NOTE_INVOICE_NOT_CREDITABLE: 'Only an issued invoice can be credited',
  CREDIT_NOTE_EXCEEDS_INVOICE:
    'Invoice {{number}} has only {{creditable}} left that can be credited',
  CREDIT_NOTE_MIXED_CLIENTS: 'One credit note covers the invoices of one client',
  CREDIT_NOTE_MIXED_CURRENCIES: 'One credit note covers invoices in one currency',
  CREDIT_NOTE_ZERO_TOTAL: 'A credit note must credit more than zero',
  CREDIT_NOTE_ALREADY_VOID: 'This credit note is already void',
  // ── tax ─────────────────────────────────────────────────────────────────
  TAX_LOCKED:
    'Transactions on a filed tax return: {{count}}. Reopen the return before deleting or changing them.',
  TAX_RETURN_MISSING_RATES:
    'Transactions without an exchange rate for their date: {{count}} ({{currencies}}). Add the rates before filing.',

  INSTANCE_ADMIN_ONLY: 'Only an instance administrator can change this',
  // ── ledger (additions) ──────────────────────────────────────────────────
  LEDGER_CASH_ACCOUNT_CODE_TAKEN: 'Cash account code {{code}} is taken by another account',
  LEDGER_LINE_AMOUNT_NOT_POSITIVE: 'Line amounts must be greater than zero',
  LEDGER_INVOICE_ZERO_AMOUNT: 'Cannot post a zero-amount invoice to the ledger',
  LEDGER_CREDIT_NOTE_ZERO_AMOUNT: 'Cannot post a zero-amount credit note to the ledger',
  LEDGER_REPORT_RANGE_INVALID: 'dateFrom must not be after dateTo',
  // ── payables (additions) ────────────────────────────────────────────────
  PAYABLE_NOT_FOUND: 'Payable not found',
  PAYABLE_TRANSACTION_NOT_FOUND: 'Transaction not found in workspace',
  PAYABLE_LINKED_TRANSACTION_NOT_FOUND: 'Linked transaction not found in workspace',
  PAYABLE_STATEMENT_NOT_FOUND: 'Statement not found in workspace',
  // ── smb (invoice reminders) ─────────────────────────────────────────────
  SMB_INVOICE_NOT_FOUND: 'Invoice not found',
  SMB_REMINDER_INVOICE_STATUS: 'Only a sent or overdue invoice can be reminded about',
  SMB_CLIENT_NO_EMAIL: 'The client has no email address',
  SMB_SMTP_NOT_CONFIGURED: 'SMTP is not configured for this workspace',
  // ── tax ─────────────────────────────────────────────────────────
  TAX_SET_ASIDE_SHARE_INVALID: 'The share to set aside must be between 0 and 100',
  TAX_PAYMENTS_CATEGORY_NOT_IN_WORKSPACE:
    'The tax payments category does not belong to this workspace',
  TAX_RULE_DUPLICATE: 'A rule for this category and direction already exists. Edit it instead.',
  TAX_RETURN_NO_JURISDICTION:
    'This workspace has no tax jurisdiction. Pick a country before building a return.',
  TAX_RETURN_PERIOD_INVALID: 'Period end must not be before period start',
  TAX_RETURN_ALREADY_FILED: 'This period has already been filed',
  TAX_RETURN_NOT_FILED: 'This period is not filed',
  TAX_RATE_NAME_REQUIRED: 'Tax rate name is required',
  TAX_RATE_NAME_TAKEN: 'Tax rate with this name already exists',
  TAX_RATE_NOT_IN_FORCE: 'The rate is not in force on that date',
  TAX_VAT_DIFFERENCE_GONE: 'This difference is no longer there',
  TAX_VAT_DIFFERENCE_NOT_AUTO: 'This difference cannot be applied automatically',
  TAX_NO_COUNTRY: 'The workspace has no tax country',
  TAX_NO_STANDARD_RATE: 'No standard rate is in force on that date',
  TAX_JURISDICTION_NOT_FOUND: 'Tax jurisdiction not found',
  TAX_USTVA_PERIOD_FORMAT: 'periodStart and periodEnd must be YYYY-MM-DD',
  TAX_PERIOD_END_BEFORE_START: 'The period must not end before it starts',
  TAX_CATEGORIES_NOT_IN_WORKSPACE: 'One or more categories do not belong to this workspace',
  TAX_RATE_NOT_FOUND: 'Tax rate not found',
  TAX_DISCLAIMER_REQUIRED: 'Accept the current tax-declaration disclaimer first.',
  TAX_JURISDICTION_REQUIRED:
    'This workspace has no tax country. Pick one in the workspace settings first.',
  TAX_JURISDICTION_CODE_NOT_FOUND: "Tax jurisdiction '{{code}}' not found",
  TAX_RULE_RATE_CODE_UNKNOWN:
    "No tax rate with code '{{code}}' in this workspace. Pick a country first, or use a code from GET /tax/settings/rates.",
  // ── tax-pack ────────────────────────────────────────────────────
  TAX_PACK_PERIOD_TOO_LONG: 'A tax pack covers at most three years',
  // ── income-tax ──────────────────────────────────────────────────
  INCOME_TAX_EXPORT_FORMAT_INVALID: "Format must be 'pdf', 'xlsx' or 'csv'",
  INCOME_TAX_YEAR_FINALIZED: 'This tax year has already been finalized',
  INCOME_TAX_YEAR_NOT_FINALIZED: 'This tax year is not finalized',
  INCOME_TAX_YEAR_INVALID: 'taxYear must be a year between {{min}} and {{max}}',
  INCOME_TAX_LINE_UNKNOWN: "Unknown line '{{line}}' for form {{form}}",
  // ── datev ───────────────────────────────────────────────────────
  DATEV_BANK_ACCOUNT_INVALID: 'A bank account must be 1–9 digits',
  DATEV_SETTINGS_MISSING:
    'Enter the adviser number (Beraternummer) and client number (Mandantennummer) first',
  DATEV_PERIOD_TOO_LONG: 'A DATEV file covers one calendar year at most',
  DATEV_CATEGORY_ACCOUNT_INVALID: 'Account for category {{categoryId}} must be 1–9 digits',
  DATEV_TOO_MANY_BOOKINGS: 'DATEV takes at most {{max}} bookings per file; export a shorter period',
  // ── investments ─────────────────────────────────────────────────
  INVESTMENTS_SECTION_NOT_FOUND: 'Investments section not found',
  INVESTMENTS_ACCOUNT_NOT_FOUND: 'Investment account not found',
  INVESTMENTS_HOLDING_NAME_REQUIRED: 'A holding needs a name or a symbol',
  INVESTMENTS_TRANSACTION_NOT_FOUND: 'Transaction not found',
  INVESTMENTS_CONTRIBUTION_NOT_EXPENSE: 'Only an expense can be a contribution',
  INVESTMENTS_ROW_ALREADY_TRANSFER: 'This row is already linked as a transfer',
  INVESTMENTS_ROW_NOT_CONTRIBUTION: 'This row is not a contribution',
  INVESTMENTS_EXPENSE_ONLY_CONTRIBUTION: 'An expense can only be a contribution',
  INVESTMENTS_INCOME_ROLE_REQUIRED: 'Say whether this income is a withdrawal or a dividend',
  INVESTMENTS_HOLDING_NOT_FOUND: 'Holding not found',
  // ── metals ──────────────────────────────────────────────────────
  METALS_LOT_METAL_REQUIRED: 'A lot needs a metal',
  METALS_WEIGHT_REQUIRED: 'A lot needs the weight of one piece',
  METALS_LOT_PIECES_REQUIRED: 'A lot needs at least one piece',
  METALS_SALE_PIECES_REQUIRED: 'A sale needs at least one piece',
  METALS_SALE_EXCEEDS_LOT: 'The lot does not hold that many pieces',
  METALS_RECEIPT_NOT_FOUND: 'Receipt not found',
  METALS_MEMBER_NOT_FOUND: 'Workspace member not found',
  METALS_LOT_NOT_FOUND: 'Metal lot not found',
  METALS_PHOTO_NOT_UPLOADED: 'No photo uploaded',
  // ── invoices ────────────────────────────────────────────────────
  INVOICE_NOT_FOUND: 'Invoice not found',
  INVOICE_RECURRING_NO_NEXT_DATE: 'Recurring invoice has no next issue date',
  INVOICE_PDF_NOT_FOUND: 'Invoice PDF not found',
  // ── credit notes ────────────────────────────────────────────────
  CREDIT_NOTE_NOT_FOUND: 'Credit note not found',
  CREDIT_NOTE_PDF_NOT_FOUND: 'Credit note PDF not found',
  // ── xrechnung ───────────────────────────────────────────────────
  XRECHNUNG_INCOMPLETE: 'The document lacks what an XRechnung requires',
  // ── peppol ──────────────────────────────────────────────────────
  PEPPOL_TRANSMISSION_NOT_FOUND: 'Peppol transmission not found',
  // ── crypto ──────────────────────────────────────────────────────
  CRYPTO_ADDRESS_NETWORK_MISMATCH: 'The address does not belong to the selected network',
  CRYPTO_ADDRESS_ALREADY_CONNECTED: 'This address is already connected to the workspace',
  CRYPTO_AMOUNT_NOT_POSITIVE: 'An amount is a positive number',
  CRYPTO_WALLET_NOT_FOUND: 'Crypto wallet not found',
  CRYPTO_HOLDING_NOT_FOUND: 'Holding not found',
  CRYPTO_MANUAL_HOLDING_NO_CHAIN: 'A manual holding has no chain to sync',
  CRYPTO_TICKER_INVALID: 'Not a ticker',
  CRYPTO_ICON_NOT_FOUND: 'No icon for this asset',
  CRYPTO_ICONS_UNAVAILABLE: 'Coin icons are unavailable',
  CRYPTO_FILE_NOT_PROVIDED: 'No file provided',
  CRYPTO_IMPORT_UNSUPPORTED_FILE: 'This file is not a Coinbase, Binance or Kraken history export',
  CRYPTO_IMPORT_EMPTY: 'The file holds no coin movements',
} as const;
