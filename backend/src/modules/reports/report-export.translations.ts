/**
 * Column headers and sheet names for report exports.
 *
 * Labels are data, not identifiers: the sheet is built with aoa_to_sheet so the
 * header row is an ordinary row, rather than being derived from object keys.
 */
type ReportLabelMap = Record<ReportLabelKey, string>;

export type ReportLabelKey =
  | 'group'
  | 'date'
  | 'counterparty'
  | 'amount'
  | 'category'
  | 'branch'
  | 'wallet'
  | 'type'
  | 'count'
  | 'income'
  | 'expense'
  | 'difference'
  | 'sheetReport'
  | 'sheetTrends';

const ru: ReportLabelMap = {
  group: 'Группа',
  date: 'Дата',
  counterparty: 'Контрагент',
  amount: 'Сумма',
  category: 'Категория',
  branch: 'Филиал',
  wallet: 'Кошелёк',
  type: 'Тип',
  count: 'Количество',
  income: 'Приходы',
  expense: 'Расходы',
  difference: 'Разница',
  sheetReport: 'Отчёт',
  sheetTrends: 'Динамика',
};

const en: ReportLabelMap = {
  group: 'Group',
  date: 'Date',
  counterparty: 'Counterparty',
  amount: 'Amount',
  category: 'Category',
  branch: 'Branch',
  wallet: 'Wallet',
  type: 'Type',
  count: 'Count',
  income: 'Income',
  expense: 'Expenses',
  difference: 'Difference',
  sheetReport: 'Report',
  sheetTrends: 'Trends',
};

const kk: ReportLabelMap = {
  group: 'Топ',
  date: 'Күні',
  counterparty: 'Контрагент',
  amount: 'Сома',
  category: 'Санат',
  branch: 'Филиал',
  wallet: 'Әмиян',
  type: 'Түрі',
  count: 'Саны',
  income: 'Кірістер',
  expense: 'Шығыстар',
  difference: 'Айырма',
  sheetReport: 'Есеп',
  sheetTrends: 'Динамика',
};

const de: ReportLabelMap = {
  group: 'Gruppe',
  date: 'Datum',
  counterparty: 'Geschäftspartner',
  amount: 'Betrag',
  category: 'Kategorie',
  branch: 'Filiale',
  wallet: 'Wallet',
  type: 'Typ',
  count: 'Anzahl',
  income: 'Einnahmen',
  expense: 'Ausgaben',
  difference: 'Differenz',
  sheetReport: 'Bericht',
  sheetTrends: 'Verlauf',
};

const fr: ReportLabelMap = {
  group: 'Groupe',
  date: 'Date',
  counterparty: 'Contrepartie',
  amount: 'Montant',
  category: 'Catégorie',
  branch: 'Succursale',
  wallet: 'Portefeuille',
  type: 'Type',
  count: 'Nombre',
  income: 'Recettes',
  expense: 'Dépenses',
  difference: 'Écart',
  sheetReport: 'Rapport',
  sheetTrends: 'Tendances',
};

const es: ReportLabelMap = {
  group: 'Grupo',
  date: 'Fecha',
  counterparty: 'Contraparte',
  amount: 'Importe',
  category: 'Categoría',
  branch: 'Sucursal',
  wallet: 'Billetera',
  type: 'Tipo',
  count: 'Cantidad',
  income: 'Ingresos',
  expense: 'Gastos',
  difference: 'Diferencia',
  sheetReport: 'Informe',
  sheetTrends: 'Tendencias',
};

const pt: ReportLabelMap = {
  group: 'Grupo',
  date: 'Data',
  counterparty: 'Contraparte',
  amount: 'Valor',
  category: 'Categoria',
  branch: 'Filial',
  wallet: 'Carteira',
  type: 'Tipo',
  count: 'Quantidade',
  income: 'Receitas',
  expense: 'Despesas',
  difference: 'Diferença',
  sheetReport: 'Relatório',
  sheetTrends: 'Tendências',
};

const tr: ReportLabelMap = {
  group: 'Grup',
  date: 'Tarih',
  counterparty: 'Karşı taraf',
  amount: 'Tutar',
  category: 'Kategori',
  branch: 'Şube',
  wallet: 'Cüzdan',
  type: 'Tür',
  count: 'Adet',
  income: 'Gelirler',
  expense: 'Giderler',
  difference: 'Fark',
  sheetReport: 'Rapor',
  sheetTrends: 'Eğilimler',
};

