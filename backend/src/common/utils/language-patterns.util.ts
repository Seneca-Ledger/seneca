/**
 * Comprehensive field synonym tables for 10+ languages
 * Supports multi-language statement parsing with unified field mapping
 */

interface FieldSynonyms {
  date: string[];
  amount: string[];
  debit: string[];
  credit: string[];
  description: string[];
  counterparty: string[];
  reference: string[];
  balance: string[];
  currency: string[];
  account: string[];
  transaction: string[];
  category: string[];
  status: string[];
  type: string[];
}

export interface LanguagePatterns {
  fieldSynonyms: FieldSynonyms;
  datePatterns: string[];
  numberPatterns: {
    decimal: RegExp;
    thousands: RegExp;
    currency: RegExp;
    negative: RegExp;
  };
  stopWords: string[];
  emptyValues: string[];
}

/**
 * Comprehensive synonym tables for 10+ languages
 */
const LANGUAGE_PATTERNS: Record<string, LanguagePatterns> = {
  // Russian
  ru: {
    fieldSynonyms: {
      date: ['дата', 'дат', 'date', 'дата операции', 'операция'],
      amount: ['сумма', 'сум', 'amount', 'сумма операции', 'значение'],
      debit: ['дебет', 'деб', 'debit', 'списание', 'расход'],
      credit: ['кредит', 'кред', 'credit', 'поступление', 'доход'],
      description: ['описание', 'опис', 'description', 'назначение', 'назн', 'комментарий'],
      counterparty: [
        'контрагент',
        'контр',
        'counterparty',
        'получатель',
        'плательщик',
        'бенефициар',
      ],
      reference: ['референс', 'реф', 'reference', 'документ', 'номер', 'код'],
      balance: ['остаток', 'баланс', 'balance', 'сальдо'],
      currency: ['валюта', 'вал', 'currency', 'код валюты'],
      account: ['счет', 'сч', 'account', 'номер счета', 'аккаунт'],
      transaction: ['транзакция', 'тр', 'transaction', 'операция'],
      category: ['категория', 'кат', 'category', 'тип операции'],
      status: ['статус', 'status', 'состояние'],
      type: ['тип', 'type', 'вид'],
    },
    datePatterns: [
      '\\d{2}[./-]\\d{2}[./-]\\d{4}', // DD.MM.YYYY
      '\\d{4}[./-]\\d{2}[./-]\\d{2}', // YYYY.MM.DD
      '\\d{1,2}\\s+(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\\s+\\d{4}',
    ],
    numberPatterns: {
      decimal: /[.,]/,
      thousands: /[,\s]/,
      currency: /[₽₸€$£¥]/,
      negative: /^[-—−]|[-−]$/,
    },
    stopWords: [
      'и',
      'в',
      'на',
      'с',
      'по',
      'для',
      'от',
      'до',
      'к',
      'об',
      'во',
      'со',
      'из',
      'без',
      'за',
      'под',
    ],
    emptyValues: ['н/у', 'н/д', '---', 'пусто', 'не указано', 'нет', 'n/a', 'none'],
  },

  // Kazakh
  kk: {
    fieldSynonyms: {
      date: ['күн', 'дата', 'дате', 'date', 'операция күні'],
      amount: ['сома', 'сан', 'amount', 'мөлшер', 'құны'],
      debit: ['дебет', 'деб', 'debit', 'шығын', 'төлем'],
      credit: ['кредит', 'кред', 'credit', 'кіріс', 'түсім'],
      description: ['сипаттама', 'описание', 'description', 'мақсаты', 'түсіндірме'],
      counterparty: ['қаржы алушы', 'контрагент', 'counterparty', 'алушы', 'төлеуші', 'бенефициар'],
      reference: ['сілтеме', 'референс', 'reference', 'құжат', 'нөмір', 'код'],
      balance: ['қалдық', 'баланс', 'balance', 'сальдо'],
      currency: ['валюта', 'вал', 'currency', 'валюта коды'],
      account: ['шот', 'счет', 'account', 'шот нөмірі', 'аккаунт'],
      transaction: ['транзакция', 'тр', 'transaction', 'операция'],
      category: ['санат', 'кат', 'category', 'операция түрі'],
      status: ['мәртебесі', 'status', 'жағдайы'],
      type: ['түрі', 'type', 'түр'],
    },
    datePatterns: [
      '\\d{2}[./-]\\d{2}[./-]\\d{4}',
      '\\d{4}[./-]\\d{2}[./-]\\d{2}',
      '\\d{1,2}\\s+(?:қаңтар|ақпан|наурыз|сәуір|мамыр|маусым|шілде|тамыз|қыркүйек|қазан|қараша|желтоқсан)\\s+\\d{4}',
    ],
    numberPatterns: {
      decimal: /[.,]/,
      thousands: /[,\s]/,
      currency: /[₸₽€$£¥]/,
      negative: /^[-—−]|[-−]$/,
    },
    stopWords: ['және', 'мен', 'үшін', 'күн', 'дейін', 'тен', 'негізінде', 'бойынша', 'туралы'],
    emptyValues: ['жоқ', 'көрсетілмеген', '---', 'бос', 'n/a', 'none'],
  },

  // English
  en: {
    fieldSynonyms: {
      date: ['date', 'transaction date', 'operation date', 'dt'],
      amount: ['amount', 'sum', 'value', 'total', 'amt'],
      debit: ['debit', 'debit amount', 'withdrawal', 'expense', 'out'],
      credit: ['credit', 'credit amount', 'deposit', 'income', 'in'],
      description: ['description', 'desc', 'memo', 'details', 'purpose', 'note'],
      counterparty: ['counterparty', 'payee', 'payer', 'beneficiary', 'recipient'],
      reference: ['reference', 'ref', 'transaction id', 'doc number', 'code'],
      balance: ['balance', 'bal', 'running balance', 'available'],
      currency: ['currency', 'curr', 'ccy', 'currency code'],
      account: ['account', 'acc', 'account number', 'acct'],
      transaction: ['transaction', 'txn', 'operation'],
      category: ['category', 'cat', 'type', 'classification'],
      status: ['status', 'state', 'condition'],
      type: ['type', 'kind', 'sort'],
    },
    datePatterns: [
      '\\d{2}[./-]\\d{2}[./-]\\d{4}',
      '\\d{4}[./-]\\d{2}[./-]\\d{2}',
      '\\d{1,2}\\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\\s+\\d{4}',
      '\\d{1,2}\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\s+\\d{4}',
    ],
    numberPatterns: {
      decimal: /[.,]/,
      thousands: /[,]/,
      currency: /[$€£¥₹]/,
      negative: /^[-—−]|[-−]$/,
    },
    stopWords: ['and', 'or', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from'],
    emptyValues: ['n/a', 'none', 'null', '---', 'empty', 'blank', 'not specified'],
  },

  // Spanish
  es: {
    fieldSynonyms: {
      date: ['fecha', 'fecha operación', 'date', 'fec'],
      amount: ['importe', 'cantidad', 'monto', 'amount', 'sum', 'valor'],
      debit: ['débito', 'debito', 'debit', 'retiro', 'gasto', 'salida'],
      credit: ['crédito', 'credito', 'credit', 'depósito', 'ingreso', 'entrada'],
      description: ['descripción', 'descrip', 'description', 'concepto', 'detalle', 'memoria'],
      counterparty: ['contraparte', 'beneficiario', 'pagador', 'counterparty', 'receptor'],
      reference: ['referencia', 'ref', 'reference', 'documento', 'número', 'código'],
      balance: ['saldo', 'balance', 'disponible'],
      currency: ['moneda', 'divisa', 'currency', 'tipo de cambio'],
      account: ['cuenta', 'account', 'número de cuenta', 'ccta'],
      transaction: ['transacción', 'txn', 'transaction', 'operación'],
      category: ['categoría', 'categoria', 'category', 'tipo'],
      status: ['estado', 'status', 'situación'],
      type: ['tipo', 'type', 'clase'],
    },
    datePatterns: [
      '\\d{2}[./-]\\d{2}[./-]\\d{4}',
      '\\d{4}[./-]\\d{2}[./-]\\d{2}',
      '\\d{1,2}\\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\\s+\\d{4}',
    ],
    numberPatterns: {
      decimal: /[.,]/,
      thousands: /[.,]/,
      currency: /[€$]/,
      negative: /^[-—−]|[-−]$/,
    },
    stopWords: ['y', 'o', 'el', 'la', 'en', 'de', 'a', 'para', 'por', 'con', 'sin', 'del', 'los'],
    emptyValues: ['n/d', 'no aplica', '---', 'vacío', 'nulo', 'n/a', 'none'],
  },

  // French
  fr: {
    fieldSynonyms: {
      date: ['date', 'date opération', 'opération', 'date'],
      amount: ['montant', 'amount', 'somme', 'valeur', 'total'],
      debit: ['débit', 'debit', 'retrait', 'dépense', 'sortie'],
      credit: ['crédit', 'credit', 'dépôt', 'revenu', 'entrée'],
      description: ['description', 'desc', 'libellé', 'détails', 'motif', 'note'],
      counterparty: ['contrepartie', 'bénéficiaire', 'payeur', 'counterparty', 'destinataire'],
      reference: ['référence', 'ref', 'reference', 'document', 'numéro', 'code'],
      balance: ['solde', 'balance', 'disponible'],
      currency: ['devise', 'currency', 'monnaie'],
      account: ['compte', 'account', 'numéro de compte', 'cpt'],
      transaction: ['transaction', 'txn', 'opération'],
      category: ['catégorie', 'categorie', 'category', 'type'],
      status: ['statut', 'status', 'état'],
      type: ['type', 'nature', 'genre'],
    },
    datePatterns: [
      '\\d{2}[./-]\\d{2}[./-]\\d{4}',
      '\\d{4}[./-]\\d{2}[./-]\\d{2}',
      '\\d{1,2}\\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\\s+\\d{4}',
    ],
    numberPatterns: {
      decimal: /[.,]/,
      thousands: /[\\s]/,
      currency: /[€$£]/,
      negative: /^[-—−]|[-−]$/,
    },
    stopWords: ['et', 'ou', 'le', 'la', 'les', 'de', 'du', 'des', 'à', 'au', 'aux', 'pour', 'par'],
    emptyValues: ['n/d', 'non applicable', '---', 'vide', 'nul', 'n/a', 'none'],
  },

  // German
  de: {
    fieldSynonyms: {
      date: ['datum', 'date', 'datums'],
      amount: ['betrag', 'amount', 'summe', 'wert', 'total'],
      debit: ['soll', 'debit', 'abhebung', 'ausgabe', 'belastung'],
      credit: ['haben', 'credit', 'einzahlung', 'einnahme', 'gutschrift'],
      description: ['beschreibung', 'desc', 'verwendungszweck', 'details', 'zweck', 'notiz'],
      counterparty: ['gegenpartei', 'begünstigter', 'zahler', 'counterparty', 'empfänger'],
      reference: ['referenz', 'ref', 'reference', 'dokument', 'nummer', 'code'],
      balance: ['saldo', 'balance', 'kontostand', 'verfügbar'],
      currency: ['währung', 'currency', 'devise'],
      account: ['konto', 'account', 'kontonummer', 'kt'],
      transaction: ['transaktion', 'txn', 'buchung', 'vorgang'],
      category: ['kategorie', 'category', 'typ', 'art'],
      status: ['status', 'zustand', 'stand'],
      type: ['typ', 'type', 'art'],
    },
    datePatterns: [
      '\\d{2}[./-]\\d{2}[./-]\\d{4}',
      '\\d{4}[./-]\\d{2}[./-]\\d{2}',
      '\\d{1,2}\\s+(?:januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\\s+\\d{4}',
    ],
    numberPatterns: {
      decimal: /[,]/,
      thousands: /[\\s.]/,
      currency: /[€$£]/,
      negative: /^[-—−]|[-−]$/,
    },
    stopWords: ['und', 'oder', 'der', 'die', 'das', 'in', 'an', 'zu', 'für', 'von', 'mit', 'bei'],
    emptyValues: ['n/a', 'nicht verfügbar', '---', 'leer', 'null', 'none'],
  },

  // Italian
  it: {
    fieldSynonyms: {
      date: ['data', 'date', 'data operazione'],
      amount: ['importo', 'amount', 'somma', 'valore', 'totale'],
      debit: ['debito', 'debit', 'prelievo', 'spesa', 'uscita'],
      credit: ['credito', 'credit', 'deposito', 'entrata', 'incasso'],
      description: ['descrizione', 'desc', 'causale', 'dettagli', 'note', 'motivo'],
      counterparty: ['controparte', 'beneficiario', 'pagatore', 'counterparty', 'destinatario'],
      reference: ['riferimento', 'ref', 'reference', 'documento', 'numero', 'codice'],
      balance: ['saldo', 'balance', 'disponibile'],
      currency: ['valuta', 'currency', 'divisa'],
      account: ['conto', 'account', 'numero conto', 'c/c'],
      transaction: ['transazione', 'txn', 'operazione'],
      category: ['categoria', 'category', 'tipo'],
      status: ['stato', 'status', 'condizione'],
      type: ['tipo', 'type', 'genere'],
    },
    datePatterns: [
      '\\d{2}[./-]\\d{2}[./-]\\d{4}',
      '\\d{4}[./-]\\d{2}[./-]\\d{2}',
      '\\d{1,2}\\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\\s+\\d{4}',
    ],
    numberPatterns: {
      decimal: /[,]/,
      thousands: /[\\s.]/,
      currency: /[€$£]/,
      negative: /^[-—−]|[-−]$/,
    },
    stopWords: ['e', 'o', 'il', 'lo', 'la', 'le', 'di', 'del', 'dei', 'a', 'da', 'per', 'con'],
    emptyValues: ['n/d', 'non disponibile', '---', 'vuoto', 'nullo', 'n/a', 'none'],
  },

  // Portuguese
  pt: {
    fieldSynonyms: {
      date: ['data', 'date', 'data operação'],
      amount: ['valor', 'amount', 'quantia', 'total', 'montante'],
      debit: ['débito', 'debit', 'saque', 'despesa', 'saída'],
      credit: ['crédito', 'credit', 'depósito', 'receita', 'entrada'],
      description: ['descrição', 'desc', 'descrição', 'detalhes', 'observação', 'motivo'],
      counterparty: ['contraparte', 'beneficiário', 'pagador', 'counterparty', 'destinatário'],
      reference: ['referência', 'ref', 'reference', 'documento', 'número', 'código'],
      balance: ['saldo', 'balance', 'disponível'],
      currency: ['moeda', 'currency', 'divisa'],
      account: ['conta', 'account', 'número conta', 'cc'],
      transaction: ['transação', 'txn', 'operação'],
      category: ['categoria', 'category', 'tipo'],
      status: ['status', 'estado', 'situação'],
      type: ['tipo', 'type', 'espécie'],
    },
    datePatterns: [
      '\\d{2}[./-]\\d{2}[./-]\\d{4}',
      '\\d{4}[./-]\\d{2}[./-]\\d{2}',
      '\\d{1,2}\\s+(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\\s+\\d{4}',
    ],
    numberPatterns: {
      decimal: /[,]/,
      thousands: /[\\s.]/,
      currency: /[R$€$]/,
      negative: /^[-—−]|[-−]$/,
    },
    stopWords: ['e', 'ou', 'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'para'],
    emptyValues: ['n/d', 'não disp.', '---', 'vazio', 'nulo', 'n/a', 'none'],
  },

  // Turkish
  tr: {
    fieldSynonyms: {
      date: ['tarih', 'date', 'işlem tarihi'],
      amount: ['tutar', 'amount', 'miktar', 'değer', 'toplam'],
      debit: ['borç', 'debit', 'çekme', 'gider', 'çıkış'],
      credit: ['alacak', 'credit', 'yatırım', 'gelir', 'giriş'],
      description: ['açıklama', 'desc', 'detay', 'not', 'amaç'],
      counterparty: ['karşı taraf', 'lehtar', 'borçlu', 'counterparty', 'alıcı'],
      reference: ['referans', 'ref', 'reference', 'belge', 'numara', 'kod'],
      balance: ['bakiye', 'balance', 'kalan'],
      currency: ['kur', 'currency', 'para birimi'],
      account: ['hesap', 'account', 'hesap numarası', 'hes'],
      transaction: ['işlem', 'txn', 'transaction'],
      category: ['kategori', 'category', 'tür'],
      status: ['durum', 'status', 'konum'],
      type: ['tip', 'type', 'tür', 'çeşit'],
    },
    datePatterns: [
      '\\d{2}[./-]\\d{2}[./-]\\d{4}',
      '\\d{4}[./-]\\d{2}[./-]\\d{2}',
      '\\d{1,2}\\s+(?:ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)\\s+\\d{4}',
    ],
    numberPatterns: {
      decimal: /[.,]/,
      thousands: /[\\s.]/,
      currency: /[₺$€]/,
      negative: /^[-—−]|[-−]$/,
    },
    stopWords: ['ve', 'veya', 'bir', 'için', 'ile', 'dan', 'den', ' üzerine', 'aşağı'],
    emptyValues: ['yok', 'belirtilmemiş', '---', 'boş', 'n/a', 'none'],
  },
};

/**
 * Field type mapping for universal processing
 */
const FIELD_TYPE_MAPPING = {
  DATE: 'date',
  AMOUNT: 'amount',
  DEBIT: 'debit',
  CREDIT: 'credit',
  DESCRIPTION: 'description',
  COUNTERPARTY: 'counterparty',
  REFERENCE: 'reference',
  BALANCE: 'balance',
  CURRENCY: 'currency',
  ACCOUNT: 'account',
  TRANSACTION: 'transaction',
  CATEGORY: 'category',
  STATUS: 'status',
  TYPE: 'type',
} as const;

export type FieldType = (typeof FIELD_TYPE_MAPPING)[keyof typeof FIELD_TYPE_MAPPING];

/**
 * Get field synonyms for a specific language
 */
export function getFieldSynonyms(language: string, fieldType: FieldType): string[] {
  const patterns = LANGUAGE_PATTERNS[language];
  if (!patterns) {
    // Fallback to English if language not supported
    return LANGUAGE_PATTERNS.en.fieldSynonyms[fieldType] || [];
  }
  return patterns.fieldSynonyms[fieldType] || [];
}

/**
 * Find field type from column header using language patterns
 */
export function detectFieldType(header: string, language: string): FieldType | null {
  const normalizedHeader = header
    .toLowerCase()
    .trim()
    .replace(/[\\s_-]+/g, ' ');

  for (const [fieldType, synonyms] of Object.entries(
    LANGUAGE_PATTERNS[language]?.fieldSynonyms || LANGUAGE_PATTERNS.en.fieldSynonyms,
  )) {
    for (const synonym of synonyms) {
      if (
        normalizedHeader.includes(synonym.toLowerCase()) ||
        synonym.toLowerCase().includes(normalizedHeader)
      ) {
        return fieldType as FieldType;
      }
    }
  }

  return null;
}

/**
 * Get language patterns for a language
 */
export function getLanguagePatterns(language: string): LanguagePatterns {
  return LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.en;
}

/**
 * Check if a value is considered empty in a specific language
 */
function isEmptyValue(value: string, language: string): boolean {
  const normalizedValue = value.toLowerCase().trim();
  const patterns = getLanguagePatterns(language);

  return (
    patterns.emptyValues.includes(normalizedValue) ||
    normalizedValue === '' ||
    /^[-\s_=*]+$/.test(normalizedValue)
  );
}

/**
 * Remove stop words from text based on language
 */
function removeStopWords(text: string, language: string): string {
  const patterns = getLanguagePatterns(language);
  const stopWords = patterns.stopWords;

  return text
    .split(/\\s+/)
    .filter(word => !stopWords.includes(word.toLowerCase()))
    .join(' ')
    .trim();
}
