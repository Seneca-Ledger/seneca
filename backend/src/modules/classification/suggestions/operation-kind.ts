import type { SystemCategoryKey } from '../../categories/system-categories';
import { personNameIn } from './person-name';

export type KindRow = {
  counterpartyName?: string | null;
  paymentPurpose?: string | null;
  counterpartyAccount?: string | null;
};

/** What a workspace knows about itself, to tell its own moves from payments to others. */
export type KindContext = {
  /** Last four digits of the workspace's own account numbers. */
  ownAccountTails: readonly string[];
  /** Members' names, lower-cased words. */
  memberNames: ReadonlyArray<readonly string[]>;
};

export type DetectedKind = {
  key: SystemCategoryKey;
  /** `strong`: the descriptor says so outright; `weak`: a rail plus a person-like name. */
  strength: 'strong' | 'weak';
  reason: 'p2p' | 'p2p_in' | 'cash' | 'salary';
};

/** A pattern bounded by non-letters, so it works for "überweisung" and Cyrillic too. */
const word = (source: string): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, 'iu');

const CASH = [
  word(String.raw`atm[\s/-]*(cash|wdl|withdrawal)`),
  // Canada: an ATM is an "ABM", and an Interac withdrawal is taken at one.
  word(String.raw`abm[\s/-]*(cash|wdl|withdrawal)`),
  word(String.raw`withdrawal\s+interac|interac\s+withdrawal`),
  word(String.raw`cash\s*(wdl|withdrawal)`),
  word('bargeldauszahlung|bargeldabhebung|geldautomat|geldautomaat|geldopname'),
  word(String.raw`(снятие|выдача)\s+наличных`),
  word('қолма-қол'),
];

const SALARY = [
  word('salary'),
  word(String.raw`sal\s+(cr|credit)`),
  word('payroll'),
  word('wages?'),
  word('gehalt|lohn'),
  word('salaris(betaling)?'),
  word(String.raw`зарплат\p{L}*|заработн\p{L}*\s+плат\p{L}*`),
  word(String.raw`жалақы\p{L}*`),
];

/** A payment to a person's account (India's UPI "P2A", US person-to-person apps). */
const PERSON_RAIL_STRONG = [
  word('upi/p2a'),
  new RegExp(
    String.raw`${word(String.raw`zelle|venmo|cash\s*app`).source}.*${word('to').source}`,
    'iu',
  ),
];
/** A merchant payment on the same rail: never a person. */
const MERCHANT_RAIL = word('upi/p2m');
const PERSON_RAIL_WEAK = [
  word('neft|imps|rtgs'),
  word(String.raw`überweisung|dauerauftrag|faster\s+payment|standing\s+order`),
  word(String.raw`sepa[\s-]*(credit\s+transfer|überweisung)`),
  word(String.raw`перевод\p{L}*|аударым\p{L}*`),
];
/** "Zelle payment to Member Two": the person after a trailing "to". */
const RECIPIENT = /(?<![\p{L}\p{N}])to\s+(\p{L}+\.?(?:\s+\p{L}+\.?){1,3})\s*$/iu;
/** Money moved between the owner's own accounts. */
const OWN_MOVE = word(
  String.raw`own\s+account|self\s+transfer|eigenes?\s+konto|между\s+своими|собственных\s+средств|өз\s+шот\p{L}*`,
);

function isOwn(row: KindRow, name: string, ctx: KindContext): boolean {
  const account = (row.counterpartyAccount ?? '').replace(/\D/gu, '');
  if (account.length >= 4 && ctx.ownAccountTails.includes(account.slice(-4))) {
    return true;
  }
  const words = name.toLowerCase().split(/\s+/u);
  // A member's first and last name both appear: the owner paying themselves.
  return ctx.memberNames.some(
    member => member.length >= 2 && member.every(part => words.includes(part)),
  );
}

/**
 * The kind of an operation, read off its descriptor: cash taken out, a salary
 * paid in, money sent to a person or received from one. Null when the
 * descriptor does not say.
 */
export function detectKind(
  row: KindRow,
  type: 'income' | 'expense',
  ctx: KindContext,
): DetectedKind | null {
  const text = `${row.counterpartyName ?? ''} ${row.paymentPurpose ?? ''}`;
  if (type === 'income' && SALARY.some(pattern => pattern.test(text))) {
    return { key: 'salary', strength: 'strong', reason: 'salary' };
  }
  if (type === 'expense' && CASH.some(pattern => pattern.test(text))) {
    return { key: 'cash', strength: 'strong', reason: 'cash' };
  }
  if (MERCHANT_RAIL.test(text) || OWN_MOVE.test(text)) {
    return null;
  }
  const strong = PERSON_RAIL_STRONG.some(pattern => pattern.test(text));
  if (!(strong || PERSON_RAIL_WEAK.some(pattern => pattern.test(text)))) {
    return null;
  }
  // The counterparty names the payee; the purpose only when there is none.
  const counterparty = (row.counterpartyName ?? '').trim() || (row.paymentPurpose ?? '');
  const name = personNameIn(counterparty) ?? personNameIn(RECIPIENT.exec(text)?.[1] ?? '');
  if (!name || isOwn(row, name, ctx)) {
    return null;
  }
  // Money from a person is other income; to a person, a transfer to people.
  return type === 'income'
    ? { key: 'other_income', strength: strong ? 'strong' : 'weak', reason: 'p2p_in' }
    : { key: 'transfers_people', strength: strong ? 'strong' : 'weak', reason: 'p2p' };
}