const uk: ReportLabelMap = {
  group: 'Група',
  date: 'Дата',
  counterparty: 'Контрагент',
  amount: 'Сума',
  category: 'Категорія',
  branch: 'Філія',
  wallet: 'Гаманець',
  type: 'Тип',
  count: 'Кількість',
  income: 'Надходження',
  expense: 'Витрати',
  difference: 'Різниця',
  sheetReport: 'Звіт',
  sheetTrends: 'Динаміка',
};

const zh: ReportLabelMap = {
  group: '分组',
  date: '日期',
  counterparty: '交易对方',
  amount: '金额',
  category: '类别',
  branch: '分支机构',
  wallet: '钱包',
  type: '类型',
  count: '数量',
  income: '收入',
  expense: '支出',
  difference: '差额',
  sheetReport: '报告',
  sheetTrends: '趋势',
};

const pl: ReportLabelMap = {
  group: 'Grupa',
  date: 'Data',
  counterparty: 'Kontrahent',
  amount: 'Kwota',
  category: 'Kategoria',
  branch: 'Oddział',
  wallet: 'Portfel',
  type: 'Typ',
  count: 'Liczba',
  income: 'Wpływy',
  expense: 'Wydatki',
  difference: 'Różnica',
  sheetReport: 'Raport',
  sheetTrends: 'Trendy',
};

const it: ReportLabelMap = {
  group: 'Gruppo',
  date: 'Data',
  counterparty: 'Controparte',
  amount: 'Importo',
  category: 'Categoria',
  branch: 'Filiale',
  wallet: 'Portafoglio',
  type: 'Tipo',
  count: 'Quantità',
  income: 'Entrate',
  expense: 'Uscite',
  difference: 'Differenza',
  sheetReport: 'Report',
  sheetTrends: 'Andamento',
};

const sk: ReportLabelMap = {
  group: 'Skupina',
  date: 'Dátum',
  counterparty: 'Protistrana',
  amount: 'Suma',
  category: 'Kategória',
  branch: 'Pobočka',
  wallet: 'Peňaženka',
  type: 'Typ',
  count: 'Počet',
  income: 'Príjmy',
  expense: 'Výdavky',
  difference: 'Rozdiel',
  sheetReport: 'Správa',
  sheetTrends: 'Vývoj',
};

const ja: ReportLabelMap = {
  group: 'グループ',
  date: '日付',
  counterparty: '取引先',
  amount: '金額',
  category: 'カテゴリ',
  branch: '支店',
  wallet: 'ウォレット',
  type: '種別',
  count: '件数',
  income: '収入',
  expense: '支出',
  difference: '差額',
  sheetReport: 'レポート',
  sheetTrends: '推移',
};

const ko: ReportLabelMap = {
  group: '그룹',
  date: '날짜',
  counterparty: '거래처',
  amount: '금액',
  category: '카테고리',
  branch: '지점',
  wallet: '지갑',
  type: '유형',
  count: '건수',
  income: '수입',
  expense: '지출',
  difference: '차액',
  sheetReport: '보고서',
  sheetTrends: '추이',
};

const hi: ReportLabelMap = {
  group: 'समूह',
  date: 'दिनांक',
  counterparty: 'प्रतिपक्ष',
  amount: 'राशि',
  category: 'श्रेणी',
  branch: 'शाखा',
  wallet: 'वॉलेट',
  type: 'प्रकार',
  count: 'संख्या',
  income: 'आय',
  expense: 'व्यय',
  difference: 'अंतर',
  sheetReport: 'रिपोर्ट',
  sheetTrends: 'रुझान',
};

const nl: ReportLabelMap = {
  group: 'Groep',
  date: 'Datum',
  counterparty: 'Tegenpartij',
  amount: 'Bedrag',
  category: 'Categorie',
  branch: 'Filiaal',
  wallet: 'Portemonnee',
  type: 'Type',
  count: 'Aantal',
  income: 'Inkomsten',
  expense: 'Uitgaven',
  difference: 'Verschil',
  sheetReport: 'Rapport',
  sheetTrends: 'Trends',
};

const sv: ReportLabelMap = {
  group: 'Grupp',
  date: 'Datum',
  counterparty: 'Motpart',
  amount: 'Belopp',
  category: 'Kategori',
  branch: 'Filial',
  wallet: 'Plånbok',
  type: 'Typ',
  count: 'Antal',
  income: 'Inkomster',
  expense: 'Utgifter',
  difference: 'Differens',
  sheetReport: 'Rapport',
  sheetTrends: 'Trender',
};

