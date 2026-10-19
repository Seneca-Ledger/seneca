/**
 * Peppol participant ids: `scheme:value`, the scheme a four-digit ISO 6523 /
 * EAS code (Peppol code list "Participant identifier schemes" v9.7).
 */

export interface PeppolId {
  scheme: string;
  value: string;
}

/** The id as `scheme:value`, or NULL when it is not one. */
export function parsePeppolId(raw: string | null | undefined): PeppolId | null {
  const match = /^\s*(\d{4})\s*:\s*(\S.*?)\s*$/.exec(raw ?? '');
  if (!match) {
    return null;
  }
  return { scheme: match[1], value: match[2].replace(/\s+/g, '') };
}

export const formatPeppolId = (id: PeppolId) => `${id.scheme}:${id.value}`;

/** Leitweg-ID of a German public authority (scheme 0204). */
export const LEITWEG_SCHEME = '0204';

/**
 * The id a business is most likely registered under, from its VAT id: the
 * VAT-number schemes of the countries that have one in the code list, and
 * Belgium's enterprise number, which its VAT number carries. Only a guess to
 * prefill the field — a lookup on the network decides.
 */
export function suggestPeppolId(vatId: string | null | undefined): string | null {
  const vat = (vatId ?? '').replace(/[\s.-]+/g, '').toUpperCase();
  const country = vat.slice(0, 2);
  const scheme: Record<string, string> = {
    DE: '9930',
    AT: '9914',
    NL: '9944',
    FR: '9957',
    ES: '9920',
    IT: '0211',
  };
  if (country === 'BE' && /^BE[01]\d{9}$/.test(vat)) {
    return `0208:${vat.slice(2)}`;
  }
  return scheme[country] && vat.length > 4 ? `${scheme[country]}:${vat}` : null;
}
