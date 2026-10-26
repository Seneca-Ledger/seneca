import { createSign } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { Schema } from 'effect';
import { appError } from '../../common/errors/app-error';
import type { BankSyncTransaction } from './bank-sync-provider.interface';

// Every field is optional and nullable: bank data is uneven, and the mappers
// decide what a usable row is.
const Text = Schema.optional(Schema.NullOr(Schema.String));
const Named = Schema.optional(Schema.NullOr(Schema.Struct({ name: Text })));

export const EnableBankingTransaction = Schema.Struct({
  entry_reference: Text,
  transaction_id: Text,
  transaction_amount: Schema.optional(
    Schema.NullOr(Schema.Struct({ currency: Text, amount: Text })),
  ),
  creditor: Named,
  debtor: Named,
  credit_debit_indicator: Text,
  status: Text,
  booking_date: Text,
  value_date: Text,
  transaction_date: Text,
  remittance_information: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
});
export type EnableBankingTransaction = typeof EnableBankingTransaction.Type;

export const EnableBankingSession = Schema.Struct({
  session_id: Text,
  accounts: Schema.optional(
    Schema.NullOr(
      Schema.Array(
        Schema.Struct({
          uid: Text,
          name: Text,
          currency: Text,
          account_id: Schema.optional(Schema.NullOr(Schema.Struct({ iban: Text }))),
          account_servicer: Named,
        }),
      ),
    ),
  ),
  aspsp: Schema.optional(Schema.NullOr(Schema.Struct({ name: Text, country: Text }))),
  access: Schema.optional(Schema.NullOr(Schema.Struct({ valid_until: Text }))),
});

export const EnableBankingBalances = Schema.Struct({
  balances: Schema.optional(
    Schema.NullOr(
      Schema.Array(
        Schema.Struct({
          balance_type: Text,
          balance_amount: Schema.optional(Schema.NullOr(Schema.Struct({ amount: Text }))),
          reference_date: Text,
        }),
      ),
    ),
  ),
});

/** Rows are decoded one by one, so one malformed row does not sink the account. */
export const EnableBankingTransactionPage = Schema.Struct({
  transactions: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),
  continuation_key: Text,
});

export const EnableBankingInstitution = Schema.Struct({
  name: Schema.String,
  country: Text,
  maximum_consent_validity: Schema.optional(Schema.NullOr(Schema.Number)),
  beta: Schema.optional(Schema.NullOr(Schema.Boolean)),
});

/** `/aspsps` answers either a bare list or `{ aspsps: [...] }`. */
export const EnableBankingInstitutions = Schema.Union([
  Schema.Array(Schema.Unknown),
  Schema.Struct({ aspsps: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))) }),
]);

/**
 * SEPA structured remittance prefixes (`EREF+invoice-42`). They address
 * clearing systems, not people, so they are stripped off the front of each
 * line. An allowlist rather than `[A-Z]{3,}\+`, so a merchant that genuinely
 * starts with `BMW+` keeps its name.
 */
const SEPA_PREFIX_RE =
  /^(?:EREF|KREF|MREF|CRED|DBTR|CDTR|SVWZ|SVCL|PURP|RTRN|REJT|REFE|SDVA|INDA|NTAV|ULTC|ULTD|ULTB|ABWA|ABWE|IBAN|BIC|COAM|OAMT|REMI|SQTP|ROC)\+/;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The JWT every call carries: RS256 over the application's own key. */
export function signJwt(secrets: Record<string, string>, now = Date.now()): string {
  const applicationId = secrets.applicationId;
  const privateKey = secrets.privateKey;
  if (!(applicationId && privateKey)) {
    throw new BadRequestException(appError('BANK_SYNC_ENABLEBANKING_CREDENTIALS_MISSING'));
  }
  const issued = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: applicationId }));
  const payload = base64url(
    JSON.stringify({
      iss: 'enablebanking.com',
      aud: 'api.enablebanking.com',
      iat: issued,
      exp: issued + 3600,
    }),
  );
  let signature: Buffer;
  try {
    signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey);
  } catch {
    throw new BadRequestException(appError('BANK_SYNC_ENABLEBANKING_KEY_INVALID'));
  }
  return `${header}.${payload}.${base64url(signature)}`;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function stripSepaPrefix(line: string): string {
  return line.replace(SEPA_PREFIX_RE, '').trim();
}

/**
 * Maps one ISO 20022 entry onto a provider row.
 *
 * The payee is whichever party is not the account holder, which is why the
 * credit/debit indicator decides: reading `creditor` for a card payment that
 * has none would label the row with the account holder's own name.
 */
export function normalizeTransaction(raw: EnableBankingTransaction): BankSyncTransaction | null {
  const id = raw.entry_reference || raw.transaction_id;
  const posted = raw.booking_date || raw.value_date || raw.transaction_date;
  const rawAmount = (raw.transaction_amount?.amount ?? '').trim();
  // A row with no date or a non-numeric amount cannot be imported, and must not
  // take the rest of the account down with it.
  if (!id || !posted || !ISO_DATE_RE.test(posted) || rawAmount === '') return null;
  const magnitude = Number(rawAmount.replace(/^[+-]/, ''));
  if (!Number.isFinite(magnitude)) return null;

  const lines = (raw.remittance_information ?? []).map(stripSepaPrefix).filter(Boolean);
  let payee = '';
  if (raw.credit_debit_indicator === 'CRDT' && raw.debtor?.name) payee = raw.debtor.name;
  else if (raw.credit_debit_indicator === 'DBIT' && raw.creditor?.name) payee = raw.creditor.name;
  else payee = raw.creditor?.name || raw.debtor?.name || lines[0] || '';

  const signed =
    raw.credit_debit_indicator === 'DBIT'
      ? -magnitude
      : raw.credit_debit_indicator === 'CRDT'
        ? magnitude
        : Number(rawAmount);

  const description = lines.join(' ') || payee;
  return {
    id,
    posted: new Date(`${posted}T00:00:00.000Z`),
    amount: signed,
    description,
    payee: payee || undefined,
    memo: description !== payee ? description : undefined,
    // A bank that does not say treats everything as booked; the booked/pending
    // split is the bank's, not ours to guess.
    pending: raw.status === 'PDNG',
  };
}
