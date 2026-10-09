import { isStoicKey, STOIC_TEXTS } from './stoic-texts';
import { STOIC_VARIANT_COUNT, type StoicMessageKey } from './stoic-texts/types';

/**
 * Insight texts are stored as a key plus params, not as a finished sentence,
 * so the wording lives here instead of inside the analyzers. Mirrors
 * notification-translations.ts — same shape, same interpolation, separate
 * namespace because insights and notifications have different lifecycles.
 */
type BaseMessageKey =
  | 'operational.unapproved'
  | 'operational.uncategorized'
  | 'operational.duplicates'
  | 'trend.category_rising'
  | 'pattern.unbudgeted_top_category'
  | 'trend.savings_rate_up'
  | 'trend.savings_rate_down'
  | 'pattern.risky_allocation';

/** Stoic keys have five wordings each and live in stoic-texts/. */
export type InsightMessageKey = BaseMessageKey | StoicMessageKey;

interface TranslationEntry {
  title: string;
  message: string;
}

type TranslationMap = Record<BaseMessageKey, TranslationEntry>;

const ru: TranslationMap = {
  'operational.unapproved': {
    title: 'Операции ждут вашего решения',
    message: 'Ждут подтверждения: {{count}}. Решите сегодня, а не носите с собой.',
  },
  'operational.uncategorized': {
    title: 'Траты без имени',
    message: 'Транзакций без категории: {{count}}. То, что не названо, нельзя взвесить.',
  },
  'operational.duplicates': {
    title: 'Найдены возможные дубликаты',
    message:
      'Потенциальных дубликатов: {{count}}. Видьте вещи как есть — каждую считайте один раз.',
  },
  'trend.category_rising': {
    title: 'Категория растет',
    message:
      'Расходы в категории "{{category}}" на {{percent}}% выше среднего за 3 месяца. Спросите себя: она служит вам или вы ей?',
  },
  'pattern.unbudgeted_top_category': {
    title: 'У самой крупной траты нет меры',
    message:
      '"{{category}}" — самая крупная статья расходов в этом месяце, и ее ничто не ограничивает. Предел, выбранный в спокойствии, крепче желания.',
  },
  'trend.savings_rate_up': {
    title: 'Норма сбережений выросла',
    message:
      'Вы сохранили {{rate}}% дохода — на {{diff}} п.п. больше прошлого месяца. Умеренность работает.',
  },
  'trend.savings_rate_down': {
    title: 'Норма сбережений упала',
    message:
      'Вы сохранили {{rate}}% дохода — на {{diff}} п.п. меньше прошлого месяца. Смотрите на то, что выросло, а не на то, чего не хватает.',
  },
  'pattern.risky_allocation': {
    title: 'Слишком многое зависит от фортуны',
    message:
      '{{percent}}% активов в среднем и высоком риске — больше порога в {{threshold}}%. Держите большую часть того, чем владеете, вне власти случая.',
  },
};

const en: TranslationMap = {
  'operational.unapproved': {
    title: 'Transactions await your judgment',
    message:
      '{{count}} transactions are waiting for approval. Settle them today rather than carry them.',
  },
  'operational.uncategorized': {
    title: 'Spending without a name',
    message: '{{count}} transactions have no category. What is not named cannot be weighed.',
  },
  'operational.duplicates': {
    title: 'Possible duplicates found',
    message:
      '{{count}} potential duplicates detected. See things as they are — count each one once.',
  },
  'trend.category_rising': {
    title: 'Category is rising',
    message:
      'Spending on "{{category}}" is {{percent}}% above its 3-month average. Ask whether it serves you or you serve it.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Your largest expense has no limit',
    message:
      '"{{category}}" is your largest expense this month and nothing measures it. A limit chosen in calm outlasts a craving.',
  },
  'trend.savings_rate_up': {
    title: 'Savings rate is up',
    message:
      'You kept {{rate}}% of income — {{diff}} pts more than last month. Moderation is doing its work.',
  },
  'trend.savings_rate_down': {
    title: 'Savings rate is down',
    message:
      'You kept {{rate}}% of income — {{diff}} pts less than last month. Look at what grew, not at what you lack.',
  },
  'pattern.risky_allocation': {
    title: 'Too much depends on fortune',
    message:
      "{{percent}}% of assets sit in medium or high risk — above the {{threshold}}% limit. Keep most of what you own out of fortune's reach.",
  },
};

const kk: TranslationMap = {
  'operational.unapproved': {
    title: 'Операциялар сіздің шешіміңізді күтуде',
    message: 'Растауды күтуде: {{count}}. Оларды бойыңызда алып жүрмей, бүгін шешіңіз.',
  },
  'operational.uncategorized': {
    title: 'Атауы жоқ шығындар',
    message: 'Санатсыз транзакциялар: {{count}}. Аталмаған нәрсені өлшеу мүмкін емес.',
  },
  'operational.duplicates': {
    title: 'Ықтимал телнұсқалар табылды',
    message:
      'Ықтимал телнұсқалар: {{count}}. Заттарды бар күйінде көріңіз — әрқайсысын бір рет санаңыз.',
  },
  'trend.category_rising': {
    title: 'Санат бойынша шығын өсуде',
    message:
      '"{{category}}" санатындағы шығыс 3 айлық орташадан {{percent}}% жоғары. Өзіңізден сұраңыз: ол сізге қызмет ете ме, әлде сіз оған?',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Ең ірі шығынның шегі жоқ',
    message:
      '"{{category}}" — осы айдағы ең ірі шығыс бабы, оны ештеңе шектемейді. Сабырмен таңдалған шек құмарлықтан берік.',
  },
  'trend.savings_rate_up': {
    title: 'Жинақ үлесі өсті',
    message:
      'Табыстың {{rate}}%-ын сақтадыңыз — өткен айдан {{diff}} т.т. артық. Байсалдылық өз жемісін беруде.',
  },
  'trend.savings_rate_down': {
    title: 'Жинақ үлесі төмендеді',
    message:
      'Табыстың {{rate}}%-ын сақтадыңыз — өткен айдан {{diff}} т.т. кем. Жетіспейтінге емес, өскенге қараңыз.',
  },
  'pattern.risky_allocation': {
    title: 'Тым көп нәрсе сәттілікке байланысты',
    message:
      'Активтердің {{percent}}%-ы орташа және жоғары тәуекелде — {{threshold}}% шегінен жоғары. Иелігіңіздің басым бөлігін кездейсоқтықтың қолынан тыс ұстаңыз.',
  },
};

const de: TranslationMap = {
  'operational.unapproved': {
    title: 'Transaktionen warten auf Ihr Urteil',
    message:
      'Warten auf Bestätigung: {{count}}. Erledigen Sie sie heute, statt sie mit sich herumzutragen.',
  },
  'operational.uncategorized': {
    title: 'Ausgaben ohne Namen',
    message:
      'Transaktionen ohne Kategorie: {{count}}. Was keinen Namen hat, lässt sich nicht abwägen.',
  },
  'operational.duplicates': {
    title: 'Mögliche Duplikate gefunden',
    message:
      'Mögliche Duplikate: {{count}}. Sehen Sie die Dinge, wie sie sind — zählen Sie jedes nur einmal.',
  },
  'trend.category_rising': {
    title: 'Kategorie steigt',
    message:
      'Ausgaben für "{{category}}" liegen {{percent}}% über dem 3-Monats-Durchschnitt. Fragen Sie sich: Dient sie Ihnen oder Sie ihr?',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Ihre größte Ausgabe hat kein Maß',
    message:
      '"{{category}}" ist diesen Monat Ihr größter Ausgabenposten, und nichts begrenzt ihn. Eine in Ruhe gewählte Grenze hält länger als ein Verlangen.',
  },
  'trend.savings_rate_up': {
    title: 'Sparquote gestiegen',
    message:
      'Sie haben {{rate}}% des Einkommens behalten — {{diff}} Pp. mehr als im Vormonat. Maßhalten wirkt.',
  },
  'trend.savings_rate_down': {
    title: 'Sparquote gesunken',
    message:
      'Sie haben {{rate}}% des Einkommens behalten — {{diff}} Pp. weniger als im Vormonat. Schauen Sie auf das, was gewachsen ist, nicht auf das, was fehlt.',
  },
  'pattern.risky_allocation': {
    title: 'Zu viel hängt vom Glück ab',
    message:
      '{{percent}}% der Vermögenswerte liegen im mittleren oder hohen Risiko — über der Grenze von {{threshold}}%. Halten Sie das meiste, was Sie besitzen, außer Reichweite des Zufalls.',
  },
};

