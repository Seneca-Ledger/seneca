/**
 * Words that make a counterparty a business, a payment app or the bank's own
 * wording rather than a person. Banks cut names short ("NAVI TECHNOLOGIES LIM",
 * "EMPLOYEE PROVIDENT FUND ORGA"), so truncated forms are listed too.
 */
const NOT_A_PERSON = new Set(
  [
    // Company forms
    'ltd limited lim pvt private llp llc inc corp corporation co company gmbh ag sa sas srl',
    'bv nv plc oy ab kg group holdings international global trust society foundation',
    'association organisation organization orga govt government municipal',
    // Business words
    'bank services service enterprises enterprise traders trading store stores shop mart',
    'market supermarket tech technologies technology solutions industries foods food',
    'motors transport logistics infotech infosystems systems insurance finance financial',
    'capital fund hotel restaurant cafe pharmacy medical hospital clinic school college',
    'university electricity gas water telecom mobile communications network online',
    'digital india agency studio centre center',
    // Payment apps and rails: they sit next to a person's name, never are one
    'paytm phonepe gpay googlepay bhim cred razorpay payu cashfree mobikwik amazonpay',
    'upi neft imps rtgs ach nach ecs atm pos card txn transfer payment pay recharge',
    'recharges prepaid cash free',
    // Cyrillic company forms and businesses
    'тоо ип ооо ао оао зао пао гкп кгп банк магазин аптека',
  ]
    .join(' ')
    .split(' '),
);

/**
 * Whether a counterparty reads like a person's name: two to four words of
 * letters (initials allowed), no digits, none of them a business or payment
 * word. A bank-truncated name ("MAMTA KUM") still passes; a single word
 * ("INNOVATIV", "RITADAS") does not, since a shop is as likely as a person.
 */
export function looksLikePerson(name: string): boolean {
  const cleaned = name.replace(/[.,]+$/u, '').trim();
  if (!cleaned || /\d/u.test(cleaned)) {
    return false;
  }
  const words = cleaned.split(/\s+/u);
  if (words.length < 2 || words.length > 4) {
    return false;
  }
  if (!words.every(word => /^\p{L}+\.?$/u.test(word))) {
    return false;
  }
  if (!words.some(word => word.replace('.', '').length >= 3)) {
    return false;
  }
  return !words.some(word => NOT_A_PERSON.has(word.replace('.', '').toLowerCase()));
}

/** A rail's reference segment ("328419326312", "AXOMB40137016101"): six digits or more. */
const isReference = (segment: string): boolean => (segment.match(/\d/gu) ?? []).length >= 6;

/**
 * The person a counterparty names. A plain name is taken as it is. In a rail
 * descriptor such as "UPI/P2A/328419326312/MEMBER ONE/Paytm Pay/Payment" only
 * the part right after the reference is the payee; the parts after it name
 * the payer's bank or app, which a cut-off can make look like a name ("ICICI
 * Ban"), so they are never read.
 */
export function personNameIn(descriptor: string): string | null {
  if (!descriptor.includes('/')) {
    return looksLikePerson(descriptor) ? descriptor.trim() : null;
  }
  const parts = descriptor.split('/').map(part => part.trim());
  const reference = parts.findIndex(isReference);
  const name = reference === -1 ? undefined : parts[reference + 1];
  return name && looksLikePerson(name) ? name : null;
}