const vi: ReportLabelMap = {
  group: 'Nhóm',
  date: 'Ngày',
  counterparty: 'Đối tác',
  amount: 'Số tiền',
  category: 'Danh mục',
  branch: 'Chi nhánh',
  wallet: 'Ví',
  type: 'Loại',
  count: 'Số lượng',
  income: 'Thu',
  expense: 'Chi',
  difference: 'Chênh lệch',
  sheetReport: 'Báo cáo',
  sheetTrends: 'Xu hướng',
};

const id: ReportLabelMap = {
  group: 'Grup',
  date: 'Tanggal',
  counterparty: 'Pihak lawan',
  amount: 'Jumlah',
  category: 'Kategori',
  branch: 'Cabang',
  wallet: 'Dompet',
  type: 'Tipe',
  count: 'Jumlah data',
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  difference: 'Selisih',
  sheetReport: 'Laporan',
  sheetTrends: 'Tren',
};

const da: ReportLabelMap = {
  group: 'Gruppe',
  date: 'Dato',
  counterparty: 'Modpart',
  amount: 'Beløb',
  category: 'Kategori',
  branch: 'Filial',
  wallet: 'Wallet',
  type: 'Type',
  count: 'Antal',
  income: 'Indtægter',
  expense: 'Udgifter',
  difference: 'Forskel',
  sheetReport: 'Rapport',
  sheetTrends: 'Tendenser',
};

const nb: ReportLabelMap = {
  group: 'Gruppe',
  date: 'Dato',
  counterparty: 'Motpart',
  amount: 'Beløp',
  category: 'Kategori',
  branch: 'Filial',
  wallet: 'Lommebok',
  type: 'Type',
  count: 'Antall',
  income: 'Inntekter',
  expense: 'Kostnader',
  difference: 'Differanse',
  sheetReport: 'Rapport',
  sheetTrends: 'Trender',
};

const nn: ReportLabelMap = {
  group: 'Gruppe',
  date: 'Dato',
  counterparty: 'Motpart',
  amount: 'Beløp',
  category: 'Kategori',
  branch: 'Filial',
  wallet: 'Lommebok',
  type: 'Type',
  count: 'Tal',
  income: 'Inntekter',
  expense: 'Kostnader',
  difference: 'Differanse',
  sheetReport: 'Rapport',
  sheetTrends: 'Trendar',
};

const fi: ReportLabelMap = {
  group: 'Ryhmä',
  date: 'Päivämäärä',
  counterparty: 'Vastapuoli',
  amount: 'Summa',
  category: 'Kategoria',
  branch: 'Konttori',
  wallet: 'Lompakko',
  type: 'Tyyppi',
  count: 'Lukumäärä',
  income: 'Tulot',
  expense: 'Menot',
  difference: 'Ero',
  sheetReport: 'Raportti',
  sheetTrends: 'Kehitys',
};

const is: ReportLabelMap = {
  group: 'Hópur',
  date: 'Dagsetning',
  counterparty: 'Gagnaðili',
  amount: 'Fjárhæð',
  category: 'Kategoría',
  branch: 'Afgreiðsla',
  wallet: 'Veski',
  type: 'Tegund',
  count: 'Fjöldi',
  income: 'Tekjur',
  expense: 'Gjöld',
  difference: 'Mismunur',
  sheetReport: 'Skýrsla',
  sheetTrends: 'Þróun',
};

const fo: ReportLabelMap = {
  group: 'Bólkur',
  date: 'Dato',
  counterparty: 'Mótpartur',
  amount: 'Sum',
  category: 'Bólkur',
  branch: 'Avdeild',
  wallet: 'Pungur',
  type: 'Slag',
  count: 'Tal',
  income: 'Inntøkur',
  expense: 'Útgjøld',
  difference: 'Munur',
  sheetReport: 'Frágreiðing',
  sheetTrends: 'Gongd',
};

const cs: ReportLabelMap = {
  group: 'Skupina',
  date: 'Datum',
  counterparty: 'Protistrana',
  amount: 'Částka',
  category: 'Kategorie',
  branch: 'Pobočka',
  wallet: 'Peněženka',
  type: 'Typ',
  count: 'Počet',
  income: 'Příjmy',
  expense: 'Výdaje',
  difference: 'Rozdíl',
  sheetReport: 'Report',
  sheetTrends: 'Trendy',
};