const fr: TranslationMap = {
  'operational.unapproved': {
    title: 'Des transactions attendent votre jugement',
    message:
      "En attente de validation : {{count}}. Réglez-les aujourd'hui plutôt que de les porter avec vous.",
  },
  'operational.uncategorized': {
    title: 'Des dépenses sans nom',
    message: "Transactions sans catégorie : {{count}}. Ce qui n'est pas nommé ne peut être pesé.",
  },
  'operational.duplicates': {
    title: 'Doublons possibles détectés',
    message:
      "Doublons potentiels : {{count}}. Voyez les choses telles qu'elles sont — comptez chacune une seule fois.",
  },
  'trend.category_rising': {
    title: 'Catégorie en hausse',
    message:
      'Les dépenses "{{category}}" dépassent de {{percent}}% leur moyenne sur 3 mois. Demandez-vous : vous sert-elle, ou la servez-vous ?',
  },
  'pattern.unbudgeted_top_category': {
    title: "Votre plus grosse dépense n'a pas de mesure",
    message:
      '"{{category}}" est votre plus gros poste ce mois-ci, et rien ne le limite. Une limite choisie dans le calme tient mieux qu\'une envie.',
  },
  'trend.savings_rate_up': {
    title: "Taux d'épargne en hausse",
    message:
      'Vous avez gardé {{rate}}% de vos revenus — {{diff}} pts de plus que le mois dernier. La modération porte ses fruits.',
  },
  'trend.savings_rate_down': {
    title: "Taux d'épargne en baisse",
    message:
      'Vous avez gardé {{rate}}% de vos revenus — {{diff}} pts de moins que le mois dernier. Regardez ce qui a grandi, non ce qui vous manque.',
  },
  'pattern.risky_allocation': {
    title: 'Trop de choses dépendent de la fortune',
    message:
      "{{percent}}% des actifs sont en risque moyen ou élevé — au-delà du seuil de {{threshold}}%. Gardez l'essentiel de ce que vous possédez hors de portée du hasard.",
  },
};

const es: TranslationMap = {
  'operational.unapproved': {
    title: 'Hay operaciones esperando tu juicio',
    message: 'Pendientes de aprobación: {{count}}. Resuélvelas hoy en lugar de cargar con ellas.',
  },
  'operational.uncategorized': {
    title: 'Gastos sin nombre',
    message: 'Transacciones sin categoría: {{count}}. Lo que no tiene nombre no se puede sopesar.',
  },
  'operational.duplicates': {
    title: 'Posibles duplicados encontrados',
    message: 'Posibles duplicados: {{count}}. Ve las cosas como son: cuenta cada una una sola vez.',
  },
  'trend.category_rising': {
    title: 'Categoría en aumento',
    message:
      'El gasto en "{{category}}" supera en {{percent}}% su media de 3 meses. Pregúntate si te sirve a ti o tú a ella.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Tu mayor gasto no tiene medida',
    message:
      '"{{category}}" es tu mayor gasto este mes y nada lo limita. Un límite elegido con calma dura más que un antojo.',
  },
  'trend.savings_rate_up': {
    title: 'Tasa de ahorro al alza',
    message:
      'Conservaste el {{rate}}% de tus ingresos: {{diff}} pp más que el mes pasado. La moderación da fruto.',
  },
  'trend.savings_rate_down': {
    title: 'Tasa de ahorro a la baja',
    message:
      'Conservaste el {{rate}}% de tus ingresos: {{diff}} pp menos que el mes pasado. Mira lo que creció, no lo que te falta.',
  },
  'pattern.risky_allocation': {
    title: 'Demasiado depende de la fortuna',
    message:
      'El {{percent}}% de los activos está en riesgo medio o alto, por encima del límite del {{threshold}}%. Mantén la mayor parte de lo que posees fuera del alcance del azar.',
  },
};

const pt: TranslationMap = {
  'operational.unapproved': {
    title: 'Transações aguardam seu julgamento',
    message: 'Aguardando aprovação: {{count}}. Resolva hoje em vez de carregá-las consigo.',
  },
  'operational.uncategorized': {
    title: 'Gastos sem nome',
    message: 'Transações sem categoria: {{count}}. O que não tem nome não pode ser pesado.',
  },
  'operational.duplicates': {
    title: 'Possíveis duplicatas encontradas',
    message:
      'Possíveis duplicatas: {{count}}. Veja as coisas como são — conte cada uma uma só vez.',
  },
  'trend.category_rising': {
    title: 'Categoria em alta',
    message:
      'Os gastos em "{{category}}" estão {{percent}}% acima da média de 3 meses. Pergunte-se: ela serve você, ou você a ela?',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Sua maior despesa não tem medida',
    message:
      '"{{category}}" é sua maior despesa neste mês, e nada a limita. Um limite escolhido com calma dura mais que um desejo.',
  },
  'trend.savings_rate_up': {
    title: 'Taxa de poupança subiu',
    message:
      'Você guardou {{rate}}% da renda — {{diff}} p.p. a mais que no mês passado. A moderação está dando resultado.',
  },
  'trend.savings_rate_down': {
    title: 'Taxa de poupança caiu',
    message:
      'Você guardou {{rate}}% da renda — {{diff}} p.p. a menos que no mês passado. Olhe para o que cresceu, não para o que falta.',
  },
  'pattern.risky_allocation': {
    title: 'Coisas demais dependem da sorte',
    message:
      '{{percent}}% dos ativos estão em risco médio ou alto — acima do limite de {{threshold}}%. Mantenha a maior parte do que possui fora do alcance do acaso.',
  },
};

const tr: TranslationMap = {
  'operational.unapproved': {
    title: 'İşlemler kararınızı bekliyor',
    message: 'Onay bekleyen: {{count}}. Onları taşımak yerine bugün karara bağlayın.',
  },
  'operational.uncategorized': {
    title: 'Adı konmamış harcamalar',
    message: 'Kategorisiz işlem: {{count}}. Adı konmayan şey tartılamaz.',
  },
  'operational.duplicates': {
    title: 'Olası kopyalar bulundu',
    message: 'Olası kopya: {{count}}. Şeyleri oldukları gibi görün — her birini bir kez sayın.',
  },
  'trend.category_rising': {
    title: 'Kategori yükseliyor',
    message:
      '"{{category}}" harcaması 3 aylık ortalamanın %{{percent}} üzerinde. Kendinize sorun: o mu size hizmet ediyor, siz mi ona?',
  },
  'pattern.unbudgeted_top_category': {
    title: 'En büyük harcamanızın ölçüsü yok',
    message:
      '"{{category}}" bu ayki en büyük gider kaleminiz ve onu hiçbir şey sınırlamıyor. Sükûnetle seçilmiş bir sınır, bir arzudan daha uzun dayanır.',
  },
  'trend.savings_rate_up': {
    title: 'Tasarruf oranı arttı',
    message:
      'Gelirin %{{rate}} kadarını korudunuz — geçen aydan {{diff}} puan fazla. Ölçülülük işini yapıyor.',
  },
  'trend.savings_rate_down': {
    title: 'Tasarruf oranı düştü',
    message:
      'Gelirin %{{rate}} kadarını korudunuz — geçen aydan {{diff}} puan az. Eksik olana değil, büyüyene bakın.',
  },
  'pattern.risky_allocation': {
    title: 'Çok şey talihe bağlı',
    message:
      'Varlıkların %{{percent}} kadarı orta veya yüksek riskte — %{{threshold}} sınırının üzerinde. Sahip olduklarınızın çoğunu tesadüfün erişiminden uzak tutun.',
  },
};

const uk: TranslationMap = {
  'operational.unapproved': {
    title: 'Операції чекають на ваше рішення',
    message: 'Чекають підтвердження: {{count}}. Вирішіть сьогодні, а не носіть із собою.',
  },
  'operational.uncategorized': {
    title: 'Витрати без імені',
    message: 'Транзакцій без категорії: {{count}}. Те, що не назване, неможливо зважити.',
  },
  'operational.duplicates': {
    title: 'Знайдено можливі дублікати',
    message:
      'Можливих дублікатів: {{count}}. Бачте речі такими, як вони є, — рахуйте кожну один раз.',
  },
  'trend.category_rising': {
    title: 'Категорія зростає',
    message:
      'Витрати на "{{category}}" на {{percent}}% вищі за середні за 3 місяці. Запитайте себе: вона служить вам чи ви їй?',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Найбільша витрата не має міри',
    message:
      '"{{category}}" — найбільша стаття витрат цього місяця, і її ніщо не обмежує. Межа, обрана у спокої, міцніша за бажання.',
  },
  'trend.savings_rate_up': {
    title: 'Норма заощаджень зросла',
    message:
      'Ви зберегли {{rate}}% доходу — на {{diff}} в.п. більше, ніж минулого місяця. Поміркованість працює.',
  },
  'trend.savings_rate_down': {
    title: 'Норма заощаджень впала',
    message:
      'Ви зберегли {{rate}}% доходу — на {{diff}} в.п. менше, ніж минулого місяця. Дивіться на те, що виросло, а не на те, чого бракує.',
  },
  'pattern.risky_allocation': {
    title: 'Забагато залежить від фортуни',
    message:
      '{{percent}}% активів у середньому та високому ризику — більше за поріг {{threshold}}%. Тримайте більшу частину того, чим володієте, поза владою випадку.',
  },
};

const zh: TranslationMap = {
  'operational.unapproved': {
    title: '有交易等待您的判断',
    message: '待确认交易：{{count}} 笔。今天就处理掉，不要一直背着它们。',
  },
  'operational.uncategorized': {
    title: '没有名字的支出',
    message: '未分类交易：{{count}} 笔。未被命名的东西，无法被衡量。',
  },
  'operational.duplicates': {
    title: '发现可能的重复项',
    message: '可能的重复项：{{count}} 个。如实看待事物——每一笔只算一次。',
  },
  'trend.category_rising': {
    title: '该类别支出上升',
    message:
      '“{{category}}”支出比三个月均值高 {{percent}}%。问问自己：是它在为你服务，还是你在为它服务？',
  },
  'pattern.unbudgeted_top_category': {
    title: '最大的支出没有限度',
    message: '“{{category}}”是本月最大支出，却没有任何限制。平静时定下的限度，比一时的欲望更长久。',
  },
  'trend.savings_rate_up': {
    title: '储蓄率上升',
    message: '您留住了收入的 {{rate}}%，比上月高 {{diff}} 个百分点。节制正在发挥作用。',
  },
  'trend.savings_rate_down': {
    title: '储蓄率下降',
    message:
      '您留住了收入的 {{rate}}%，比上月低 {{diff}} 个百分点。看看已经增长的，而不是所缺少的。',
  },
  'pattern.risky_allocation': {
    title: '太多东西取决于运气',
    message:
      '{{percent}}% 的资产处于中高风险，超过 {{threshold}}% 的上限。让您拥有的大部分东西远离偶然的支配。',
  },
};

const pl: TranslationMap = {
  'operational.unapproved': {
    title: 'Transakcje czekają na Twoją decyzję',
    message:
      'Oczekujące na zatwierdzenie: {{count}}. Rozstrzygnij je dziś, zamiast nosić je ze sobą.',
  },
  'operational.uncategorized': {
    title: 'Wydatki bez nazwy',
    message: 'Transakcje bez kategorii: {{count}}. Czego nie nazwano, tego nie da się zważyć.',
  },
  'operational.duplicates': {
    title: 'Znaleziono możliwe duplikaty',
    message:
      'Możliwe duplikaty: {{count}}. Patrz na rzeczy takimi, jakie są — licz każdą tylko raz.',
  },
  'trend.category_rising': {
    title: 'Kategoria rośnie',
    message:
      'Wydatki na "{{category}}" są o {{percent}}% wyższe od średniej z 3 miesięcy. Zapytaj siebie: czy ona służy Tobie, czy Ty jej?',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Twój największy wydatek nie ma miary',
    message:
      '"{{category}}" to największy wydatek w tym miesiącu i nic go nie ogranicza. Granica wybrana w spokoju trwa dłużej niż pragnienie.',
  },
  'trend.savings_rate_up': {
    title: 'Stopa oszczędności wzrosła',
    message:
      'Zachowano {{rate}}% dochodu — o {{diff}} p.p. więcej niż w zeszłym miesiącu. Umiar działa.',
  },
  'trend.savings_rate_down': {
    title: 'Stopa oszczędności spadła',
    message:
      'Zachowano {{rate}}% dochodu — o {{diff}} p.p. mniej niż w zeszłym miesiącu. Patrz na to, co urosło, a nie na to, czego brakuje.',
  },
  'pattern.risky_allocation': {
    title: 'Zbyt wiele zależy od losu',
    message:
      '{{percent}}% aktywów jest w średnim lub wysokim ryzyku — powyżej progu {{threshold}}%. Trzymaj większość tego, co posiadasz, poza zasięgiem przypadku.',
  },
};

const it: TranslationMap = {
  'operational.unapproved': {
    title: 'Transazioni attendono il tuo giudizio',
    message: 'In attesa di approvazione: {{count}}. Risolvile oggi invece di portartele dietro.',
  },
  'operational.uncategorized': {
    title: 'Spese senza nome',
    message: 'Transazioni senza categoria: {{count}}. Ciò che non ha nome non si può pesare.',
  },
  'operational.duplicates': {
    title: 'Possibili duplicati trovati',
    message:
      'Possibili duplicati: {{count}}. Vedi le cose come sono: conta ciascuna una volta sola.',
  },
  'trend.category_rising': {
    title: 'Categoria in crescita',
    message:
      'La spesa per "{{category}}" supera del {{percent}}% la media di 3 mesi. Chiediti se è lei a servire te o tu a servire lei.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'La tua spesa maggiore non ha misura',
    message:
      '"{{category}}" è la spesa maggiore del mese e nulla la limita. Un limite scelto con calma dura più di una voglia.',
  },
  'trend.savings_rate_up': {
    title: 'Tasso di risparmio in aumento',
    message:
      'Hai conservato il {{rate}}% del reddito: {{diff}} p.p. in più del mese scorso. La moderazione sta dando frutto.',
  },
  'trend.savings_rate_down': {
    title: 'Tasso di risparmio in calo',
    message:
      'Hai conservato il {{rate}}% del reddito: {{diff}} p.p. in meno del mese scorso. Guarda ciò che è cresciuto, non ciò che ti manca.',
  },
  'pattern.risky_allocation': {
    title: 'Troppo dipende dalla fortuna',
    message:
      'Il {{percent}}% degli asset è a rischio medio o alto, oltre la soglia del {{threshold}}%. Tieni la maggior parte di ciò che possiedi fuori dalla portata del caso.',
  },
};

const sk: TranslationMap = {
  'operational.unapproved': {
    title: 'Transakcie čakajú na váš úsudok',
    message:
      'Čakajúce na potvrdenie: {{count}}. Vyriešte ich dnes, namiesto toho, aby ste ich nosili so sebou.',
  },
  'operational.uncategorized': {
    title: 'Výdavky bez mena',
    message: 'Transakcie bez kategórie: {{count}}. Čo nie je pomenované, nedá sa odvážiť.',
  },
  'operational.duplicates': {
    title: 'Nájdené možné duplikáty',
    message:
      'Možné duplikáty: {{count}}. Pozerajte sa na veci také, aké sú — každú počítajte len raz.',
  },
  'trend.category_rising': {
    title: 'Kategória rastie',
    message:
      'Výdavky na "{{category}}" sú o {{percent}}% vyššie než 3-mesačný priemer. Opýtajte sa: slúži ona vám, alebo vy jej?',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Váš najväčší výdavok nemá mieru',
    message:
      '"{{category}}" je tento mesiac najväčší výdavok a nič ho neobmedzuje. Hranica zvolená v pokoji vydrží dlhšie než túžba.',
  },
  'trend.savings_rate_up': {
    title: 'Miera úspor stúpla',
    message:
      'Ušetrili ste {{rate}}% príjmu — o {{diff}} p.b. viac než minulý mesiac. Striedmosť prináša ovocie.',
  },
  'trend.savings_rate_down': {
    title: 'Miera úspor klesla',
    message:
      'Ušetrili ste {{rate}}% príjmu — o {{diff}} p.b. menej než minulý mesiac. Pozerajte na to, čo narástlo, nie na to, čo chýba.',
  },
  'pattern.risky_allocation': {
    title: 'Príliš veľa závisí od šťasteny',
    message:
      '{{percent}}% aktív je v strednom alebo vysokom riziku — nad hranicou {{threshold}}%. Väčšinu toho, čo vlastníte, držte mimo dosahu náhody.',
  },
};