const bg: ReportLabelMap = {
  group: 'Група',
  date: 'Дата',
  counterparty: 'Контрагент',
  amount: 'Сума',
  category: 'Категория',
  branch: 'Клон',
  wallet: 'Портфейл',
  type: 'Тип',
  count: 'Брой',
  income: 'Приходи',
  expense: 'Разходи',
  difference: 'Разлика',
  sheetReport: 'Отчет',
  sheetTrends: 'Тенденции',
};

const hr: ReportLabelMap = {
  group: 'Grupa',
  date: 'Datum',
  counterparty: 'Druga strana',
  amount: 'Iznos',
  category: 'Kategorija',
  branch: 'Poslovnica',
  wallet: 'Novčanik',
  type: 'Vrsta',
  count: 'Broj',
  income: 'Prihodi',
  expense: 'Troškovi',
  difference: 'Razlika',
  sheetReport: 'Izvještaj',
  sheetTrends: 'Trendovi',
};

const sr: ReportLabelMap = {
  group: 'Група',
  date: 'Датум',
  counterparty: 'Друга страна',
  amount: 'Износ',
  category: 'Категорија',
  branch: 'Филијала',
  wallet: 'Новчаник',
  type: 'Врста',
  count: 'Број',
  income: 'Приходи',
  expense: 'Трошкови',
  difference: 'Разлика',
  sheetReport: 'Извештај',
  sheetTrends: 'Трендови',
};

const sl: ReportLabelMap = {
  group: 'Skupina',
  date: 'Datum',
  counterparty: 'Nasprotna stranka',
  amount: 'Znesek',
  category: 'Kategorija',
  branch: 'Poslovalnica',
  wallet: 'Denarnica',
  type: 'Vrsta',
  count: 'Število',
  income: 'Prihodki',
  expense: 'Stroški',
  difference: 'Razlika',
  sheetReport: 'Poročilo',
  sheetTrends: 'Trendi',
};

const mk: ReportLabelMap = {
  group: 'Група',
  date: 'Датум',
  counterparty: 'Другата страна',
  amount: 'Сума',
  category: 'Категорија',
  branch: 'Филијала',
  wallet: 'Паричник',
  type: 'Тип',
  count: 'Број',
  income: 'Приходи',
  expense: 'Трошоци',
  difference: 'Разлика',
  sheetReport: 'Извештај',
  sheetTrends: 'Трендови',
};

const be: ReportLabelMap = {
  group: 'Група',
  date: 'Дата',
  counterparty: 'Кантрагент',
  amount: 'Сума',
  category: 'Катэгорыя',
  branch: 'Філіял',
  wallet: 'Гаманец',
  type: 'Тып',
  count: 'Колькасць',
  income: 'Прыбыткі',
  expense: 'Выдаткі',
  difference: 'Розніца',
  sheetReport: 'Звет',
  sheetTrends: 'Тэндэнцыі',
};

const bs: ReportLabelMap = {
  group: 'Grupa',
  date: 'Datum',
  counterparty: 'Druga strana',
  amount: 'Iznos',
  category: 'Kategorija',
  branch: 'Filijala',
  wallet: 'Novčanik',
  type: 'Vrsta',
  count: 'Broj',
  income: 'Prihodi',
  expense: 'Troškovi',
  difference: 'Razlika',
  sheetReport: 'Izvještaj',
  sheetTrends: 'Trendovi',
};

const hsb: ReportLabelMap = {
  group: 'Skupina',
  date: 'Datum',
  counterparty: 'Přećiwna strona',
  amount: 'Suma',
  category: 'Kategorija',
  branch: 'Filiala',
  wallet: 'Móšnja',
  type: 'Typ',
  count: 'Ličba',
  income: 'Dochody',
  expense: 'Wudawki',
  difference: 'Rozdźěl',
  sheetReport: 'Rozprawa',
  sheetTrends: 'Trendy',
};

const REPORT_LABELS: Record<string, ReportLabelMap> = {
  ru,
  en,
  kk,
  de,
  fr,
  es,
  pt,
  tr,
  uk,
  zh,
  pl,
  it,
  sk,
  ja,
  ko,
  hi,
  nl,
  sv,
  vi,
  id,
  da,
  nb,
  nn,
  fi,
  is,
  fo,
  cs,
  bg,
  hr,
  sr,
  sl,
  mk,
  be,
  bs,
  hsb,
};

export function renderReportLabels(locale: string | undefined): ReportLabelMap {
  return REPORT_LABELS[locale ?? ''] ?? REPORT_LABELS.en;
}