const ja: TranslationMap = {
  'operational.unapproved': {
    title: '取引があなたの判断を待っています',
    message: '承認待ち：{{count}} 件。抱え込まず、今日のうちに片付けましょう。',
  },
  'operational.uncategorized': {
    title: '名前のない支出',
    message: 'カテゴリ未設定の取引：{{count}} 件。名付けられていないものは、量ることができません。',
  },
  'operational.duplicates': {
    title: '重複の可能性を検出',
    message: '重複の可能性：{{count}} 件。物事をありのままに見て、一つずつ一度だけ数えましょう。',
  },
  'trend.category_rising': {
    title: 'カテゴリの支出が増加',
    message:
      '「{{category}}」の支出が3か月平均より {{percent}}% 多くなっています。それがあなたに仕えているのか、あなたがそれに仕えているのか、問いかけてみてください。',
  },
  'pattern.unbudgeted_top_category': {
    title: '最大の支出に限度がありません',
    message:
      '「{{category}}」は今月最大の支出ですが、何も制限していません。落ち着いて決めた限度は、欲望よりも長く持ちこたえます。',
  },
  'trend.savings_rate_up': {
    title: '貯蓄率が上昇',
    message:
      '収入の {{rate}}% を残せました。先月より {{diff}} ポイント増です。節度が実を結んでいます。',
  },
  'trend.savings_rate_down': {
    title: '貯蓄率が低下',
    message:
      '収入の {{rate}}% を残しました。先月より {{diff}} ポイント減です。足りないものではなく、育ったものに目を向けましょう。',
  },
  'pattern.risky_allocation': {
    title: '運に左右されるものが多すぎます',
    message:
      '資産の {{percent}}% が中〜高リスクにあり、上限の {{threshold}}% を超えています。持っているものの大半を、偶然の手の届かない所に置きましょう。',
  },
};

const ko: TranslationMap = {
  'operational.unapproved': {
    title: '거래가 당신의 판단을 기다립니다',
    message: '승인 대기: {{count}}건. 짊어지고 다니지 말고 오늘 정리하세요.',
  },
  'operational.uncategorized': {
    title: '이름 없는 지출',
    message: '카테고리 없는 거래: {{count}}건. 이름 붙이지 않은 것은 가늠할 수 없습니다.',
  },
  'operational.duplicates': {
    title: '중복 가능성 발견',
    message: '중복 가능 항목: {{count}}건. 있는 그대로 보고, 하나는 한 번만 세세요.',
  },
  'trend.category_rising': {
    title: '카테고리 지출 증가',
    message:
      '"{{category}}" 지출이 3개월 평균보다 {{percent}}% 많습니다. 그것이 당신을 섬기는지, 당신이 그것을 섬기는지 물어보세요.',
  },
  'pattern.unbudgeted_top_category': {
    title: '가장 큰 지출에 한도가 없습니다',
    message:
      '"{{category}}"은(는) 이번 달 가장 큰 지출인데 아무것도 이를 제한하지 않습니다. 차분할 때 정한 한도는 욕구보다 오래갑니다.',
  },
  'trend.savings_rate_up': {
    title: '저축률 상승',
    message:
      '소득의 {{rate}}%를 지켰습니다. 지난달보다 {{diff}}%p 높습니다. 절제가 효과를 내고 있습니다.',
  },
  'trend.savings_rate_down': {
    title: '저축률 하락',
    message:
      '소득의 {{rate}}%를 지켰습니다. 지난달보다 {{diff}}%p 낮습니다. 부족한 것이 아니라 자라난 것을 보세요.',
  },
  'pattern.risky_allocation': {
    title: '너무 많은 것이 운에 달려 있습니다',
    message:
      '자산의 {{percent}}%가 중간 또는 높은 위험에 있어 {{threshold}}% 한도를 넘습니다. 가진 것의 대부분을 우연의 손이 닿지 않는 곳에 두세요.',
  },
};

const hi: TranslationMap = {
  'operational.unapproved': {
    title: 'लेन-देन आपके निर्णय की प्रतीक्षा में हैं',
    message: 'पुष्टि की प्रतीक्षा में: {{count}}। इन्हें साथ लेकर न चलें, आज ही निपटा दें।',
  },
  'operational.uncategorized': {
    title: 'बिना नाम का खर्च',
    message: 'बिना श्रेणी के लेन-देन: {{count}}। जिसका नाम नहीं, उसे तौला नहीं जा सकता।',
  },
  'operational.duplicates': {
    title: 'संभावित डुप्लिकेट मिले',
    message: 'संभावित डुप्लिकेट: {{count}}। चीज़ों को जैसी हैं वैसी देखें — हर एक को एक ही बार गिनें।',
  },
  'trend.category_rising': {
    title: 'श्रेणी में खर्च बढ़ रहा है',
    message:
      '"{{category}}" पर खर्च 3-महीने के औसत से {{percent}}% अधिक है। स्वयं से पूछें: यह आपकी सेवा करता है या आप इसकी?',
  },
  'pattern.unbudgeted_top_category': {
    title: 'आपके सबसे बड़े खर्च की कोई सीमा नहीं',
    message:
      '"{{category}}" इस महीने का सबसे बड़ा खर्च है और इसे कुछ भी सीमित नहीं करता। शांत मन से चुनी गई सीमा लालसा से अधिक टिकती है।',
  },
  'trend.savings_rate_up': {
    title: 'बचत दर बढ़ी',
    message: 'आपने आय का {{rate}}% बचाया — पिछले महीने से {{diff}} अंक अधिक। संयम अपना काम कर रहा है।',
  },
  'trend.savings_rate_down': {
    title: 'बचत दर घटी',
    message:
      'आपने आय का {{rate}}% बचाया — पिछले महीने से {{diff}} अंक कम। जो बढ़ा है उसे देखें, जो कम है उसे नहीं।',
  },
  'pattern.risky_allocation': {
    title: 'बहुत कुछ भाग्य पर निर्भर है',
    message:
      '{{percent}}% संपत्तियाँ मध्यम या उच्च जोखिम में हैं — {{threshold}}% सीमा से अधिक। अपनी अधिकांश चीज़ें संयोग की पहुँच से दूर रखें।',
  },
};

const nl: TranslationMap = {
  'operational.unapproved': {
    title: 'Transacties wachten op je oordeel',
    message:
      'Wachtend op goedkeuring: {{count}}. Handel ze vandaag af in plaats van ze mee te dragen.',
  },
  'operational.uncategorized': {
    title: 'Uitgaven zonder naam',
    message: 'Transacties zonder categorie: {{count}}. Wat geen naam heeft, kun je niet wegen.',
  },
  'operational.duplicates': {
    title: 'Mogelijke duplicaten gevonden',
    message:
      'Mogelijke duplicaten: {{count}}. Zie de dingen zoals ze zijn — tel elk maar één keer.',
  },
  'trend.category_rising': {
    title: 'Categorie stijgt',
    message:
      'Uitgaven aan "{{category}}" liggen {{percent}}% boven het 3-maandsgemiddelde. Vraag je af: dient het jou, of dien jij het?',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Je grootste uitgave heeft geen maat',
    message:
      '"{{category}}" is deze maand je grootste uitgave en niets begrenst haar. Een grens die je in kalmte kiest, houdt het langer vol dan een verlangen.',
  },
  'trend.savings_rate_up': {
    title: 'Spaarquote gestegen',
    message:
      'Je hield {{rate}}% van je inkomen over — {{diff}} procentpunt meer dan vorige maand. Matigheid doet haar werk.',
  },
  'trend.savings_rate_down': {
    title: 'Spaarquote gedaald',
    message:
      'Je hield {{rate}}% van je inkomen over — {{diff}} procentpunt minder dan vorige maand. Kijk naar wat gegroeid is, niet naar wat ontbreekt.',
  },
  'pattern.risky_allocation': {
    title: 'Te veel hangt af van het lot',
    message:
      '{{percent}}% van de activa zit in middel of hoog risico — boven de grens van {{threshold}}%. Houd het meeste van wat je bezit buiten bereik van het toeval.',
  },
};

const sv: TranslationMap = {
  'operational.unapproved': {
    title: 'Transaktioner väntar på ditt omdöme',
    message:
      'Väntar på godkännande: {{count}}. Avgör dem i dag i stället för att bära dem med dig.',
  },
  'operational.uncategorized': {
    title: 'Utgifter utan namn',
    message: 'Transaktioner utan kategori: {{count}}. Det som inte har ett namn kan inte vägas.',
  },
  'operational.duplicates': {
    title: 'Möjliga dubbletter hittade',
    message: 'Möjliga dubbletter: {{count}}. Se saker som de är — räkna var och en bara en gång.',
  },
  'trend.category_rising': {
    title: 'Kategorin ökar',
    message:
      'Utgifterna för "{{category}}" är {{percent}}% över 3-månaderssnittet. Fråga dig om den tjänar dig eller du den.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Din största utgift saknar gräns',
    message:
      '"{{category}}" är månadens största utgift och inget begränsar den. En gräns som väljs i lugn håller längre än ett begär.',
  },
  'trend.savings_rate_up': {
    title: 'Sparkvoten har ökat',
    message:
      'Du behöll {{rate}}% av inkomsten — {{diff}} procentenheter mer än förra månaden. Måttfullheten gör sitt jobb.',
  },
  'trend.savings_rate_down': {
    title: 'Sparkvoten har minskat',
    message:
      'Du behöll {{rate}}% av inkomsten — {{diff}} procentenheter mindre än förra månaden. Se på det som har vuxit, inte på det som fattas.',
  },
  'pattern.risky_allocation': {
    title: 'För mycket hänger på turen',
    message:
      '{{percent}}% av tillgångarna ligger i medel eller hög risk — över gränsen på {{threshold}}%. Håll det mesta av det du äger utom räckhåll för slumpen.',
  },
};

const vi: TranslationMap = {
  'operational.unapproved': {
    title: 'Giao dịch đang chờ bạn phán định',
    message: 'Đang chờ duyệt: {{count}}. Hãy giải quyết hôm nay thay vì mang chúng theo mình.',
  },
  'operational.uncategorized': {
    title: 'Khoản chi không tên',
    message: 'Giao dịch chưa có danh mục: {{count}}. Điều chưa được gọi tên thì không thể cân đo.',
  },
  'operational.duplicates': {
    title: 'Phát hiện bản trùng',
    message:
      'Bản trùng tiềm ẩn: {{count}}. Hãy nhìn sự việc đúng như nó là — mỗi khoản chỉ tính một lần.',
  },
  'trend.category_rising': {
    title: 'Danh mục đang tăng',
    message:
      'Chi tiêu cho "{{category}}" cao hơn {{percent}}% so với trung bình 3 tháng. Hãy tự hỏi: nó phục vụ bạn, hay bạn phục vụ nó?',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Khoản chi lớn nhất không có giới hạn',
    message:
      '"{{category}}" là khoản chi lớn nhất tháng này và không có gì giới hạn nó. Một giới hạn chọn trong bình tĩnh bền hơn một cơn thèm muốn.',
  },
  'trend.savings_rate_up': {
    title: 'Tỷ lệ tiết kiệm tăng',
    message:
      'Bạn giữ lại {{rate}}% thu nhập — nhiều hơn tháng trước {{diff}} điểm. Sự điều độ đang phát huy tác dụng.',
  },
  'trend.savings_rate_down': {
    title: 'Tỷ lệ tiết kiệm giảm',
    message:
      'Bạn giữ lại {{rate}}% thu nhập — ít hơn tháng trước {{diff}} điểm. Hãy nhìn vào những gì đã lớn lên, không phải những gì còn thiếu.',
  },
  'pattern.risky_allocation': {
    title: 'Quá nhiều thứ phụ thuộc vào may rủi',
    message:
      '{{percent}}% tài sản ở mức rủi ro trung bình hoặc cao — vượt ngưỡng {{threshold}}%. Hãy giữ phần lớn những gì bạn sở hữu ngoài tầm với của may rủi.',
  },
};

const id: TranslationMap = {
  'operational.unapproved': {
    title: 'Transaksi menunggu penilaian Anda',
    message: 'Menunggu persetujuan: {{count}}. Selesaikan hari ini daripada terus memikulnya.',
  },
  'operational.uncategorized': {
    title: 'Pengeluaran tanpa nama',
    message: 'Transaksi tanpa kategori: {{count}}. Yang tidak dinamai tidak bisa ditimbang.',
  },
  'operational.duplicates': {
    title: 'Kemungkinan duplikat ditemukan',
    message:
      'Kemungkinan duplikat: {{count}}. Lihat segala sesuatu apa adanya — hitung masing-masing sekali saja.',
  },
  'trend.category_rising': {
    title: 'Kategori meningkat',
    message:
      'Pengeluaran "{{category}}" {{percent}}% di atas rata-rata 3 bulan. Tanyakan pada diri sendiri: ia melayani Anda, atau Anda melayaninya?',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Pengeluaran terbesar Anda tanpa batas',
    message:
      '"{{category}}" adalah pengeluaran terbesar bulan ini dan tidak ada yang membatasinya. Batas yang dipilih dengan tenang bertahan lebih lama daripada keinginan.',
  },
  'trend.savings_rate_up': {
    title: 'Rasio tabungan naik',
    message:
      'Anda menyimpan {{rate}}% pendapatan — {{diff}} poin lebih tinggi dari bulan lalu. Pengendalian diri membuahkan hasil.',
  },
  'trend.savings_rate_down': {
    title: 'Rasio tabungan turun',
    message:
      'Anda menyimpan {{rate}}% pendapatan — {{diff}} poin lebih rendah dari bulan lalu. Lihat apa yang telah tumbuh, bukan apa yang kurang.',
  },
  'pattern.risky_allocation': {
    title: 'Terlalu banyak bergantung pada nasib',
    message:
      '{{percent}}% aset berada di risiko menengah atau tinggi — di atas batas {{threshold}}%. Jaga sebagian besar milik Anda di luar jangkauan kebetulan.',
  },
};

const da: TranslationMap = {
  'operational.unapproved': {
    title: 'Posteringer afventer din vurdering',
    message:
      '{{count}} posteringer venter på godkendelse. Afgør dem i dag frem for at bære dem videre.',
  },
  'operational.uncategorized': {
    title: 'Udgifter uden navn',
    message:
      '{{count}} posteringer har ingen kategori. Det, der ikke er navngivet, kan ikke vejes.',
  },
  'operational.duplicates': {
    title: 'Mulige dubletter fundet',
    message: '{{count}} mulige dubletter fundet. Se tingene, som de er — tæl hver én gang.',
  },
  'trend.category_rising': {
    title: 'Kategorien stiger',
    message:
      'Udgifterne til "{{category}}" er {{percent}} % over deres 3-måneders gennemsnit. Spørg, om den tjener dig, eller du tjener den.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Din største udgift har ingen grænse',
    message:
      '"{{category}}" er din største udgift denne måned, og intet måler den. En grænse valgt i ro holder længere end et lune.',
  },
  'trend.savings_rate_up': {
    title: 'Opsparingsraten er steget',
    message:
      'Du beholdt {{rate}} % af indtægten — {{diff}} point mere end sidste måned. Mådeholdet gør sit arbejde.',
  },
  'trend.savings_rate_down': {
    title: 'Opsparingsraten er faldet',
    message:
      'Du beholdt {{rate}} % af indtægten — {{diff}} point mindre end sidste måned. Se på det, der voksede, ikke på det, du mangler.',
  },
  'pattern.risky_allocation': {
    title: 'For meget afhænger af held',
    message:
      '{{percent}} % af aktiverne ligger i mellem eller høj risiko — over grænsen på {{threshold}} %. Hold det meste af det, du ejer, uden for heldets rækkevidde.',
  },
};

const nb: TranslationMap = {
  'operational.unapproved': {
    title: 'Transaksjoner venter på din vurdering',
    message:
      '{{count}} transaksjoner venter på godkjenning. Avgjør dem i dag i stedet for å bære dem videre.',
  },
  'operational.uncategorized': {
    title: 'Utgifter uten navn',
    message:
      '{{count}} transaksjoner har ingen kategori. Det som ikke er navngitt, kan ikke veies.',
  },
  'operational.duplicates': {
    title: 'Mulige duplikater funnet',
    message: '{{count}} mulige duplikater funnet. Se tingene som de er — tell hver én gang.',
  },
  'trend.category_rising': {
    title: 'Kategorien stiger',
    message:
      'Utgiftene til "{{category}}" er {{percent}} % over sitt 3-måneders gjennomsnitt. Spør om den tjener deg, eller du tjener den.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Din største utgift har ingen grense',
    message:
      '"{{category}}" er din største utgift denne måneden, og ingenting måler den. En grense valgt i ro varer lenger enn et innfall.',
  },
  'trend.savings_rate_up': {
    title: 'Spareraten er opp',
    message:
      'Du beholdt {{rate}} % av inntekten — {{diff}} poeng mer enn forrige måned. Måteholdet gjør sitt.',
  },
  'trend.savings_rate_down': {
    title: 'Spareraten er ned',
    message:
      'Du beholdt {{rate}} % av inntekten — {{diff}} poeng mindre enn forrige måned. Se på det som vokste, ikke på det du mangler.',
  },
  'pattern.risky_allocation': {
    title: 'For mye avhenger av flaks',
    message:
      '{{percent}} % av eiendelene ligger i middels eller høy risiko — over grensen på {{threshold}} %. Hold det meste av det du eier utenfor flaksens rekkevidde.',
  },
};

const nn: TranslationMap = {
  'operational.unapproved': {
    title: 'Transaksjonar ventar på vurderinga di',
    message:
      '{{count}} transaksjonar ventar på godkjenning. Avgjer dei i dag i staden for å bere dei vidare.',
  },
  'operational.uncategorized': {
    title: 'Utgifter utan namn',
    message:
      '{{count}} transaksjonar har ingen kategori. Det som ikkje er namngjeve, kan ikkje vegast.',
  },
  'operational.duplicates': {
    title: 'Moglege duplikat funne',
    message: '{{count}} moglege duplikat funne. Sjå tinga som dei er — tel kvar éin gong.',
  },
  'trend.category_rising': {
    title: 'Kategorien stig',
    message:
      'Utgiftene til "{{category}}" er {{percent}} % over sitt 3-månaders gjennomsnitt. Spør om han tener deg, eller du tener han.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Den største utgifta di har ingen grense',
    message:
      '"{{category}}" er den største utgifta di denne månaden, og ingenting måler henne. Ei grense vald i ro varer lenger enn eit innfall.',
  },
  'trend.savings_rate_up': {
    title: 'Sparerata er opp',
    message:
      'Du heldt att {{rate}} % av inntekta — {{diff}} poeng meir enn førre månad. Måtehaldet gjer sitt.',
  },
  'trend.savings_rate_down': {
    title: 'Sparerata er ned',
    message:
      'Du heldt att {{rate}} % av inntekta — {{diff}} poeng mindre enn førre månad. Sjå på det som voks, ikkje på det du manglar.',
  },
  'pattern.risky_allocation': {
    title: 'For mykje heng på flaks',
    message:
      '{{percent}} % av eigedelane ligg i middels eller høg risiko — over grensa på {{threshold}} %. Hald det meste av det du eig utanfor rekkjevidda til flaksen.',
  },
};

const fi: TranslationMap = {
  'operational.unapproved': {
    title: 'Tapahtumat odottavat arviotasi',
    message:
      '{{count}} tapahtumaa odottaa hyväksyntää. Ratkaise ne tänään sen sijaan että kannat niitä mukanasi.',
  },
  'operational.uncategorized': {
    title: 'Kuluja ilman nimeä',
    message: '{{count}} tapahtumalla ei ole kategoriaa. Sitä mitä ei ole nimetty, ei voi punnita.',
  },
  'operational.duplicates': {
    title: 'Mahdollisia kaksoiskappaleita löytyi',
    message:
      '{{count}} mahdollista kaksoiskappaletta havaittu. Katso asiat sellaisina kuin ne ovat — laske jokainen kerran.',
  },
  'trend.category_rising': {
    title: 'Kategoria kasvaa',
    message:
      'Kulut kohteeseen "{{category}}" ovat {{percent}} % yli kolmen kuukauden keskiarvon. Kysy, palveleeko se sinua vai sinä sitä.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Suurimmalla kulullasi ei ole rajaa',
    message:
      '"{{category}}" on tämän kuun suurin kulusi, eikä mikään mittaa sitä. Rauhassa valittu raja kestää kaipauksen yli.',
  },
  'trend.savings_rate_up': {
    title: 'Säästöaste nousi',
    message:
      'Pidit {{rate}} % tuloista — {{diff}} pistettä enemmän kuin viime kuussa. Kohtuus tekee työtään.',
  },
  'trend.savings_rate_down': {
    title: 'Säästöaste laski',
    message:
      'Pidit {{rate}} % tuloista — {{diff}} pistettä vähemmän kuin viime kuussa. Katso mikä kasvoi, älä sitä mitä puuttuu.',
  },
  'pattern.risky_allocation': {
    title: 'Liian paljon riippuu onnesta',
    message:
      '{{percent}} % varoista on keskisuuressa tai korkeassa riskissä — yli {{threshold}} %:n rajan. Pidä suurin osa omaisuudestasi onnen ulottumattomissa.',
  },
};

const is: TranslationMap = {
  'operational.unapproved': {
    title: 'Færslur bíða þíns dóms',
    message: '{{count}} færslur bíða samþykkis. Gerðu út um þær í dag í stað að bera þær áfram.',
  },
  'operational.uncategorized': {
    title: 'Útgjöld án nafns',
    message: '{{count}} færslur hafa enga kategoríu. Það sem er ónefnt er ekki unnt að vega.',
  },
  'operational.duplicates': {
    title: 'Mögulegar tvítökur fundust',
    message:
      '{{count}} mögulegar tvítökur greindar. Sjáðu hlutina eins og þeir eru — teldu hvern einu sinni.',
  },
  'trend.category_rising': {
    title: 'Kategorían vex',
    message:
      'Útgjöld í "{{category}}" eru {{percent}} % yfir þriggja mánaða meðaltali. Spurðu hvort hún þjóni þér eða þú henni.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Stærsta útgjaldið þitt hefur engin mörk',
    message:
      '"{{category}}" er stærsta útgjaldið þitt þennan mánuð og ekkert mælir það. Mark valið í kyrrð lifir löngun af.',
  },
  'trend.savings_rate_up': {
    title: 'Sparnaðarhlutfall hækkar',
    message:
      'Þú hélst {{rate}} % af tekjum — {{diff}} stigum meira en síðasta mánuð. Hófsemin vinnur sitt verk.',
  },
  'trend.savings_rate_down': {
    title: 'Sparnaðarhlutfall lækkar',
    message:
      'Þú hélst {{rate}} % af tekjum — {{diff}} stigum minna en síðasta mánuð. Horfðu á það sem vex, ekki á það sem vantar.',
  },
  'pattern.risky_allocation': {
    title: 'Of margt hangir á gæfunni',
    message:
      '{{percent}} % eigna liggja í miðlungs eða mikilli hættu — yfir markinu {{threshold}} %. Haltu mestu af því sem þú eigur utan seilingar gæfunnar.',
  },
};

const fo: TranslationMap = {
  'operational.unapproved': {
    title: 'Posteringar bíða tínum dómi',
    message:
      '{{count}} posteringar bíða góðkenning. Avger tær í dag heldur enn at bera tær víðari.',
  },
  'operational.uncategorized': {
    title: 'Útgjøld uttan navn',
    message: '{{count}} posteringar hava ongan bólk. Tað sum ikki hevur navn, kann ikki vigast.',
  },
  'operational.duplicates': {
    title: 'Møguligar dupletir funnar',
    message:
      '{{count}} møguligar dupletir funnar. Síggj tingini sum tey eru — tel hvørt eina ferð.',
  },
  'trend.category_rising': {
    title: 'Bólkurin veksur',
    message:
      'Útgjøldini til "{{category}}" eru {{percent}} % yvir 3-mánaða miðalinum. Spyr um hann tænar tær, ella tú honum.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Títt størsta útgjald hevur onki mark',
    message:
      '"{{category}}" er títt størsta útgjald henda mánaðin, og einki mátar tað. Eitt mark valt í stillheit varir longur enn eitt lund.',
  },
  'trend.savings_rate_up': {
    title: 'Sparistigið er hægri',
    message:
      'Tú helt {{rate}} % av inntøkuni — {{diff}} stig meira enn seinasta mánað. Mátahaldið ger sítt.',
  },
  'trend.savings_rate_down': {
    title: 'Sparistigið er lægri',
    message:
      'Tú helt {{rate}} % av inntøkuni — {{diff}} stig minni enn seinasta mánað. Hygg at tí sum vaks, ikki at tí tú manglar.',
  },
  'pattern.risky_allocation': {
    title: 'Ov mikið hongur á happi',
    message:
      '{{percent}} % av eignunum liggja í miðal ella høgum vanda — yvir markinum {{threshold}} %. Hav tað mesta av tí tú eigur uttan fyri rák happsins.',
  },
};

const cs: TranslationMap = {
  'operational.unapproved': {
    title: 'Transakce čekají na váš soud',
    message: '{{count}} transakcí čeká na schválení. Vyřiďte je dnes, místo abyste je nesli dál.',
  },
  'operational.uncategorized': {
    title: 'Výdaje bez jména',
    message: '{{count}} transakcí nemá kategorii. Co není pojmenováno, nelze zvážit.',
  },
  'operational.duplicates': {
    title: 'Nalezeny možné duplicity',
    message:
      '{{count}} možných duplicit zjištěno. Viďte věci, jaké jsou — spočítejte každou jednou.',
  },
  'trend.category_rising': {
    title: 'Kategorie roste',
    message:
      'Výdaje na "{{category}}" jsou {{percent}} % nad svým tříměsíčním průměrem. Zvažte, zda slouží vám, nebo vy jí.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Váš největší výdaj nemá limit',
    message:
      '"{{category}}" je tento měsíc váš největší výdaj a nic jej neměří. Limit zvolený v klidu přetrvá chuť okamžiku.',
  },
  'trend.savings_rate_up': {
    title: 'Míra spoření vzrostla',
    message:
      'Ponechali jste si {{rate}} % příjmu — o {{diff}} bodů více než minulý měsíc. Umírněnost koná své.',
  },
  'trend.savings_rate_down': {
    title: 'Míra spoření klesla',
    message:
      'Ponechali jste si {{rate}} % příjmu — o {{diff}} bodů méně než minulý měsíc. Hleďte na to, co vyrostlo, ne na to, co chybí.',
  },
  'pattern.risky_allocation': {
    title: 'Příliš mnoho závisí na náhodě',
    message:
      '{{percent}} % aktiv leží ve středním nebo vysokém riziku — nad limitem {{threshold}} %. Většinu toho, co máte, držte mimo dosah náhody.',
  },
};

const bg: TranslationMap = {
  'operational.unapproved': {
    title: 'Транзакции чакат вашата преценка',
    message:
      '{{count}} транзакции чакат одобрение. Решете ги днес, вместо да ги носите със себе си.',
  },
  'operational.uncategorized': {
    title: 'Разходи без име',
    message:
      '{{count}} транзакции са без категория. Което не е назовано, не може да бъде претеглено.',
  },
  'operational.duplicates': {
    title: 'Намерени са възможни дубликати',
    message:
      'Открити са {{count}} възможни дубликата. Виждайте нещата такива, какви са — броете всяко по веднъж.',
  },
  'trend.category_rising': {
    title: 'Категорията расте',
    message:
      'Разходите за "{{category}}" са {{percent}} % над тримесечната си средна стойност. Запитайте се служи ли ви тя, или вие на нея.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Най-големият ви разход е без лимит',
    message:
      '"{{category}}" е най-големият ви разход този месец и нищо не го измерва. Лимит, избран на спокойствие, надживява прищявката.',
  },
  'trend.savings_rate_up': {
    title: 'Нормата на спестяване се повиши',
    message:
      'Запазихте {{rate}} % от дохода — {{diff}} пункта повече от миналия месец. Умереността си върши работата.',
  },
  'trend.savings_rate_down': {
    title: 'Нормата на спестяване спадна',
    message:
      'Запазихте {{rate}} % от дохода — {{diff}} пункта по-малко от миналия месец. Гледайте какво нарасна, не какво ви липсва.',
  },
  'pattern.risky_allocation': {
    title: 'Прекалено много зависи от случайността',
    message:
      '{{percent}} % от активите са в среден или висок риск — над лимита от {{threshold}} %. Дръжте по-голямата част от онова, което притежавате, извън обсега на случайността.',
  },
};

const hr: TranslationMap = {
  'operational.unapproved': {
    title: 'Transakcije čekaju vašu ocjenu',
    message: '{{count}} transakcija čeka odobrenje. Riješite ih danas umjesto da ih nosite dalje.',
  },
  'operational.uncategorized': {
    title: 'Troškovi bez imena',
    message: '{{count}} transakcija nema kategoriju. Što nije imenovano, ne može se izmjeriti.',
  },
  'operational.duplicates': {
    title: 'Nađeni mogući duplikati',
    message:
      'Otkriveno je {{count}} mogućih duplikata. Gledajte stvari kakve su — izbrojte svaku jedanput.',
  },
  'trend.category_rising': {
    title: 'Kategorija raste',
    message:
      'Troškovi na "{{category}}" {{percent}} % su iznad svojeg tromjesečnog prosjeka. Pitajte služi li ona vama ili vi njoj.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Vaš najveći trošak nema ograničenje',
    message:
      '"{{category}}" je vaš najveći trošak ovaj mjesec i ništa ga ne mjeri. Ograničenje odabrano u miru nadživi hir.',
  },
  'trend.savings_rate_up': {
    title: 'Stopa štednje je porasla',
    message:
      'Zadržali ste {{rate}} % prihoda — {{diff}} bodova više nego prošli mjesec. Umjerenost radi svoje.',
  },
  'trend.savings_rate_down': {
    title: 'Stopa štednje je pala',
    message:
      'Zadržali ste {{rate}} % prihoda — {{diff}} bodova manje nego prošli mjesec. Gledajte što je naraslo, ne što vam manjka.',
  },
  'pattern.risky_allocation': {
    title: 'Previše ovisi o sreći',
    message:
      '{{percent}} % imovine je u srednjem ili visokom riziku — iznad ograničenja od {{threshold}} %. Većinu onoga što imate držite izvan dosega sreće.',
  },
};

const sr: TranslationMap = {
  'operational.unapproved': {
    title: 'Трансакције чекају вашу оцену',
    message: '{{count}} трансакција чека одобрење. Решите их данас уместо да их носите даље.',
  },
  'operational.uncategorized': {
    title: 'Трошкови без имена',
    message: '{{count}} трансакција нема категорију. Што није именовано, не може се измерити.',
  },
  'operational.duplicates': {
    title: 'Нађени могући дупликати',
    message:
      'Откривено је {{count}} могућих дупликата. Гледајте ствари какве су — избројте сваку једанпут.',
  },
  'trend.category_rising': {
    title: 'Категорија расте',
    message:
      'Трошкови на "{{category}}" {{percent}} % су изнад свог тромесечног просека. Питајте служи ли она вама или ви њој.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Ваш највећи трошак нема ограничење',
    message:
      '"{{category}}" је ваш највећи трошак овог месеца и ништа га не мери. Ограничење изабрано у миру надживи хир.',
  },
  'trend.savings_rate_up': {
    title: 'Стопа штедње је порасла',
    message:
      'Задржали сте {{rate}} % прихода — {{diff}} поена више него прошлог месеца. Умереност радi своје.',
  },
  'trend.savings_rate_down': {
    title: 'Стопа штедње је пала',
    message:
      'Задржали сте {{rate}} % прихода — {{diff}} поена мање него прошлог месеца. Гледајте шта је нарасло, не шта вам мањка.',
  },
  'pattern.risky_allocation': {
    title: 'Превише зависи од среће',
    message:
      '{{percent}} % активе је у средњем или високом ризику — изнад ограничења од {{threshold}} %. Већину онога што имате држите изван домашаја среће.',
  },
};

const sl: TranslationMap = {
  'operational.unapproved': {
    title: 'Transakcije čakajo na vašo presojo',
    message: '{{count}} transakcij čaka odobritev. Rešite jih danes, namesto da jih nosite naprej.',
  },
  'operational.uncategorized': {
    title: 'Izdatki brez imena',
    message: '{{count}} transakcij nima kategorije. Kar ni poimenovano, se ne da stehtati.',
  },
  'operational.duplicates': {
    title: 'Najdeni možni dvojniki',
    message:
      'Zaznanih je {{count}} možnih dvojnikov. Glejte stvari, kakršne so — vsako šteje enkrat.',
  },
  'trend.category_rising': {
    title: 'Kategorija narašča',
    message:
      'Izdatki za "{{category}}" so {{percent}} % nad trimesečnim povprečjem. Vprašajte se, ali služi vam ali vi njej.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Vaš največji izdatek nima omejitve',
    message:
      '"{{category}}" je ta mesec vaš največji izdatek in nič ga ne meri. Omejitev, izbrana v miru, preživi trenutno željo.',
  },
  'trend.savings_rate_up': {
    title: 'Stopnja varčevanja je zrasla',
    message:
      'Obdržali ste {{rate}} % prihodka — {{diff}} točk več kot prejšnji mesec. Zmernost opravlja svoje.',
  },
  'trend.savings_rate_down': {
    title: 'Stopnja varčevanja je padla',
    message:
      'Obdržali ste {{rate}} % prihodka — {{diff}} točk manj kot prejšnji mesec. Glejte, kaj je zraslo, ne kaj vam manjka.',
  },
  'pattern.risky_allocation': {
    title: 'Preveč je odvisno od sreče',
    message:
      '{{percent}} % sredstev je v srednjem ali visokem tveganju — nad omejitvijo {{threshold}} %. Večino tega, kar imate, držite zunaj dosega sreče.',
  },
};

const mk: TranslationMap = {
  'operational.unapproved': {
    title: 'Трансакциите чекаат ваша оцена',
    message:
      '{{count}} трансакции чекаат одобрување. Решете ги денес наместо да ги носите понатаму.',
  },
  'operational.uncategorized': {
    title: 'Трошоци без име',
    message: '{{count}} трансакции немаат категорија. Што не е именувано, не може да се измери.',
  },
  'operational.duplicates': {
    title: 'Најдени можни дупликати',
    message:
      'Откриени се {{count}} можни дупликати. Гледајте ги работите какви што се — пребројте го секое по еднаш.',
  },
  'trend.category_rising': {
    title: 'Категоријата расте',
    message:
      'Трошоците за "{{category}}" се {{percent}} % над својот тримесечен просек. Прашајте се дали таа ви служи или вие на неа.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Вашиот најголем трошок нема лимит',
    message:
      '"{{category}}" е вашиот најголем трошок овој месец и ништо не го мери. Лимит избран во мир ја надживува желбата.',
  },
  'trend.savings_rate_up': {
    title: 'Стапката на штедење е повисока',
    message:
      'Задржавте {{rate}} % од приходот — {{diff}} поени повеќе од минатиот месец. Умереноста си го прави своето.',
  },
  'trend.savings_rate_down': {
    title: 'Стапката на штедење е пониска',
    message:
      'Задржавте {{rate}} % од приходот — {{diff}} поени помалку од минатиот месец. Гледајте што порасна, не што ви недостига.',
  },
  'pattern.risky_allocation': {
    title: 'Премногу зависи од среќата',
    message:
      '{{percent}} % од активата е во среден или висок риск — над лимитот од {{threshold}} %. Повеќето од тоа што го имате држете го надвор од дофатот на среќата.',
  },
};

const be: TranslationMap = {
  'operational.unapproved': {
    title: 'Транзакцыі чакаюць вашай ацэнкі',
    message: '{{count}} транзакцый чакаюць ухвалення. Вырашыце іх сёння, а не нясіце далей.',
  },
  'operational.uncategorized': {
    title: 'Выдаткі без імя',
    message: '{{count}} транзакцый без катэгорыі. Тое, што не названа, нельга ўзважыць.',
  },
  'operational.duplicates': {
    title: 'Знойдзены магчымыя дублікаты',
    message:
      'Выяўлена {{count}} магчымых дублікатаў. Бачце рэчы, якімі яны ёсць — лічыце кожную адзін раз.',
  },
  'trend.category_rising': {
    title: 'Катэгорыя расце',
    message:
      'Выдаткі на «{{category}}» на {{percent}} % вышэй за трохмесячнае сярэдняе. Спытайце, яна служыць вам ці вы ёй.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'У вашага найбольшага выдатку няма ліміту',
    message:
      '«{{category}}» — ваш найбольшы выдатак гэтага месяца, і нішто яго не мерае. Ліміт, выбраны ў спакоі, перажывае жаданне.',
  },
  'trend.savings_rate_up': {
    title: 'Норма заашчаджэння выросла',
    message:
      'Вы пакінулі {{rate}} % прыбытку — на {{diff}} пунктаў больш, чым у мінулым месяцы. Памяркоўнасць робіць сваё.',
  },
  'trend.savings_rate_down': {
    title: 'Норма заашчаджэння ўпала',
    message:
      'Вы пакінулі {{rate}} % прыбытку — на {{diff}} пунктаў менш, чым у мінулым месяцы. Глядзіце на тое, што вырасла, а не на тое, чаго не хапае.',
  },
  'pattern.risky_allocation': {
    title: 'Залішне многае залежыць ад выпадку',
    message:
      '{{percent}} % актываў у сярэдняй або высокай рызыцы — вышэй за ліміт {{threshold}} %. Трымайце большую частку свайго па-за дасяжнасцю выпадку.',
  },
};

const bs: TranslationMap = {
  'operational.unapproved': {
    title: 'Transakcije čekaju vašu ocjenu',
    message: '{{count}} transakcija čeka odobrenje. Riješite ih danas umjesto da ih nosite dalje.',
  },
  'operational.uncategorized': {
    title: 'Troškovi bez imena',
    message: '{{count}} transakcija nema kategoriju. Što nije imenovano, ne može se izmjeriti.',
  },
  'operational.duplicates': {
    title: 'Nađeni mogući duplikati',
    message:
      'Otkriveno je {{count}} mogućih duplikata. Gledajte stvari kakve su — izbrojte svaku jedanput.',
  },
  'trend.category_rising': {
    title: 'Kategorija raste',
    message:
      'Troškovi na "{{category}}" {{percent}} % su iznad svog tromjesečnog prosjeka. Pitajte služi li ona vama ili vi njoj.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Vaš najveći trošak nema ograničenje',
    message:
      '"{{category}}" je vaš najveći trošak ovaj mjesec i ništa ga ne mjeri. Ograničenje odabrano u miru nadživi hir.',
  },
  'trend.savings_rate_up': {
    title: 'Stopa štednje je porasla',
    message:
      'Zadržali ste {{rate}} % prihoda — {{diff}} bodova više nego prošli mjesec. Umjerenost radi svoje.',
  },
  'trend.savings_rate_down': {
    title: 'Stopa štednje je pala',
    message:
      'Zadržali ste {{rate}} % prihoda — {{diff}} bodova manje nego prošli mjesec. Gledajte šta je naraslo, ne šta vam manjka.',
  },
  'pattern.risky_allocation': {
    title: 'Previše zavisi od sreće',
    message:
      '{{percent}} % imovine je u srednjem ili visokom riziku — iznad ograničenja od {{threshold}} %. Većinu onoga što imate držite izvan dosega sreće.',
  },
};

const hsb: TranslationMap = {
  'operational.unapproved': {
    title: 'Transakcije čakaja na waš sud',
    message:
      '{{count}} transakcijow čaka na přizwolenje. Rozsudźće je dźensa, město zo byšće je dale njesli.',
  },
  'operational.uncategorized': {
    title: 'Wudawki bjez mjena',
    message: '{{count}} transakcijow nima kategoriju. Što pomjenowane njeje, njeda so zwažić.',
  },
  'operational.duplicates': {
    title: 'Móžne duplikaty namakane',
    message:
      '{{count}} móžnych duplikatow spóznatych. Widźće wěcy, kaž su — ličće kóždu jedyn raz.',
  },
  'trend.category_rising': {
    title: 'Kategorija rosće',
    message:
      'Wudawki za "{{category}}" su {{percent}} % nad swojim třiměsačnym přerězkom. Prašejće so, hač wam słuži abo wy jej.',
  },
  'pattern.unbudgeted_top_category': {
    title: 'Waš najwjetši wudawk nima limit',
    message:
      '"{{category}}" je tutón měsac waš najwjetši wudawk a ničo jón njemjeri. Limit, w měrje wuzwoleny, dlěje traje hač chwilkowa žadosć.',
  },
  'trend.savings_rate_up': {
    title: 'Lutowanska kwota je rostła',
    message:
      'Sće {{rate}} % dochoda zdźeržał — {{diff}} dypkow wjace hač zašły měsac. Měrnosć swoje čini.',
  },
  'trend.savings_rate_down': {
    title: 'Lutowanska kwota je spadnyła',
    message:
      'Sće {{rate}} % dochoda zdźeržał — {{diff}} dypkow mjenje hač zašły měsac. Hladajće na to, což rostło je, nic na to, což wam pobrachuje.',
  },
  'pattern.risky_allocation': {
    title: 'Přewjele wot zbožá wotwisuje',
    message:
      '{{percent}} % aktiwow leži w srjedźnym abo wysokim riziku — nad limitom {{threshold}} %. Dźeržće najwjetši dźěl toho, což maće, zwonka dosaha zbožá.',
  },
};

export const INSIGHT_TRANSLATIONS: Record<string, TranslationMap> = {
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

/**
 * Params ending in `Amount` become money in the workspace currency, `date`
 * becomes a day and month — both in the reader's locale, so "€1,200" and
 * "1 200 €" come from the same number.
 */
export function formatInsightParams(
  locale: string,
  params: Record<string, string | number>,
): Record<string, string | number> {
  const currency = typeof params.currency === 'string' ? params.currency : null;
  return Object.fromEntries(
    Object.entries(params).map(([name, value]) => {
      try {
        if (name.endsWith('Amount') && typeof value === 'number' && currency) {
          return [
            name,
            new Intl.NumberFormat(locale, {
              style: 'currency',
              currency,
              maximumFractionDigits: 0,
            }).format(value),
          ];
        }
        if (name === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const [year, month, day] = value.split('-').map(Number);
          return [
            name,
            new Date(year, month - 1, day).toLocaleDateString(locale, {
              day: 'numeric',
              month: 'long',
            }),
          ];
        }
      } catch {
        // An unknown currency or locale keeps the raw value rather than failing the insight.
      }
      return [name, value];
    }),
  );
}

export function renderInsight(
  locale: string,
  key: InsightMessageKey,
  params: Record<string, string | number>,
): { title: string; message: string } {
  const entry = isStoicKey(key)
    ? stoicEntry(locale, key, params.variant)
    : (INSIGHT_TRANSLATIONS[locale] ?? INSIGHT_TRANSLATIONS.en)[key];
  const formatted = formatInsightParams(locale, params);
  const interpolate = (template: string) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(formatted[k] ?? ''));
  return { title: interpolate(entry.title), message: interpolate(entry.message) };
}

function stoicEntry(locale: string, key: StoicMessageKey, variant: string | number | undefined) {
  const variants = (STOIC_TEXTS[locale] ?? STOIC_TEXTS.en)[key];
  const index = Number.isInteger(Number(variant)) ? Number(variant) : 0;
  return variants[((index % STOIC_VARIANT_COUNT) + STOIC_VARIANT_COUNT) % STOIC_VARIANT_COUNT];
}
