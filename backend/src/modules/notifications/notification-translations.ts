import { formatParam, type NotificationParams } from './notification-params';

export type NotificationMessageKey =
  | 'statement.uploaded'
  | 'import.committed'
  | 'category.created'
  | 'category.updated'
  | 'category.deleted'
  | 'note.mentioned'
  | 'member.invited'
  | 'member.joined'
  | 'data.deleted'
  | 'workspace.updated'
  | 'parsing.error'
  | 'parsing.error.named'
  | 'import.failed'
  | 'import.failed.named'
  | 'transactions.uncategorized'
  | 'receipt.uncategorized'
  | 'receipt.uncategorized.named'
  | 'payable.marked_paid'
  | 'payable.overdue'
  | 'payable.due_soon'
  | 'budget.exceeded'
  | 'budget.warning'
  | 'subscription.detected'
  | 'subscription.upcoming'
  | 'subscription.upcoming.one'
  | 'subscription.price_changed'
  | 'tax.threshold.warning'
  | 'tax.threshold.reached'
  | 'tax.deadline.vat'
  | 'tax.deadline.vat.overdue'
  | 'tax.deadline.income'
  | 'tax.rates.official'
  | 'review.waiting';

interface TranslationEntry {
  title: string;
  message: string;
}

type TranslationMap = Record<NotificationMessageKey, TranslationEntry>;

const ru: TranslationMap = {
  'subscription.price_changed': {
    title: 'Подписка подорожала',
    message:
      '{{vendor}}: было {{previous}}, стало {{current}} {{currency}} ({{delta}} за списание, {{yearly}} в год)',
  },
  'review.waiting': {
    title: 'Ждут разбора',
    message: '{{count}} элементов ждут решения во входящих на разбор',
  },
  'note.mentioned': {
    title: 'Вас упомянули в заметке',
    message: '{{actorName}} упомянул(а) вас: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Загружена выписка',
    message: '{{actorName}} загрузил(а) выписку "{{statementName}}"',
  },
  'import.committed': {
    title: 'Импорт завершен',
    message: '{{actorName}} импортировал(а) {{transactionCount}} транзакций',
  },
  'category.created': {
    title: 'Создана категория',
    message: '{{actorName}} создал(а) категорию "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Изменена категория',
    message: '{{actorName}} изменил(а) категорию "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Удалена категория',
    message: '{{actorName}} удалил(а) категорию "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Приглашен новый участник',
    message: '{{actorName}} пригласил(а) {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Участник присоединился',
    message: '{{memberName}} присоединился(ась) к workspace',
  },
  'data.deleted': { title: 'Удалены данные', message: '{{actorName}} удалил(а) {{count}} записей' },
  'workspace.updated': {
    title: 'Изменены настройки workspace',
    message: '{{actorName}} обновил(а) настройки workspace',
  },
  'parsing.error': { title: 'Ошибка парсинга выписки', message: 'Не удалось обработать выписку' },
  'parsing.error.named': {
    title: 'Ошибка парсинга выписки',
    message: 'Не удалось обработать выписку "{{statementName}}"',
  },
  'import.failed': { title: 'Ошибка импорта', message: 'Импорт завершился с ошибкой' },
  'import.failed.named': {
    title: 'Ошибка импорта',
    message: 'Импорт выписки "{{statementName}}" завершился с ошибкой',
  },
  'transactions.uncategorized': {
    title: 'Транзакции без категории',
    message: '{{count}} транзакций требуют выбора категории',
  },
  'receipt.uncategorized': { title: 'Чек без категории', message: 'Найден чек без категории' },
  'receipt.uncategorized.named': {
    title: 'Чек без категории',
    message: 'Чек "{{receiptName}}" не имеет категории',
  },
  'payable.marked_paid': { title: 'Платёж оплачен', message: '{{vendor}} отмечен как оплаченный' },
  'payable.overdue': {
    title: 'Платёж просрочен',
    message: '{{vendor}}: {{amount}}, срок оплаты был {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Скоро срок оплаты',
    message: '{{vendor}}: {{amount}}, срок оплаты {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Бюджет превышен',
    message: 'Бюджет "{{budgetName}}" превышен ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Предупреждение о бюджете',
    message: 'Бюджет "{{budgetName}}" достиг {{percentUsed}}% лимита',
  },
  'subscription.detected': {
    title: 'Обнаружены подписки',
    message: 'Обнаружены регулярные платежи: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Предстоящие списания',
    message: 'Скоро спишутся: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Предстоящее списание',
    message: 'Скоро спишется: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Порог регистрации по налогу',
    message: 'Оборот достиг {{percentUsed}}% порога регистрации ({{threshold}} {{currency}})',
  },
  'tax.threshold.reached': {
    title: 'Порог регистрации достигнут',
    message: 'Оборот достиг порога регистрации {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Скоро срок декларации по НДС за {{period}}',
    message: 'Декларацию по НДС за {{period}} ({{range}}) нужно подать до {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Просрочена декларация по НДС за {{period}}',
    message: 'Срок был {{dueDate}}, декларация не подана.',
  },
  'tax.deadline.income': {
    title: 'Скоро срок декларации о доходах',
    message: '{{returnName}} за {{taxYear}}: срок подачи {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Официальные ставки НДС отличаются от ваших',
    message:
      'Официальные ставки НДС ({{country}}) отличаются от ваших. Проверьте их в налоговых настройках.',
  },
};

const en: TranslationMap = {
  'subscription.price_changed': {
    title: 'Subscription price changed',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} per charge, {{yearly}} a year)',
  },
  'review.waiting': {
    title: 'Items waiting for review',
    message: '{{count}} items are waiting in the review inbox',
  },
  'note.mentioned': {
    title: 'You were mentioned in a note',
    message: '{{actorName}} mentioned you: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Statement uploaded',
    message: '{{actorName}} uploaded statement "{{statementName}}"',
  },
  'import.committed': {
    title: 'Import completed',
    message: '{{actorName}} imported {{transactionCount}} transactions',
  },
  'category.created': {
    title: 'Category created',
    message: '{{actorName}} created category "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Category updated',
    message: '{{actorName}} updated category "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Category deleted',
    message: '{{actorName}} deleted category "{{categoryName}}"',
  },
  'member.invited': {
    title: 'New member invited',
    message: '{{actorName}} invited {{invitedEmail}}',
  },
  'member.joined': { title: 'Member joined', message: '{{memberName}} joined the workspace' },
  'data.deleted': { title: 'Data deleted', message: '{{actorName}} deleted {{count}} records' },
  'workspace.updated': {
    title: 'Workspace settings updated',
    message: '{{actorName}} updated workspace settings',
  },
  'parsing.error': { title: 'Statement parsing error', message: 'Failed to process statement' },
  'parsing.error.named': {
    title: 'Statement parsing error',
    message: 'Failed to process statement "{{statementName}}"',
  },
  'import.failed': { title: 'Import failed', message: 'Import failed with an error' },
  'import.failed.named': {
    title: 'Import failed',
    message: 'Import of statement "{{statementName}}" failed',
  },
  'transactions.uncategorized': {
    title: 'Uncategorized transactions',
    message: '{{count}} transactions need categorization',
  },
  'receipt.uncategorized': {
    title: 'Uncategorized receipt',
    message: 'A receipt without category was found',
  },
  'receipt.uncategorized.named': {
    title: 'Uncategorized receipt',
    message: 'Receipt "{{receiptName}}" has no category',
  },
  'payable.marked_paid': {
    title: 'Payable marked as paid',
    message: '{{vendor}} was marked as paid',
  },
  'payable.overdue': {
    title: 'Payable overdue',
    message: '{{amount}} to {{vendor}} was due {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Payable due soon',
    message: '{{amount}} to {{vendor}} is due {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Budget exceeded',
    message: 'Budget "{{budgetName}}" has exceeded its limit ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Budget warning',
    message: 'Budget "{{budgetName}}" has reached {{percentUsed}}% of its limit',
  },
  'subscription.detected': {
    title: 'Subscriptions detected',
    message: 'Found recurring payments: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Upcoming subscription charges',
    message: '{{charges}} are due soon',
  },
  'subscription.upcoming.one': {
    title: 'Upcoming subscription charge',
    message: '{{charges}} is due soon',
  },
  'tax.threshold.warning': {
    title: 'Tax registration threshold',
    message:
      'Turnover has reached {{percentUsed}}% of the {{threshold}} {{currency}} registration threshold',
  },
  'tax.threshold.reached': {
    title: 'Registration threshold reached',
    message: 'Turnover has reached the {{threshold}} {{currency}} registration threshold',
  },
  'tax.deadline.vat': {
    title: '{{period}} VAT return due soon',
    message: '{{period}} VAT return ({{range}}) is due {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: '{{period}} VAT return overdue',
    message: "Was due {{dueDate}} and isn't filed.",
  },
  'tax.deadline.income': {
    title: 'Income tax return due soon',
    message: '{{returnName}} for {{taxYear}} is due on {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Official VAT rates differ from yours',
    message: 'Official VAT rates for {{country}} differ from yours. Review them in tax settings.',
  },
};

const kk: TranslationMap = {
  'subscription.price_changed': {
    title: 'Жазылым бағасы өзгерді',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} (бір төлемде {{delta}}, жылына {{yearly}})',
  },
  'review.waiting': {
    title: 'Қарауды күтуде',
    message: '{{count}} элемент қарау кіріс жәшігінде күтіп тұр',
  },
  'note.mentioned': {
    title: 'Сізді жазбада атап өтті',
    message: '{{actorName}} сізді атап өтті: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Үзінді жүктелді',
    message: '{{actorName}} "{{statementName}}" үзіндісін жүктеді',
  },
  'import.committed': {
    title: 'Импорт аяқталды',
    message: '{{actorName}} {{transactionCount}} транзакция импорттады',
  },
  'category.created': {
    title: 'Санат жасалды',
    message: '{{actorName}} "{{categoryName}}" санатын жасады',
  },
  'category.updated': {
    title: 'Санат өзгертілді',
    message: '{{actorName}} "{{categoryName}}" санатын өзгертті',
  },
  'category.deleted': {
    title: 'Санат жойылды',
    message: '{{actorName}} "{{categoryName}}" санатын жойды',
  },
  'member.invited': {
    title: 'Жаңа қатысушы шақырылды',
    message: '{{actorName}} {{invitedEmail}} шақырды',
  },
  'member.joined': { title: 'Қатысушы қосылды', message: '{{memberName}} workspace-ке қосылды' },
  'data.deleted': { title: 'Деректер жойылды', message: '{{actorName}} {{count}} жазбаны жойды' },
  'workspace.updated': {
    title: 'Workspace параметрлері өзгертілді',
    message: '{{actorName}} workspace параметрлерін жаңартты',
  },
  'parsing.error': { title: 'Үзінді өңдеу қатесі', message: 'Үзіндіні өңдеу мүмкін болмады' },
  'parsing.error.named': {
    title: 'Үзінді өңдеу қатесі',
    message: '"{{statementName}}" үзіндісін өңдеу мүмкін болмады',
  },
  'import.failed': { title: 'Импорт қатесі', message: 'Импорт қатемен аяқталды' },
  'import.failed.named': {
    title: 'Импорт қатесі',
    message: '"{{statementName}}" үзіндісінің импорты сәтсіз аяқталды',
  },
  'transactions.uncategorized': {
    title: 'Санатсыз транзакциялар',
    message: '{{count}} транзакция санат таңдауды қажет етеді',
  },
  'receipt.uncategorized': { title: 'Санатсыз чек', message: 'Санатсыз чек табылды' },
  'receipt.uncategorized.named': {
    title: 'Санатсыз чек',
    message: '"{{receiptName}}" чегінде санат жоқ',
  },
  'payable.marked_paid': { title: 'Төлем жасалды', message: '{{vendor}} төленді деп белгіленді' },
  'payable.overdue': {
    title: 'Төлем мерзімі өтті',
    message: '{{vendor}}: {{amount}}, төлем мерзімі {{dueDate}} болатын',
  },
  'payable.due_soon': {
    title: 'Төлем мерзімі жақындады',
    message: '{{vendor}}: {{amount}}, төлем мерзімі {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Бюджет асып кетті',
    message: '"{{budgetName}}" бюджеті лимиттен асты ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Бюджет ескертуі',
    message: '"{{budgetName}}" бюджеті лимиттің {{percentUsed}}%-ына жетті',
  },
  'subscription.detected': {
    title: 'Жазылымдар анықталды',
    message: 'Тұрақты төлемдер табылды: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Алдағы төлемдер',
    message: 'Жақында төленеді: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Алдағы төлем',
    message: 'Жақында төленеді: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Салықтық тіркеу шегі',
    message: 'Айналым тіркеу шегінің {{percentUsed}}% жетті ({{threshold}} {{currency}})',
  },
  'tax.threshold.reached': {
    title: 'Тіркеу шегіне жетті',
    message: 'Айналым {{threshold}} {{currency}} тіркеу шегіне жетті',
  },
  'tax.deadline.vat': {
    title: 'ҚҰН декларациясының мерзімі жақындады ({{period}})',
    message: 'ҚҰН декларациясы ({{period}}, {{range}}) {{dueDate}} дейін тапсырылуы керек.',
  },
  'tax.deadline.vat.overdue': {
    title: 'ҚҰН декларациясының мерзімі өтті ({{period}})',
    message: 'Мерзімі {{dueDate}} болатын, декларация тапсырылмаған.',
  },
  'tax.deadline.income': {
    title: 'Табыс салығы декларациясының мерзімі жақындады',
    message: '{{returnName}} ({{taxYear}}) тапсыру мерзімі — {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Ресми ҚҰН мөлшерлемелері сіздікінен өзгеше',
    message:
      'Ресми ҚҰН мөлшерлемелері ({{country}}) сіздікінен өзгеше. Оларды салық баптауларынан тексеріңіз.',
  },
};

const de: TranslationMap = {
  'subscription.price_changed': {
    title: 'Abo-Preis geändert',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} pro Abbuchung, {{yearly}} im Jahr)',
  },
  'review.waiting': {
    title: 'Zur Durchsicht wartend',
    message: '{{count}} Einträge warten im Prüf-Posteingang',
  },
  'note.mentioned': {
    title: 'Sie wurden in einer Notiz erwähnt',
    message: '{{actorName}} hat Sie erwähnt: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Kontoauszug hochgeladen',
    message: '{{actorName}} hat den Kontoauszug "{{statementName}}" hochgeladen',
  },
  'import.committed': {
    title: 'Import abgeschlossen',
    message: '{{actorName}} hat {{transactionCount}} Transaktionen importiert',
  },
  'category.created': {
    title: 'Kategorie erstellt',
    message: '{{actorName}} hat die Kategorie "{{categoryName}}" erstellt',
  },
  'category.updated': {
    title: 'Kategorie aktualisiert',
    message: '{{actorName}} hat die Kategorie "{{categoryName}}" aktualisiert',
  },
  'category.deleted': {
    title: 'Kategorie gelöscht',
    message: '{{actorName}} hat die Kategorie "{{categoryName}}" gelöscht',
  },
  'member.invited': {
    title: 'Neues Mitglied eingeladen',
    message: '{{actorName}} hat {{invitedEmail}} eingeladen',
  },
  'member.joined': {
    title: 'Mitglied beigetreten',
    message: '{{memberName}} ist dem Workspace beigetreten',
  },
  'data.deleted': {
    title: 'Daten gelöscht',
    message: '{{actorName}} hat {{count}} Einträge gelöscht',
  },
  'workspace.updated': {
    title: 'Workspace-Einstellungen aktualisiert',
    message: '{{actorName}} hat die Workspace-Einstellungen aktualisiert',
  },
  'parsing.error': {
    title: 'Fehler beim Parsen des Kontoauszugs',
    message: 'Der Kontoauszug konnte nicht verarbeitet werden',
  },
  'parsing.error.named': {
    title: 'Fehler beim Parsen des Kontoauszugs',
    message: 'Der Kontoauszug "{{statementName}}" konnte nicht verarbeitet werden',
  },
  'import.failed': { title: 'Import fehlgeschlagen', message: 'Der Import ist fehlgeschlagen' },
  'import.failed.named': {
    title: 'Import fehlgeschlagen',
    message: 'Der Import des Kontoauszugs "{{statementName}}" ist fehlgeschlagen',
  },
  'transactions.uncategorized': {
    title: 'Unkategorisierte Transaktionen',
    message: '{{count}} Transaktionen müssen kategorisiert werden',
  },
  'receipt.uncategorized': {
    title: 'Unkategorisierter Beleg',
    message: 'Ein Beleg ohne Kategorie wurde gefunden',
  },
  'receipt.uncategorized.named': {
    title: 'Unkategorisierter Beleg',
    message: 'Der Beleg "{{receiptName}}" hat keine Kategorie',
  },
  'payable.marked_paid': {
    title: 'Zahlung als bezahlt markiert',
    message: '{{vendor}} wurde als bezahlt markiert',
  },
  'payable.overdue': {
    title: 'Zahlung überfällig',
    message: '{{amount}} an {{vendor}} waren am {{dueDate}} fällig',
  },
  'payable.due_soon': {
    title: 'Zahlung bald fällig',
    message: '{{amount}} an {{vendor}} sind am {{dueDate}} fällig',
  },
  'budget.exceeded': {
    title: 'Budget überschritten',
    message: 'Budget "{{budgetName}}" hat sein Limit überschritten ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Budget-Warnung',
    message: 'Budget "{{budgetName}}" hat {{percentUsed}}% seines Limits erreicht',
  },
  'subscription.detected': {
    title: 'Abonnements erkannt',
    message: 'Wiederkehrende Zahlungen gefunden: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Anstehende Abonnement-Abbuchungen',
    message: '{{charges}} werden bald abgebucht',
  },
  'subscription.upcoming.one': {
    title: 'Anstehende Abonnement-Abbuchung',
    message: '{{charges}} wird bald abgebucht',
  },
  'tax.threshold.warning': {
    title: 'Registrierungsgrenze',
    message:
      'Der Umsatz hat {{percentUsed}}% der Registrierungsgrenze von {{threshold}} {{currency}} erreicht',
  },
  'tax.threshold.reached': {
    title: 'Registrierungsgrenze erreicht',
    message: 'Der Umsatz hat die Registrierungsgrenze von {{threshold}} {{currency}} erreicht',
  },
  'tax.deadline.vat': {
    title: 'USt-Voranmeldung {{period}} bald fällig',
    message: 'USt-Voranmeldung {{period}} ({{range}}) ist am {{dueDate}} fällig.',
  },
  'tax.deadline.vat.overdue': {
    title: 'USt-Voranmeldung {{period}} überfällig',
    message: 'War am {{dueDate}} fällig und ist nicht eingereicht.',
  },
  'tax.deadline.income': {
    title: 'Einkommensteuererklärung bald fällig',
    message: '{{returnName}} für {{taxYear}} ist am {{dueDate}} fällig',
  },
  'tax.rates.official': {
    title: 'Amtliche USt-Sätze weichen ab',
    message:
      'Die amtlichen USt-Sätze für {{country}} weichen von Ihren ab. Prüfen Sie sie in den Steuereinstellungen.',
  },
};

const fr: TranslationMap = {
  'subscription.price_changed': {
    title: 'Prix d’abonnement modifié',
    message:
      '{{vendor}} : {{previous}} → {{current}} {{currency}} ({{delta}} par prélèvement, {{yearly}} par an)',
  },
  'review.waiting': {
    title: 'En attente de revue',
    message: '{{count}} éléments attendent dans la boîte de revue',
  },
  'note.mentioned': {
    title: 'Vous avez été mentionné dans une note',
    message: '{{actorName}} vous a mentionné : {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Relevé importé',
    message: '{{actorName}} a importé le relevé "{{statementName}}"',
  },
  'import.committed': {
    title: 'Import terminé',
    message: '{{actorName}} a importé {{transactionCount}} transactions',
  },
  'category.created': {
    title: 'Catégorie créée',
    message: '{{actorName}} a créé la catégorie "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Catégorie modifiée',
    message: '{{actorName}} a modifié la catégorie "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Catégorie supprimée',
    message: '{{actorName}} a supprimé la catégorie "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Nouveau membre invité',
    message: '{{actorName}} a invité {{invitedEmail}}',
  },
  'member.joined': { title: 'Membre rejoint', message: '{{memberName}} a rejoint le workspace' },
  'data.deleted': {
    title: 'Données supprimées',
    message: '{{actorName}} a supprimé {{count}} enregistrements',
  },
  'workspace.updated': {
    title: 'Paramètres du workspace mis à jour',
    message: '{{actorName}} a mis à jour les paramètres du workspace',
  },
  'parsing.error': {
    title: "Erreur d'analyse du relevé",
    message: 'Impossible de traiter le relevé',
  },
  'parsing.error.named': {
    title: "Erreur d'analyse du relevé",
    message: 'Impossible de traiter le relevé "{{statementName}}"',
  },
  'import.failed': { title: "Échec de l'import", message: "L'import a échoué" },
  'import.failed.named': {
    title: "Échec de l'import",
    message: 'L\'import du relevé "{{statementName}}" a échoué',
  },
  'transactions.uncategorized': {
    title: 'Transactions non catégorisées',
    message: '{{count}} transactions nécessitent une catégorisation',
  },
  'receipt.uncategorized': {
    title: 'Reçu non catégorisé',
    message: 'Un reçu sans catégorie a été trouvé',
  },
  'receipt.uncategorized.named': {
    title: 'Reçu non catégorisé',
    message: 'Le reçu "{{receiptName}}" n\'a pas de catégorie',
  },
  'payable.marked_paid': {
    title: 'Paiement marqué comme payé',
    message: '{{vendor}} a été marqué comme payé',
  },
  'payable.overdue': {
    title: 'Paiement en retard',
    message: '{{amount}} à {{vendor}} était dû le {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Paiement bientôt dû',
    message: '{{amount}} à {{vendor}} est dû le {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Budget dépassé',
    message: 'Le budget "{{budgetName}}" a dépassé sa limite ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Alerte budget',
    message: 'Le budget "{{budgetName}}" a atteint {{percentUsed}}% de sa limite',
  },
  'subscription.detected': {
    title: 'Abonnements détectés',
    message: 'Paiements récurrents trouvés : {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Prélèvements à venir',
    message: 'Bientôt prélevés : {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Prélèvement à venir',
    message: 'Bientôt prélevé : {{charges}}',
  },
  'tax.threshold.warning': {
    title: "Seuil d'immatriculation",
    message:
      "Le chiffre d'affaires a atteint {{percentUsed}}% du seuil de {{threshold}} {{currency}}",
  },
  'tax.threshold.reached': {
    title: "Seuil d'immatriculation atteint",
    message: "Le chiffre d'affaires a atteint le seuil de {{threshold}} {{currency}}",
  },
  'tax.deadline.vat': {
    title: 'Déclaration de TVA ({{period}}) bientôt due',
    message: 'La déclaration de TVA {{period}} ({{range}}) est due le {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Déclaration de TVA ({{period}}) en retard',
    message: "Était due le {{dueDate}} et n'est pas déposée.",
  },
  'tax.deadline.income': {
    title: 'Déclaration de revenus bientôt due',
    message: '{{returnName}} pour {{taxYear}} est due le {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Les taux de TVA officiels diffèrent des vôtres',
    message:
      'Les taux de TVA officiels ({{country}}) diffèrent des vôtres. Vérifiez-les dans les paramètres fiscaux.',
  },
};

const es: TranslationMap = {
  'subscription.price_changed': {
    title: 'Cambio de precio de suscripción',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} por cargo, {{yearly}} al año)',
  },
  'review.waiting': {
    title: 'Pendientes de revisión',
    message: '{{count}} elementos esperan en la bandeja de revisión',
  },
  'note.mentioned': {
    title: 'Te mencionaron en una nota',
    message: '{{actorName}} te mencionó: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Extracto subido',
    message: '{{actorName}} subió el extracto "{{statementName}}"',
  },
  'import.committed': {
    title: 'Importación completada',
    message: '{{actorName}} importó {{transactionCount}} transacciones',
  },
  'category.created': {
    title: 'Categoría creada',
    message: '{{actorName}} creó la categoría "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Categoría actualizada',
    message: '{{actorName}} actualizó la categoría "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Categoría eliminada',
    message: '{{actorName}} eliminó la categoría "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Nuevo miembro invitado',
    message: '{{actorName}} invitó a {{invitedEmail}}',
  },
  'member.joined': { title: 'Miembro se unió', message: '{{memberName}} se unió al workspace' },
  'data.deleted': {
    title: 'Datos eliminados',
    message: '{{actorName}} eliminó {{count}} registros',
  },
  'workspace.updated': {
    title: 'Configuración del workspace actualizada',
    message: '{{actorName}} actualizó la configuración del workspace',
  },
  'parsing.error': {
    title: 'Error al analizar el extracto',
    message: 'No se pudo procesar el extracto',
  },
  'parsing.error.named': {
    title: 'Error al analizar el extracto',
    message: 'No se pudo procesar el extracto "{{statementName}}"',
  },
  'import.failed': { title: 'Importación fallida', message: 'La importación falló' },
  'import.failed.named': {
    title: 'Importación fallida',
    message: 'La importación del extracto "{{statementName}}" falló',
  },
  'transactions.uncategorized': {
    title: 'Transacciones sin categoría',
    message: '{{count}} transacciones necesitan categorización',
  },
  'receipt.uncategorized': {
    title: 'Recibo sin categoría',
    message: 'Se encontró un recibo sin categoría',
  },
  'receipt.uncategorized.named': {
    title: 'Recibo sin categoría',
    message: 'El recibo "{{receiptName}}" no tiene categoría',
  },
  'payable.marked_paid': {
    title: 'Pago marcado como pagado',
    message: '{{vendor}} fue marcado como pagado',
  },
  'payable.overdue': {
    title: 'Pago vencido',
    message: '{{amount}} a {{vendor}} vencía el {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Pago próximo a vencer',
    message: '{{amount}} a {{vendor}} vence el {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Presupuesto excedido',
    message: 'El presupuesto "{{budgetName}}" ha excedido su límite ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Alerta de presupuesto',
    message: 'El presupuesto "{{budgetName}}" ha alcanzado el {{percentUsed}}% de su límite',
  },
  'subscription.detected': {
    title: 'Suscripciones detectadas',
    message: 'Pagos recurrentes encontrados: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Cargos de suscripción próximos',
    message: 'Pronto se cobrarán: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Cargo de suscripción próximo',
    message: 'Pronto se cobrará: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Umbral de registro fiscal',
    message:
      'La facturación ha alcanzado el {{percentUsed}}% del umbral de {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Umbral de registro alcanzado',
    message: 'La facturación ha alcanzado el umbral de {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Declaración de IVA ({{period}}) próxima a vencer',
    message: 'La declaración de IVA {{period}} ({{range}}) vence el {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Declaración de IVA ({{period}}) vencida',
    message: 'Vencía el {{dueDate}} y no está presentada.',
  },
  'tax.deadline.income': {
    title: 'Declaración del impuesto sobre la renta próxima a vencer',
    message: '{{returnName}} de {{taxYear}} vence el {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Los tipos de IVA oficiales difieren de los suyos',
    message:
      'Los tipos de IVA oficiales ({{country}}) difieren de los suyos. Revíselos en la configuración fiscal.',
  },
};

const pt: TranslationMap = {
  'subscription.price_changed': {
    title: 'Preço da subscrição alterado',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} por cobrança, {{yearly}} por ano)',
  },
  'review.waiting': {
    title: 'Aguardando revisão',
    message: '{{count}} itens aguardam na caixa de revisão',
  },
  'note.mentioned': {
    title: 'Você foi mencionado numa nota',
    message: '{{actorName}} mencionou você: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Extrato enviado',
    message: '{{actorName}} enviou o extrato "{{statementName}}"',
  },
  'import.committed': {
    title: 'Importação concluída',
    message: '{{actorName}} importou {{transactionCount}} transações',
  },
  'category.created': {
    title: 'Categoria criada',
    message: '{{actorName}} criou a categoria "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Categoria atualizada',
    message: '{{actorName}} atualizou a categoria "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Categoria excluída',
    message: '{{actorName}} excluiu a categoria "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Novo membro convidado',
    message: '{{actorName}} convidou {{invitedEmail}}',
  },
  'member.joined': { title: 'Membro entrou', message: '{{memberName}} entrou no workspace' },
  'data.deleted': {
    title: 'Dados excluídos',
    message: '{{actorName}} excluiu {{count}} registros',
  },
  'workspace.updated': {
    title: 'Configurações do workspace atualizadas',
    message: '{{actorName}} atualizou as configurações do workspace',
  },
  'parsing.error': {
    title: 'Erro ao analisar extrato',
    message: 'Não foi possível processar o extrato',
  },
  'parsing.error.named': {
    title: 'Erro ao analisar extrato',
    message: 'Não foi possível processar o extrato "{{statementName}}"',
  },
  'import.failed': { title: 'Importação falhou', message: 'A importação falhou' },
  'import.failed.named': {
    title: 'Importação falhou',
    message: 'A importação do extrato "{{statementName}}" falhou',
  },
  'transactions.uncategorized': {
    title: 'Transações sem categoria',
    message: '{{count}} transações precisam de categorização',
  },
  'receipt.uncategorized': {
    title: 'Recibo sem categoria',
    message: 'Um recibo sem categoria foi encontrado',
  },
  'receipt.uncategorized.named': {
    title: 'Recibo sem categoria',
    message: 'O recibo "{{receiptName}}" não tem categoria',
  },
  'payable.marked_paid': {
    title: 'Pagamento marcado como pago',
    message: '{{vendor}} foi marcado como pago',
  },
  'payable.overdue': {
    title: 'Pagamento atrasado',
    message: '{{amount}} a {{vendor}} venceu a {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Pagamento próximo',
    message: '{{amount}} a {{vendor}} vence a {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Orçamento excedido',
    message: 'O orçamento "{{budgetName}}" excedeu seu limite ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Alerta de orçamento',
    message: 'O orçamento "{{budgetName}}" atingiu {{percentUsed}}% do limite',
  },
  'subscription.detected': {
    title: 'Assinaturas detectadas',
    message: 'Pagamentos recorrentes encontrados: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Cobranças de assinatura próximas',
    message: 'A cobrar em breve: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Cobrança de assinatura próxima',
    message: 'A cobrar em breve: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Limite de registo fiscal',
    message:
      'O volume de negócios atingiu {{percentUsed}}% do limite de {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Limite de registo atingido',
    message: 'O volume de negócios atingiu o limite de {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Declaração de IVA ({{period}}) a vencer em breve',
    message: 'A declaração de IVA {{period}} ({{range}}) vence a {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Declaração de IVA ({{period}}) atrasada',
    message: 'Venceu a {{dueDate}} e não foi entregue.',
  },
  'tax.deadline.income': {
    title: 'Declaração do imposto sobre o rendimento a vencer em breve',
    message: '{{returnName}} de {{taxYear}} vence em {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'As taxas de IVA oficiais diferem das suas',
    message:
      'As taxas de IVA oficiais ({{country}}) diferem das suas. Reveja-as nas definições fiscais.',
  },
};

const tr: TranslationMap = {
  'subscription.price_changed': {
    title: 'Abonelik fiyatı değişti',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} (tahsilat başına {{delta}}, yılda {{yearly}})',
  },
  'review.waiting': {
    title: 'İnceleme bekliyor',
    message: '{{count}} öğe inceleme gelen kutusunda bekliyor',
  },
  'note.mentioned': {
    title: 'Bir notta sizden bahsedildi',
    message: '{{actorName}} sizden bahsetti: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Hesap özeti yüklendi',
    message: '{{actorName}} "{{statementName}}" hesap özetini yükledi',
  },
  'import.committed': {
    title: 'İçe aktarma tamamlandı',
    message: '{{actorName}} {{transactionCount}} işlem içe aktardı',
  },
  'category.created': {
    title: 'Kategori oluşturuldu',
    message: '{{actorName}} "{{categoryName}}" kategorisini oluşturdu',
  },
  'category.updated': {
    title: 'Kategori güncellendi',
    message: '{{actorName}} "{{categoryName}}" kategorisini güncelledi',
  },
  'category.deleted': {
    title: 'Kategori silindi',
    message: '{{actorName}} "{{categoryName}}" kategorisini sildi',
  },
  'member.invited': {
    title: 'Yeni üye davet edildi',
    message: '{{actorName}} {{invitedEmail}} adresini davet etti',
  },
  'member.joined': { title: 'Üye katıldı', message: "{{memberName}} workspace'e katıldı" },
  'data.deleted': { title: 'Veriler silindi', message: '{{actorName}} {{count}} kayıt sildi' },
  'workspace.updated': {
    title: 'Workspace ayarları güncellendi',
    message: '{{actorName}} workspace ayarlarını güncelledi',
  },
  'parsing.error': { title: 'Hesap özeti ayrıştırma hatası', message: 'Hesap özeti işlenemedi' },
  'parsing.error.named': {
    title: 'Hesap özeti ayrıştırma hatası',
    message: '"{{statementName}}" hesap özeti işlenemedi',
  },
  'import.failed': { title: 'İçe aktarma başarısız', message: 'İçe aktarma başarısız oldu' },
  'import.failed.named': {
    title: 'İçe aktarma başarısız',
    message: '"{{statementName}}" hesap özetinin içe aktarması başarısız oldu',
  },
  'transactions.uncategorized': {
    title: 'Kategorisiz işlemler',
    message: '{{count}} işlem kategori seçimi gerektiriyor',
  },
  'receipt.uncategorized': {
    title: 'Kategorisiz makbuz',
    message: 'Kategorisiz bir makbuz bulundu',
  },
  'receipt.uncategorized.named': {
    title: 'Kategorisiz makbuz',
    message: '"{{receiptName}}" makbuzunun kategorisi yok',
  },
  'payable.marked_paid': {
    title: 'Ödeme yapıldı olarak işaretlendi',
    message: '{{vendor}} ödendi olarak işaretlendi',
  },
  'payable.overdue': {
    title: 'Ödeme gecikmiş',
    message: '{{vendor}}: {{amount}}, son ödeme tarihi {{dueDate}} idi',
  },
  'payable.due_soon': {
    title: 'Ödeme yakında',
    message: '{{vendor}}: {{amount}}, son ödeme tarihi {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Bütçe aşıldı',
    message: '"{{budgetName}}" bütçesi limitini aştı ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Bütçe uyarısı',
    message: '"{{budgetName}}" bütçesi limitinin {{percentUsed}}%\'ına ulaştı',
  },
  'subscription.detected': {
    title: 'Abonelikler tespit edildi',
    message: 'Tekrarlayan ödemeler bulundu: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Yaklaşan abonelik ödemeleri',
    message: 'Yakında tahsil edilecek: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Yaklaşan abonelik ödemesi',
    message: 'Yakında tahsil edilecek: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Vergi kayıt eşiği',
    message: 'Ciro, {{threshold}} {{currency}} kayıt eşiğinin %{{percentUsed}} düzeyine ulaştı',
  },
  'tax.threshold.reached': {
    title: 'Kayıt eşiğine ulaşıldı',
    message: 'Ciro, {{threshold}} {{currency}} kayıt eşiğine ulaştı',
  },
  'tax.deadline.vat': {
    title: 'KDV beyannamesinin teslim tarihi yaklaşıyor ({{period}})',
    message: 'KDV beyannamesi ({{period}}, {{range}}) için son tarih: {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'KDV beyannamesi gecikmiş ({{period}})',
    message: 'Son tarih {{dueDate}} idi ve beyanname verilmedi.',
  },
  'tax.deadline.income': {
    title: 'Gelir vergisi beyannamesinin teslim tarihi yaklaşıyor',
    message: '{{returnName}} ({{taxYear}}) için son teslim tarihi {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Resmî KDV oranları sizinkilerden farklı',
    message:
      'Resmî KDV oranları ({{country}}) sizinkilerden farklı. Bunları vergi ayarlarında kontrol edin.',
  },
};

const uk: TranslationMap = {
  'subscription.price_changed': {
    title: 'Підписка подорожчала',
    message:
      '{{vendor}}: було {{previous}}, стало {{current}} {{currency}} ({{delta}} за списання, {{yearly}} на рік)',
  },
  'review.waiting': {
    title: 'Чекають на розбір',
    message: '{{count}} елементів чекають у вхідних на розбір',
  },
  'note.mentioned': {
    title: 'Вас згадали в нотатці',
    message: '{{actorName}} згадав(ла) вас: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Виписка завантажена',
    message: '{{actorName}} завантажив(ла) виписку "{{statementName}}"',
  },
  'import.committed': {
    title: 'Імпорт завершено',
    message: '{{actorName}} імпортував(ла) {{transactionCount}} транзакцій',
  },
  'category.created': {
    title: 'Категорія створена',
    message: '{{actorName}} створив(ла) категорію "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Категорія оновлена',
    message: '{{actorName}} оновив(ла) категорію "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Категорія видалена',
    message: '{{actorName}} видалив(ла) категорію "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Запрошено нового учасника',
    message: '{{actorName}} запросив(ла) {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Учасник приєднався',
    message: '{{memberName}} приєднався(лась) до workspace',
  },
  'data.deleted': {
    title: 'Дані видалено',
    message: '{{actorName}} видалив(ла) {{count}} записів',
  },
  'workspace.updated': {
    title: 'Налаштування workspace оновлено',
    message: '{{actorName}} оновив(ла) налаштування workspace',
  },
  'parsing.error': { title: 'Помилка обробки виписки', message: 'Не вдалося обробити виписку' },
  'parsing.error.named': {
    title: 'Помилка обробки виписки',
    message: 'Не вдалося обробити виписку "{{statementName}}"',
  },
  'import.failed': { title: 'Помилка імпорту', message: 'Імпорт завершився з помилкою' },
  'import.failed.named': {
    title: 'Помилка імпорту',
    message: 'Імпорт виписки "{{statementName}}" завершився з помилкою',
  },
  'transactions.uncategorized': {
    title: 'Транзакції без категорії',
    message: '{{count}} транзакцій потребують вибору категорії',
  },
  'receipt.uncategorized': { title: 'Чек без категорії', message: 'Знайдено чек без категорії' },
  'receipt.uncategorized.named': {
    title: 'Чек без категорії',
    message: 'Чек "{{receiptName}}" не має категорії',
  },
  'payable.marked_paid': { title: 'Платіж оплачено', message: '{{vendor}} позначено як оплачений' },
  'payable.overdue': {
    title: 'Платіж прострочено',
    message: '{{vendor}}: {{amount}}, термін оплати був {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Платіж скоро',
    message: '{{vendor}}: {{amount}}, термін оплати {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Бюджет перевищено',
    message: 'Бюджет "{{budgetName}}" перевищив ліміт ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Попередження про бюджет',
    message: 'Бюджет "{{budgetName}}" досяг {{percentUsed}}% ліміту',
  },
  'subscription.detected': {
    title: 'Виявлено підписки',
    message: 'Знайдено регулярні платежі: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Майбутні списання',
    message: 'Незабаром спишуться: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Майбутнє списання',
    message: 'Незабаром спишеться: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Поріг податкової реєстрації',
    message: 'Оборот досяг {{percentUsed}}% порогу реєстрації ({{threshold}} {{currency}})',
  },
  'tax.threshold.reached': {
    title: 'Поріг реєстрації досягнуто',
    message: 'Оборот досяг порогу реєстрації {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Скоро термін декларації з ПДВ за {{period}}',
    message: 'Декларацію з ПДВ за {{period}} ({{range}}) треба подати до {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Прострочено декларацію з ПДВ за {{period}}',
    message: 'Термін був {{dueDate}}, декларацію не подано.',
  },
  'tax.deadline.income': {
    title: 'Скоро термін подання декларації про доходи',
    message: '{{returnName}} за {{taxYear}}: термін подання {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Офіційні ставки ПДВ відрізняються від ваших',
    message:
      'Офіційні ставки ПДВ ({{country}}) відрізняються від ваших. Перевірте їх у податкових налаштуваннях.',
  },
};

const zh: TranslationMap = {
  'subscription.price_changed': {
    title: '订阅价格变动',
    message:
      '{{vendor}}：{{previous}} → {{current}} {{currency}}（每次 {{delta}}，每年 {{yearly}}）',
  },
  'review.waiting': {
    title: '待审核项目',
    message: '{{count}} 个项目在审核收件箱中等待',
  },
  'note.mentioned': {
    title: '有人在备注中提到了你',
    message: '{{actorName}} 提到了你：{{excerpt}}',
  },
  'statement.uploaded': {
    title: '对账单已上传',
    message: '{{actorName}} 上传了对账单 "{{statementName}}"',
  },
  'import.committed': {
    title: '导入完成',
    message: '{{actorName}} 导入了 {{transactionCount}} 笔交易',
  },
  'category.created': {
    title: '类别已创建',
    message: '{{actorName}} 创建了类别 "{{categoryName}}"',
  },
  'category.updated': {
    title: '类别已更新',
    message: '{{actorName}} 更新了类别 "{{categoryName}}"',
  },
  'category.deleted': {
    title: '类别已删除',
    message: '{{actorName}} 删除了类别 "{{categoryName}}"',
  },
  'member.invited': { title: '新成员已邀请', message: '{{actorName}} 邀请了 {{invitedEmail}}' },
  'member.joined': { title: '成员已加入', message: '{{memberName}} 加入了工作区' },
  'data.deleted': { title: '数据已删除', message: '{{actorName}} 删除了 {{count}} 条记录' },
  'workspace.updated': { title: '工作区设置已更新', message: '{{actorName}} 更新了工作区设置' },
  'parsing.error': { title: '对账单解析错误', message: '无法处理对账单' },
  'parsing.error.named': { title: '对账单解析错误', message: '无法处理对账单 "{{statementName}}"' },
  'import.failed': { title: '导入失败', message: '导入失败' },
  'import.failed.named': { title: '导入失败', message: '对账单 "{{statementName}}" 导入失败' },
  'transactions.uncategorized': { title: '未分类交易', message: '{{count}} 笔交易需要分类' },
  'receipt.uncategorized': { title: '未分类收据', message: '发现未分类的收据' },
  'receipt.uncategorized.named': { title: '未分类收据', message: '收据 "{{receiptName}}" 未分类' },
  'payable.marked_paid': { title: '应付款已标记为已付', message: '{{vendor}} 已标记为已付' },
  'payable.overdue': {
    title: '应付款逾期',
    message: '应付 {{vendor}} 的 {{amount}} 已于 {{dueDate}} 到期',
  },
  'payable.due_soon': {
    title: '应付款即将到期',
    message: '应付 {{vendor}} 的 {{amount}} 将于 {{dueDate}} 到期',
  },
  'budget.exceeded': {
    title: '预算超支',
    message: '预算 "{{budgetName}}" 已超出限额 ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: '预算预警',
    message: '预算 "{{budgetName}}" 已达到限额的 {{percentUsed}}%',
  },
  'subscription.detected': { title: '检测到订阅', message: '发现定期付款：{{vendors}}' },
  'subscription.upcoming': {
    title: '即将扣费的订阅',
    message: '{{charges}} 即将扣费',
  },
  'subscription.upcoming.one': {
    title: '即将扣费的订阅',
    message: '{{charges}} 即将扣费',
  },
  'tax.threshold.warning': {
    title: '税务登记门槛',
    message: '营业额已达到登记门槛 {{threshold}} {{currency}} 的 {{percentUsed}}%',
  },
  'tax.threshold.reached': {
    title: '已达到登记门槛',
    message: '营业额已达到 {{threshold}} {{currency}} 的登记门槛',
  },
  'tax.deadline.vat': {
    title: '{{period}}增值税申报即将到期',
    message: '{{period}}增值税申报（{{range}}）的截止日期为 {{dueDate}}。',
  },
  'tax.deadline.vat.overdue': {
    title: '{{period}}增值税申报已逾期',
    message: '截止日期为 {{dueDate}}，尚未提交。',
  },
  'tax.deadline.income': {
    title: '个人所得税申报即将到期',
    message: '{{returnName}}（{{taxYear}}）的申报截止日期为 {{dueDate}}',
  },
  'tax.rates.official': {
    title: '官方增值税税率与您的不同',
    message: '{{country}}的官方增值税税率与您的不同。请在税务设置中核对。',
  },
};

const pl: TranslationMap = {
  'subscription.price_changed': {
    title: 'Zmiana ceny subskrypcji',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} za obciążenie, {{yearly}} rocznie)',
  },
  'review.waiting': {
    title: 'Oczekują na przegląd',
    message: '{{count}} pozycji czeka w skrzynce przeglądu',
  },
  'note.mentioned': {
    title: 'Wspomniano o Tobie w notatce',
    message: '{{actorName}} wspomniał(a) o Tobie: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Wyciąg przesłany',
    message: '{{actorName}} przesłał(a) wyciąg "{{statementName}}"',
  },
  'import.committed': {
    title: 'Import zakończony',
    message: '{{actorName}} zaimportował(a) {{transactionCount}} transakcji',
  },
  'category.created': {
    title: 'Kategoria utworzona',
    message: '{{actorName}} utworzył(a) kategorię "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategoria zaktualizowana',
    message: '{{actorName}} zaktualizował(a) kategorię "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategoria usunięta',
    message: '{{actorName}} usunął/usunęła kategorię "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Zaproszono nowego członka',
    message: '{{actorName}} zaprosił(a) {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Członek dołączył',
    message: '{{memberName}} dołączył(a) do workspace',
  },
  'data.deleted': {
    title: 'Dane usunięte',
    message: '{{actorName}} usunął/usunęła {{count}} rekordów',
  },
  'workspace.updated': {
    title: 'Ustawienia workspace zaktualizowane',
    message: '{{actorName}} zaktualizował(a) ustawienia workspace',
  },
  'parsing.error': {
    title: 'Błąd przetwarzania wyciągu',
    message: 'Nie udało się przetworzyć wyciągu',
  },
  'parsing.error.named': {
    title: 'Błąd przetwarzania wyciągu',
    message: 'Nie udało się przetworzyć wyciągu "{{statementName}}"',
  },
  'import.failed': { title: 'Import nieudany', message: 'Import zakończył się błędem' },
  'import.failed.named': {
    title: 'Import nieudany',
    message: 'Import wyciągu "{{statementName}}" zakończył się błędem',
  },
  'transactions.uncategorized': {
    title: 'Transakcje bez kategorii',
    message: '{{count}} transakcji wymaga kategoryzacji',
  },
  'receipt.uncategorized': {
    title: 'Paragon bez kategorii',
    message: 'Znaleziono paragon bez kategorii',
  },
  'receipt.uncategorized.named': {
    title: 'Paragon bez kategorii',
    message: 'Paragon "{{receiptName}}" nie ma kategorii',
  },
  'payable.marked_paid': {
    title: 'Płatność oznaczona jako zapłacona',
    message: '{{vendor}} został oznaczony jako zapłacony',
  },
  'payable.overdue': {
    title: 'Płatność zaległa',
    message: '{{vendor}}: {{amount}}, termin płatności minął {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Płatność wkrótce',
    message: '{{vendor}}: {{amount}}, termin płatności {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Budżet przekroczony',
    message: 'Budżet "{{budgetName}}" przekroczył limit ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Ostrzeżenie budżetowe',
    message: 'Budżet "{{budgetName}}" osiągnął {{percentUsed}}% limitu',
  },
  'subscription.detected': {
    title: 'Wykryto subskrypcje',
    message: 'Znaleziono płatności cykliczne: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Nadchodzące opłaty subskrypcyjne',
    message: 'Wkrótce do zapłaty: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Nadchodząca opłata subskrypcyjna',
    message: 'Wkrótce do zapłaty: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Próg rejestracji podatkowej',
    message: 'Obrót osiągnął {{percentUsed}}% progu rejestracji ({{threshold}} {{currency}})',
  },
  'tax.threshold.reached': {
    title: 'Osiągnięto próg rejestracji',
    message: 'Obrót osiągnął próg rejestracji {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Deklaracja VAT za {{period}} wkrótce do złożenia',
    message: 'Deklarację VAT za {{period}} ({{range}}) należy złożyć do {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Zaległa deklaracja VAT za {{period}}',
    message: 'Termin minął {{dueDate}}, deklaracja nie została złożona.',
  },
  'tax.deadline.income': {
    title: 'Deklaracja podatku dochodowego wkrótce do złożenia',
    message: '{{returnName}} za {{taxYear}} należy złożyć do {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Oficjalne stawki VAT różnią się od Twoich',
    message:
      'Oficjalne stawki VAT ({{country}}) różnią się od Twoich. Sprawdź je w ustawieniach podatkowych.',
  },
};

const it: TranslationMap = {
  'subscription.price_changed': {
    title: 'Prezzo abbonamento cambiato',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} per addebito, {{yearly}} all’anno)',
  },
  'review.waiting': {
    title: 'In attesa di revisione',
    message: '{{count}} elementi attendono nella posta di revisione',
  },
  'note.mentioned': {
    title: 'Sei stato menzionato in una nota',
    message: '{{actorName}} ti ha menzionato: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Estratto conto caricato',
    message: '{{actorName}} ha caricato l\'estratto conto "{{statementName}}"',
  },
  'import.committed': {
    title: 'Importazione completata',
    message: '{{actorName}} ha importato {{transactionCount}} transazioni',
  },
  'category.created': {
    title: 'Categoria creata',
    message: '{{actorName}} ha creato la categoria "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Categoria aggiornata',
    message: '{{actorName}} ha aggiornato la categoria "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Categoria eliminata',
    message: '{{actorName}} ha eliminato la categoria "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Nuovo membro invitato',
    message: '{{actorName}} ha invitato {{invitedEmail}}',
  },
  'member.joined': { title: 'Membro entrato', message: '{{memberName}} è entrato nel workspace' },
  'data.deleted': {
    title: 'Dati eliminati',
    message: '{{actorName}} ha eliminato {{count}} record',
  },
  'workspace.updated': {
    title: 'Impostazioni workspace aggiornate',
    message: '{{actorName}} ha aggiornato le impostazioni del workspace',
  },
  'parsing.error': {
    title: 'Errore di analisi estratto conto',
    message: "Impossibile elaborare l'estratto conto",
  },
  'parsing.error.named': {
    title: 'Errore di analisi estratto conto',
    message: 'Impossibile elaborare l\'estratto conto "{{statementName}}"',
  },
  'import.failed': { title: 'Importazione fallita', message: "L'importazione è fallita" },
  'import.failed.named': {
    title: 'Importazione fallita',
    message: 'L\'importazione dell\'estratto conto "{{statementName}}" è fallita',
  },
  'transactions.uncategorized': {
    title: 'Transazioni senza categoria',
    message: '{{count}} transazioni richiedono categorizzazione',
  },
  'receipt.uncategorized': {
    title: 'Ricevuta senza categoria',
    message: 'Trovata una ricevuta senza categoria',
  },
  'receipt.uncategorized.named': {
    title: 'Ricevuta senza categoria',
    message: 'La ricevuta "{{receiptName}}" non ha una categoria',
  },
  'payable.marked_paid': {
    title: 'Pagamento contrassegnato come pagato',
    message: '{{vendor}} è stato contrassegnato come pagato',
  },
  'payable.overdue': {
    title: 'Pagamento scaduto',
    message: '{{amount}} a {{vendor}} scadeva il {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Pagamento in scadenza',
    message: '{{amount}} a {{vendor}} scade il {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Budget superato',
    message: 'Il budget "{{budgetName}}" ha superato il limite ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Avviso budget',
    message: 'Il budget "{{budgetName}}" ha raggiunto il {{percentUsed}}% del limite',
  },
  'subscription.detected': {
    title: 'Abbonamenti rilevati',
    message: 'Pagamenti ricorrenti trovati: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Addebiti abbonamento in arrivo',
    message: 'Presto in addebito: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Addebito abbonamento in arrivo',
    message: 'Presto in addebito: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Soglia di registrazione fiscale',
    message:
      'Il fatturato ha raggiunto il {{percentUsed}}% della soglia di {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Soglia di registrazione raggiunta',
    message: 'Il fatturato ha raggiunto la soglia di {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Dichiarazione IVA ({{period}}) in scadenza',
    message: 'La dichiarazione IVA {{period}} ({{range}}) scade il {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Dichiarazione IVA ({{period}}) scaduta',
    message: 'Scadeva il {{dueDate}} e non è stata presentata.',
  },
  'tax.deadline.income': {
    title: 'Dichiarazione dei redditi in scadenza',
    message: '{{returnName}} per {{taxYear}} scade il {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Le aliquote IVA ufficiali differiscono dalle tue',
    message:
      'Le aliquote IVA ufficiali ({{country}}) differiscono dalle tue. Controllale nelle impostazioni fiscali.',
  },
};

const sk: TranslationMap = {
  'subscription.price_changed': {
    title: 'Cena predplatného sa zmenila',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} za platbu, {{yearly}} ročne)',
  },
  'review.waiting': {
    title: 'Čakajú na kontrolu',
    message: '{{count}} položiek čaká v schránke na kontrolu',
  },
  'note.mentioned': {
    title: 'Spomenuli vás v poznámke',
    message: '{{actorName}} vás spomenul(a): {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Výpis nahraný',
    message: '{{actorName}} nahral(a) výpis "{{statementName}}"',
  },
  'import.committed': {
    title: 'Import dokončený',
    message: '{{actorName}} importoval(a) {{transactionCount}} transakcií',
  },
  'category.created': {
    title: 'Kategória vytvorená',
    message: '{{actorName}} vytvoril(a) kategóriu "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategória aktualizovaná',
    message: '{{actorName}} aktualizoval(a) kategóriu "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategória zmazaná',
    message: '{{actorName}} zmazal(a) kategóriu "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Nový člen pozvaný',
    message: '{{actorName}} pozval(a) {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Člen sa pripojil',
    message: '{{memberName}} sa pripojil(a) k workspace',
  },
  'data.deleted': { title: 'Údaje zmazané', message: '{{actorName}} zmazal(a) {{count}} záznamov' },
  'workspace.updated': {
    title: 'Nastavenia workspace aktualizované',
    message: '{{actorName}} aktualizoval(a) nastavenia workspace',
  },
  'parsing.error': { title: 'Chyba spracovania výpisu', message: 'Nepodarilo sa spracovať výpis' },
  'parsing.error.named': {
    title: 'Chyba spracovania výpisu',
    message: 'Nepodarilo sa spracovať výpis "{{statementName}}"',
  },
  'import.failed': { title: 'Import zlyhal', message: 'Import zlyhal' },
  'import.failed.named': {
    title: 'Import zlyhal',
    message: 'Import výpisu "{{statementName}}" zlyhal',
  },
  'transactions.uncategorized': {
    title: 'Transakcie bez kategórie',
    message: '{{count}} transakcií vyžaduje kategorizáciu',
  },
  'receipt.uncategorized': {
    title: 'Doklad bez kategórie',
    message: 'Nájdený doklad bez kategórie',
  },
  'receipt.uncategorized.named': {
    title: 'Doklad bez kategórie',
    message: 'Doklad "{{receiptName}}" nemá kategóriu',
  },
  'payable.marked_paid': {
    title: 'Platba označená ako zaplatená',
    message: '{{vendor}} bol označený ako zaplatený',
  },
  'payable.overdue': {
    title: 'Platba po splatnosti',
    message: '{{vendor}}: {{amount}} bolo splatné {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Platba čoskoro splatná',
    message: '{{vendor}}: {{amount}} je splatné {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Rozpočet prekročený',
    message: 'Rozpočet "{{budgetName}}" prekročil limit ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Upozornenie na rozpočet',
    message: 'Rozpočet "{{budgetName}}" dosiahol {{percentUsed}}% limitu',
  },
  'subscription.detected': {
    title: 'Zistené predplatné',
    message: 'Nájdené opakujúce sa platby: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Nadchádzajúce platby predplatného',
    message: 'Čoskoro na úhradu: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Nadchádzajúca platba predplatného',
    message: 'Čoskoro na úhradu: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Prah daňovej registrácie',
    message: 'Obrat dosiahol {{percentUsed}}% prahu registrácie ({{threshold}} {{currency}})',
  },
  'tax.threshold.reached': {
    title: 'Prah registrácie dosiahnutý',
    message: 'Obrat dosiahol prah registrácie {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Priznanie k DPH za {{period}} je čoskoro splatné',
    message: 'Priznanie k DPH za {{period}} ({{range}}) je splatné {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Priznanie k DPH za {{period}} po splatnosti',
    message: 'Bolo splatné {{dueDate}} a nie je podané.',
  },
  'tax.deadline.income': {
    title: 'Daňové priznanie k dani z príjmov je čoskoro splatné',
    message: '{{returnName}} za {{taxYear}} je splatné {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Oficiálne sadzby DPH sa líšia od vašich',
    message:
      'Oficiálne sadzby DPH ({{country}}) sa líšia od vašich. Skontrolujte ich v daňových nastaveniach.',
  },
};

const ja: TranslationMap = {
  'subscription.price_changed': {
    title: 'サブスク料金が変わりました',
    message:
      '{{vendor}}：{{previous}} → {{current}} {{currency}}（1 回あたり {{delta}}、年間 {{yearly}}）',
  },
  'review.waiting': {
    title: '確認待ちの項目',
    message: '{{count}} 件が確認用受信箱で待っています',
  },
  'note.mentioned': {
    title: 'メモであなたがメンションされました',
    message: '{{actorName}} があなたをメンションしました: {{excerpt}}',
  },
  'statement.uploaded': {
    title: '明細書がアップロードされました',
    message: '{{actorName}} が明細書 "{{statementName}}" をアップロードしました',
  },
  'import.committed': {
    title: 'インポート完了',
    message: '{{actorName}} が {{transactionCount}} 件の取引をインポートしました',
  },
  'category.created': {
    title: 'カテゴリが作成されました',
    message: '{{actorName}} がカテゴリ "{{categoryName}}" を作成しました',
  },
  'category.updated': {
    title: 'カテゴリが更新されました',
    message: '{{actorName}} がカテゴリ "{{categoryName}}" を更新しました',
  },
  'category.deleted': {
    title: 'カテゴリが削除されました',
    message: '{{actorName}} がカテゴリ "{{categoryName}}" を削除しました',
  },
  'member.invited': {
    title: '新しいメンバーが招待されました',
    message: '{{actorName}} が {{invitedEmail}} を招待しました',
  },
  'member.joined': {
    title: 'メンバーが参加しました',
    message: '{{memberName}} がワークスペースに参加しました',
  },
  'data.deleted': {
    title: 'データが削除されました',
    message: '{{actorName}} が {{count}} 件のレコードを削除しました',
  },
  'workspace.updated': {
    title: 'ワークスペース設定が更新されました',
    message: '{{actorName}} がワークスペース設定を更新しました',
  },
  'parsing.error': { title: '明細書の解析エラー', message: '明細書を処理できませんでした' },
  'parsing.error.named': {
    title: '明細書の解析エラー',
    message: '明細書 "{{statementName}}" を処理できませんでした',
  },
  'import.failed': { title: 'インポート失敗', message: 'インポートに失敗しました' },
  'import.failed.named': {
    title: 'インポート失敗',
    message: '明細書 "{{statementName}}" のインポートに失敗しました',
  },
  'transactions.uncategorized': {
    title: '未分類の取引',
    message: '{{count}} 件の取引がカテゴリ分けを必要としています',
  },
  'receipt.uncategorized': {
    title: '未分類のレシート',
    message: '未分類のレシートが見つかりました',
  },
  'receipt.uncategorized.named': {
    title: '未分類のレシート',
    message: 'レシート "{{receiptName}}" にカテゴリがありません',
  },
  'payable.marked_paid': {
    title: '支払い済みとしてマーク',
    message: '{{vendor}} が支払い済みとしてマークされました',
  },
  'payable.overdue': {
    title: '支払い期限超過',
    message: '{{vendor}} への {{amount}} の支払期限は{{dueDate}}でした',
  },
  'payable.due_soon': {
    title: '支払い期限間近',
    message: '{{vendor}} への {{amount}} の支払期限は{{dueDate}}です',
  },
  'budget.exceeded': {
    title: '予算超過',
    message: '予算 "{{budgetName}}" が上限を超えました ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: '予算警告',
    message: '予算 "{{budgetName}}" が上限の {{percentUsed}}% に達しました',
  },
  'subscription.detected': {
    title: 'サブスクリプション検出',
    message: '定期支払いが見つかりました：{{vendors}}',
  },
  'subscription.upcoming': {
    title: '今後のサブスクリプション請求',
    message: '{{charges}} の請求が近づいています',
  },
  'subscription.upcoming.one': {
    title: '今後のサブスクリプション請求',
    message: '{{charges}} の請求が近づいています',
  },
  'tax.threshold.warning': {
    title: '税務登録のしきい値',
    message: '売上が登録しきい値 {{threshold}} {{currency}} の {{percentUsed}}% に達しました',
  },
  'tax.threshold.reached': {
    title: '登録しきい値に到達',
    message: '売上が登録しきい値 {{threshold}} {{currency}} に達しました',
  },
  'tax.deadline.vat': {
    title: '{{period}}の消費税申告の期限が近づいています',
    message: '{{period}}（{{range}}）の消費税申告の期限は{{dueDate}}です。',
  },
  'tax.deadline.vat.overdue': {
    title: '{{period}}の消費税申告が期限超過',
    message: '期限は{{dueDate}}でしたが、まだ提出されていません。',
  },
  'tax.deadline.income': {
    title: '所得税の確定申告の期限が近づいています',
    message: '{{returnName}}（{{taxYear}}）の申告期限は {{dueDate}} です',
  },
  'tax.rates.official': {
    title: '公式の付加価値税率がお使いの税率と異なります',
    message:
      '{{country}}の公式の付加価値税率がお使いの税率と異なります。税設定で確認してください。',
  },
};

const ko: TranslationMap = {
  'subscription.price_changed': {
    title: '구독 가격 변경',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} (결제당 {{delta}}, 연간 {{yearly}})',
  },
  'review.waiting': {
    title: '검토 대기 항목',
    message: '{{count}}개 항목이 검토함에서 기다리고 있습니다',
  },
  'note.mentioned': {
    title: '메모에서 회원님이 언급되었습니다',
    message: '{{actorName}}님이 회원님을 언급했습니다: {{excerpt}}',
  },
  'statement.uploaded': {
    title: '명세서 업로드됨',
    message: '{{actorName}}님이 명세서 "{{statementName}}"을(를) 업로드했습니다',
  },
  'import.committed': {
    title: '가져오기 완료',
    message: '{{actorName}}님이 {{transactionCount}}건의 거래를 가져왔습니다',
  },
  'category.created': {
    title: '카테고리 생성됨',
    message: '{{actorName}}님이 카테고리 "{{categoryName}}"을(를) 생성했습니다',
  },
  'category.updated': {
    title: '카테고리 업데이트됨',
    message: '{{actorName}}님이 카테고리 "{{categoryName}}"을(를) 업데이트했습니다',
  },
  'category.deleted': {
    title: '카테고리 삭제됨',
    message: '{{actorName}}님이 카테고리 "{{categoryName}}"을(를) 삭제했습니다',
  },
  'member.invited': {
    title: '새 멤버 초대됨',
    message: '{{actorName}}님이 {{invitedEmail}}을(를) 초대했습니다',
  },
  'member.joined': {
    title: '멤버 참여',
    message: '{{memberName}}님이 워크스페이스에 참여했습니다',
  },
  'data.deleted': {
    title: '데이터 삭제됨',
    message: '{{actorName}}님이 {{count}}개의 레코드를 삭제했습니다',
  },
  'workspace.updated': {
    title: '워크스페이스 설정 업데이트됨',
    message: '{{actorName}}님이 워크스페이스 설정을 업데이트했습니다',
  },
  'parsing.error': { title: '명세서 분석 오류', message: '명세서를 처리할 수 없습니다' },
  'parsing.error.named': {
    title: '명세서 분석 오류',
    message: '명세서 "{{statementName}}"을(를) 처리할 수 없습니다',
  },
  'import.failed': { title: '가져오기 실패', message: '가져오기에 실패했습니다' },
  'import.failed.named': {
    title: '가져오기 실패',
    message: '명세서 "{{statementName}}" 가져오기에 실패했습니다',
  },
  'transactions.uncategorized': {
    title: '미분류 거래',
    message: '{{count}}건의 거래가 분류를 기다리고 있습니다',
  },
  'receipt.uncategorized': { title: '미분류 영수증', message: '미분류 영수증이 발견되었습니다' },
  'receipt.uncategorized.named': {
    title: '미분류 영수증',
    message: '영수증 "{{receiptName}}"에 카테고리가 없습니다',
  },
  'payable.marked_paid': {
    title: '결제 완료로 표시됨',
    message: '{{vendor}}이(가) 결제 완료로 표시되었습니다',
  },
  'payable.overdue': {
    title: '결제 연체',
    message: '{{vendor}}에 대한 {{amount}}의 기한은 {{dueDate}}였습니다',
  },
  'payable.due_soon': {
    title: '결제 기한 임박',
    message: '{{vendor}}에 대한 {{amount}}의 기한은 {{dueDate}}입니다',
  },
  'budget.exceeded': {
    title: '예산 초과',
    message: '예산 "{{budgetName}}"이(가) 한도를 초과했습니다 ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: '예산 경고',
    message: '예산 "{{budgetName}}"이(가) 한도의 {{percentUsed}}%에 도달했습니다',
  },
  'subscription.detected': { title: '구독 감지됨', message: '정기 결제 발견: {{vendors}}' },
  'subscription.upcoming': {
    title: '예정된 구독 결제',
    message: '{{charges}} 결제가 곧 예정되어 있습니다',
  },
  'subscription.upcoming.one': {
    title: '예정된 구독 결제',
    message: '{{charges}} 결제가 곧 예정되어 있습니다',
  },
  'tax.threshold.warning': {
    title: '세무 등록 기준액',
    message: '매출이 등록 기준액 {{threshold}} {{currency}}의 {{percentUsed}}%에 도달했습니다',
  },
  'tax.threshold.reached': {
    title: '등록 기준액 도달',
    message: '매출이 등록 기준액 {{threshold}} {{currency}}에 도달했습니다',
  },
  'tax.deadline.vat': {
    title: '{{period}} 부가가치세 신고 기한 임박',
    message: '{{period}} 부가가치세 신고({{range}}) 기한은 {{dueDate}}입니다.',
  },
  'tax.deadline.vat.overdue': {
    title: '{{period}} 부가가치세 신고 기한 초과',
    message: '기한은 {{dueDate}}였으며 아직 제출되지 않았습니다.',
  },
  'tax.deadline.income': {
    title: '소득세 신고 기한 임박',
    message: '{{returnName}} ({{taxYear}})의 신고 기한은 {{dueDate}}입니다',
  },
  'tax.rates.official': {
    title: '공식 부가가치세율이 설정과 다릅니다',
    message: '{{country}}의 공식 부가가치세율이 설정과 다릅니다. 세금 설정에서 확인하세요.',
  },
};

const hi: TranslationMap = {
  'subscription.price_changed': {
    title: 'सदस्यता मूल्य बदला',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} (प्रति शुल्क {{delta}}, सालाना {{yearly}})',
  },
  'review.waiting': {
    title: 'समीक्षा की प्रतीक्षा',
    message: '{{count}} आइटम समीक्षा इनबॉक्स में प्रतीक्षा कर रहे हैं',
  },
  'note.mentioned': {
    title: 'एक नोट में आपका उल्लेख किया गया',
    message: '{{actorName}} ने आपका उल्लेख किया: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'स्टेटमेंट अपलोड किया गया',
    message: '{{actorName}} ने स्टेटमेंट "{{statementName}}" अपलोड किया',
  },
  'import.committed': {
    title: 'आयात पूर्ण',
    message: '{{actorName}} ने {{transactionCount}} लेनदेन आयात किए',
  },
  'category.created': {
    title: 'श्रेणी बनाई गई',
    message: '{{actorName}} ने श्रेणी "{{categoryName}}" बनाई',
  },
  'category.updated': {
    title: 'श्रेणी अपडेट की गई',
    message: '{{actorName}} ने श्रेणी "{{categoryName}}" अपडेट की',
  },
  'category.deleted': {
    title: 'श्रेणी हटाई गई',
    message: '{{actorName}} ने श्रेणी "{{categoryName}}" हटाई',
  },
  'member.invited': {
    title: 'नया सदस्य आमंत्रित',
    message: '{{actorName}} ने {{invitedEmail}} को आमंत्रित किया',
  },
  'member.joined': { title: 'सदस्य शामिल हुआ', message: '{{memberName}} वर्कस्पेस में शामिल हुए' },
  'data.deleted': { title: 'डेटा हटाया गया', message: '{{actorName}} ने {{count}} रिकॉर्ड हटाए' },
  'workspace.updated': {
    title: 'वर्कस्पेस सेटिंग्स अपडेट',
    message: '{{actorName}} ने वर्कस्पेस सेटिंग्स अपडेट कीं',
  },
  'parsing.error': { title: 'स्टेटमेंट पार्सिंग त्रुटि', message: 'स्टेटमेंट प्रोसेस नहीं किया जा सका' },
  'parsing.error.named': {
    title: 'स्टेटमेंट पार्सिंग त्रुटि',
    message: 'स्टेटमेंट "{{statementName}}" प्रोसेस नहीं किया जा सका',
  },
  'import.failed': { title: 'आयात विफल', message: 'आयात विफल हो गया' },
  'import.failed.named': {
    title: 'आयात विफल',
    message: 'स्टेटमेंट "{{statementName}}" का आयात विफल हो गया',
  },
  'transactions.uncategorized': {
    title: 'बिना श्रेणी के लेनदेन',
    message: '{{count}} लेनदेन को श्रेणी की आवश्यकता है',
  },
  'receipt.uncategorized': { title: 'बिना श्रेणी की रसीद', message: 'बिना श्रेणी की रसीद मिली' },
  'receipt.uncategorized.named': {
    title: 'बिना श्रेणी की रसीद',
    message: 'रसीद "{{receiptName}}" की कोई श्रेणी नहीं है',
  },
  'payable.marked_paid': {
    title: 'भुगतान को भुगतान के रूप में चिह्नित किया गया',
    message: '{{vendor}} को भुगतान के रूप में चिह्नित किया गया',
  },
  'payable.overdue': {
    title: 'भुगतान अतिदेय',
    message: '{{vendor}} को {{amount}} का भुगतान {{dueDate}} को देय था',
  },
  'payable.due_soon': {
    title: 'भुगतान जल्द देय',
    message: '{{vendor}} को {{amount}} का भुगतान {{dueDate}} को देय है',
  },
  'budget.exceeded': {
    title: 'बजट पार',
    message: 'बजट "{{budgetName}}" ने सीमा पार कर ली ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'बजट चेतावनी',
    message: 'बजट "{{budgetName}}" सीमा के {{percentUsed}}% तक पहुंच गया',
  },
  'subscription.detected': {
    title: 'सदस्यताएं पता चलीं',
    message: 'नियमित भुगतान पाए गए: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'आगामी सदस्यता शुल्क',
    message: 'जल्द देय: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'आगामी सदस्यता शुल्क',
    message: 'जल्द देय: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'कर पंजीकरण सीमा',
    message: 'कारोबार {{threshold}} {{currency}} पंजीकरण सीमा के {{percentUsed}}% तक पहुंच गया',
  },
  'tax.threshold.reached': {
    title: 'पंजीकरण सीमा तक पहुंच गया',
    message: 'कारोबार {{threshold}} {{currency}} की पंजीकरण सीमा तक पहुंच गया',
  },
  'tax.deadline.vat': {
    title: 'वैट रिटर्न ({{period}}) जल्द देय',
    message: 'वैट रिटर्न {{period}} ({{range}}) {{dueDate}} को देय है।',
  },
  'tax.deadline.vat.overdue': {
    title: 'वैट रिटर्न ({{period}}) अतिदेय',
    message: '{{dueDate}} को देय था और दाखिल नहीं किया गया है।',
  },
  'tax.deadline.income': {
    title: 'आयकर रिटर्न जल्द देय',
    message: '{{returnName}} ({{taxYear}}) {{dueDate}} को देय है',
  },
  'tax.rates.official': {
    title: 'आधिकारिक वैट दरें आपकी दरों से अलग हैं',
    message: '{{country}} की आधिकारिक वैट दरें आपकी दरों से अलग हैं। इन्हें टैक्स सेटिंग्स में जाँचें।',
  },
};

const nl: TranslationMap = {
  'subscription.price_changed': {
    title: 'Abonnementsprijs gewijzigd',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} per afschrijving, {{yearly}} per jaar)',
  },
  'review.waiting': {
    title: 'Wachten op beoordeling',
    message: '{{count}} items wachten in het beoordelingspostvak',
  },
  'note.mentioned': {
    title: 'Je bent genoemd in een notitie',
    message: '{{actorName}} heeft je genoemd: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Afschrift geüpload',
    message: '{{actorName}} heeft afschrift "{{statementName}}" geüpload',
  },
  'import.committed': {
    title: 'Import voltooid',
    message: '{{actorName}} heeft {{transactionCount}} transacties geïmporteerd',
  },
  'category.created': {
    title: 'Categorie aangemaakt',
    message: '{{actorName}} heeft categorie "{{categoryName}}" aangemaakt',
  },
  'category.updated': {
    title: 'Categorie bijgewerkt',
    message: '{{actorName}} heeft categorie "{{categoryName}}" bijgewerkt',
  },
  'category.deleted': {
    title: 'Categorie verwijderd',
    message: '{{actorName}} heeft categorie "{{categoryName}}" verwijderd',
  },
  'member.invited': {
    title: 'Nieuw lid uitgenodigd',
    message: '{{actorName}} heeft {{invitedEmail}} uitgenodigd',
  },
  'member.joined': {
    title: 'Lid toegetreden',
    message: '{{memberName}} is toegetreden tot de workspace',
  },
  'data.deleted': {
    title: 'Gegevens verwijderd',
    message: '{{actorName}} heeft {{count}} records verwijderd',
  },
  'workspace.updated': {
    title: 'Workspace-instellingen bijgewerkt',
    message: '{{actorName}} heeft de workspace-instellingen bijgewerkt',
  },
  'parsing.error': {
    title: 'Fout bij verwerken afschrift',
    message: 'Het afschrift kon niet worden verwerkt',
  },
  'parsing.error.named': {
    title: 'Fout bij verwerken afschrift',
    message: 'Het afschrift "{{statementName}}" kon niet worden verwerkt',
  },
  'import.failed': { title: 'Import mislukt', message: 'De import is mislukt' },
  'import.failed.named': {
    title: 'Import mislukt',
    message: 'De import van afschrift "{{statementName}}" is mislukt',
  },
  'transactions.uncategorized': {
    title: 'Ongecategoriseerde transacties',
    message: '{{count}} transacties moeten worden gecategoriseerd',
  },
  'receipt.uncategorized': {
    title: 'Ongecategoriseerd bonnetje',
    message: 'Er is een bonnetje zonder categorie gevonden',
  },
  'receipt.uncategorized.named': {
    title: 'Ongecategoriseerd bonnetje',
    message: 'Bonnetje "{{receiptName}}" heeft geen categorie',
  },
  'payable.marked_paid': {
    title: 'Betaling als betaald gemarkeerd',
    message: '{{vendor}} is als betaald gemarkeerd',
  },
  'payable.overdue': {
    title: 'Betaling achterstallig',
    message: '{{amount}} aan {{vendor}} moest uiterlijk {{dueDate}} betaald zijn',
  },
  'payable.due_soon': {
    title: 'Betaling binnenkort verschuldigd',
    message: '{{amount}} aan {{vendor}} moet uiterlijk {{dueDate}} betaald zijn',
  },
  'budget.exceeded': {
    title: 'Budget overschreden',
    message: 'Budget "{{budgetName}}" heeft de limiet overschreden ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Budgetwaarschuwing',
    message: 'Budget "{{budgetName}}" heeft {{percentUsed}}% van de limiet bereikt',
  },
  'subscription.detected': {
    title: 'Abonnementen gedetecteerd',
    message: 'Terugkerende betalingen gevonden: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Aankomende abonnementskosten',
    message: '{{charges}} worden binnenkort afgeschreven',
  },
  'subscription.upcoming.one': {
    title: 'Aankomende abonnementskosten',
    message: '{{charges}} wordt binnenkort afgeschreven',
  },
  'tax.threshold.warning': {
    title: 'Drempel voor btw-registratie',
    message:
      'De omzet heeft {{percentUsed}}% van de registratiedrempel van {{threshold}} {{currency}} bereikt',
  },
  'tax.threshold.reached': {
    title: 'Registratiedrempel bereikt',
    message: 'De omzet heeft de registratiedrempel van {{threshold}} {{currency}} bereikt',
  },
  'tax.deadline.vat': {
    title: 'Btw-aangifte {{period}} binnenkort verschuldigd',
    message: 'Btw-aangifte {{period}} ({{range}}) moet uiterlijk {{dueDate}} binnen zijn.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Btw-aangifte {{period}} te laat',
    message: 'Moest uiterlijk {{dueDate}} binnen zijn en is niet ingediend.',
  },
  'tax.deadline.income': {
    title: 'Aangifte inkomstenbelasting binnenkort verschuldigd',
    message: '{{returnName}} voor {{taxYear}} is verschuldigd op {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Officiële btw-tarieven wijken af van de uwe',
    message:
      'De officiële btw-tarieven voor {{country}} wijken af van de uwe. Controleer ze in de belastinginstellingen.',
  },
};

const sv: TranslationMap = {
  'subscription.price_changed': {
    title: 'Prenumerationspris ändrat',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} per debitering, {{yearly}} per år)',
  },
  'review.waiting': {
    title: 'Väntar på granskning',
    message: '{{count}} poster väntar i granskningsinkorgen',
  },
  'note.mentioned': {
    title: 'Du nämndes i en anteckning',
    message: '{{actorName}} nämnde dig: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Kontoutdrag uppladdat',
    message: '{{actorName}} laddade upp kontoutdraget "{{statementName}}"',
  },
  'import.committed': {
    title: 'Import slutförd',
    message: '{{actorName}} importerade {{transactionCount}} transaktioner',
  },
  'category.created': {
    title: 'Kategori skapad',
    message: '{{actorName}} skapade kategorin "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategori uppdaterad',
    message: '{{actorName}} uppdaterade kategorin "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategori borttagen',
    message: '{{actorName}} tog bort kategorin "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Ny medlem inbjuden',
    message: '{{actorName}} bjöd in {{invitedEmail}}',
  },
  'member.joined': { title: 'Medlem gick med', message: '{{memberName}} gick med i workspace' },
  'data.deleted': { title: 'Data borttagen', message: '{{actorName}} tog bort {{count}} poster' },
  'workspace.updated': {
    title: 'Workspace-inställningar uppdaterade',
    message: '{{actorName}} uppdaterade workspace-inställningarna',
  },
  'parsing.error': {
    title: 'Fel vid analys av kontoutdrag',
    message: 'Kontoutdraget kunde inte bearbetas',
  },
  'parsing.error.named': {
    title: 'Fel vid analys av kontoutdrag',
    message: 'Kontoutdraget "{{statementName}}" kunde inte bearbetas',
  },
  'import.failed': { title: 'Import misslyckades', message: 'Importen misslyckades' },
  'import.failed.named': {
    title: 'Import misslyckades',
    message: 'Importen av kontoutdraget "{{statementName}}" misslyckades',
  },
  'transactions.uncategorized': {
    title: 'Okategoriserade transaktioner',
    message: '{{count}} transaktioner behöver kategoriseras',
  },
  'receipt.uncategorized': {
    title: 'Okategoriserat kvitto',
    message: 'Ett kvitto utan kategori hittades',
  },
  'receipt.uncategorized.named': {
    title: 'Okategoriserat kvitto',
    message: 'Kvittot "{{receiptName}}" saknar kategori',
  },
  'payable.marked_paid': {
    title: 'Betalning markerad som betald',
    message: '{{vendor}} har markerats som betald',
  },
  'payable.overdue': {
    title: 'Betalning förfallen',
    message: '{{amount}} till {{vendor}} skulle betalas senast {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Betalning snart förfallen',
    message: '{{amount}} till {{vendor}} ska betalas senast {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Budget överskriden',
    message: 'Budgeten "{{budgetName}}" har överskridit sin gräns ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Budgetvarning',
    message: 'Budgeten "{{budgetName}}" har nått {{percentUsed}}% av sin gräns',
  },
  'subscription.detected': {
    title: 'Prenumerationer upptäckta',
    message: 'Återkommande betalningar hittades: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Kommande prenumerationsavgifter',
    message: '{{charges}} dras snart',
  },
  'subscription.upcoming.one': {
    title: 'Kommande prenumerationsavgift',
    message: '{{charges}} dras snart',
  },
  'tax.threshold.warning': {
    title: 'Tröskel för skatteregistrering',
    message:
      'Omsättningen har nått {{percentUsed}}% av registreringströskeln på {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Registreringströskeln nådd',
    message: 'Omsättningen har nått registreringströskeln på {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Momsdeklaration för {{period}} förfaller snart',
    message: 'Momsdeklarationen för {{period}} ({{range}}) ska lämnas senast {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Momsdeklaration för {{period}} försenad',
    message: 'Skulle lämnas senast {{dueDate}} och är inte inlämnad.',
  },
  'tax.deadline.income': {
    title: 'Inkomstdeklaration snart förfallen',
    message: '{{returnName}} för {{taxYear}} förfaller {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Officiella momssatser skiljer sig från dina',
    message:
      'De officiella momssatserna för {{country}} skiljer sig från dina. Kontrollera dem i skatteinställningarna.',
  },
};

const vi: TranslationMap = {
  'subscription.price_changed': {
    title: 'Giá đăng ký thay đổi',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} mỗi lần, {{yearly}} mỗi năm)',
  },
  'review.waiting': {
    title: 'Đang chờ xem xét',
    message: '{{count}} mục đang chờ trong hộp thư xem xét',
  },
  'note.mentioned': {
    title: 'Bạn được nhắc đến trong một ghi chú',
    message: '{{actorName}} đã nhắc đến bạn: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Sao kê đã tải lên',
    message: '{{actorName}} đã tải lên sao kê "{{statementName}}"',
  },
  'import.committed': {
    title: 'Nhập hoàn tất',
    message: '{{actorName}} đã nhập {{transactionCount}} giao dịch',
  },
  'category.created': {
    title: 'Danh mục đã tạo',
    message: '{{actorName}} đã tạo danh mục "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Danh mục đã cập nhật',
    message: '{{actorName}} đã cập nhật danh mục "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Danh mục đã xóa',
    message: '{{actorName}} đã xóa danh mục "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Thành viên mới được mời',
    message: '{{actorName}} đã mời {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Thành viên đã tham gia',
    message: '{{memberName}} đã tham gia workspace',
  },
  'data.deleted': { title: 'Dữ liệu đã xóa', message: '{{actorName}} đã xóa {{count}} bản ghi' },
  'workspace.updated': {
    title: 'Cài đặt workspace đã cập nhật',
    message: '{{actorName}} đã cập nhật cài đặt workspace',
  },
  'parsing.error': { title: 'Lỗi phân tích sao kê', message: 'Không thể xử lý sao kê' },
  'parsing.error.named': {
    title: 'Lỗi phân tích sao kê',
    message: 'Không thể xử lý sao kê "{{statementName}}"',
  },
  'import.failed': { title: 'Nhập thất bại', message: 'Quá trình nhập đã thất bại' },
  'import.failed.named': {
    title: 'Nhập thất bại',
    message: 'Nhập sao kê "{{statementName}}" đã thất bại',
  },
  'transactions.uncategorized': {
    title: 'Giao dịch chưa phân loại',
    message: '{{count}} giao dịch cần được phân loại',
  },
  'receipt.uncategorized': {
    title: 'Hóa đơn chưa phân loại',
    message: 'Tìm thấy hóa đơn chưa phân loại',
  },
  'receipt.uncategorized.named': {
    title: 'Hóa đơn chưa phân loại',
    message: 'Hóa đơn "{{receiptName}}" chưa có danh mục',
  },
  'payable.marked_paid': {
    title: 'Thanh toán đã được đánh dấu',
    message: '{{vendor}} đã được đánh dấu là đã thanh toán',
  },
  'payable.overdue': {
    title: 'Thanh toán quá hạn',
    message: '{{amount}} cho {{vendor}} đã đến hạn vào {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Thanh toán sắp đến hạn',
    message: '{{amount}} cho {{vendor}} đến hạn vào {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Vượt ngân sách',
    message: 'Ngân sách "{{budgetName}}" đã vượt giới hạn ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Cảnh báo ngân sách',
    message: 'Ngân sách "{{budgetName}}" đã đạt {{percentUsed}}% giới hạn',
  },
  'subscription.detected': {
    title: 'Phát hiện đăng ký',
    message: 'Tìm thấy thanh toán định kỳ: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Phí đăng ký sắp tới',
    message: 'Sắp bị trừ tiền: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Phí đăng ký sắp tới',
    message: 'Sắp bị trừ tiền: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Ngưỡng đăng ký thuế',
    message: 'Doanh thu đã đạt {{percentUsed}}% ngưỡng đăng ký {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Đã đạt ngưỡng đăng ký',
    message: 'Doanh thu đã đạt ngưỡng đăng ký {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Tờ khai thuế VAT {{period}} sắp đến hạn',
    message: 'Tờ khai thuế VAT {{period}} ({{range}}) đến hạn vào {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Tờ khai thuế VAT {{period}} quá hạn',
    message: 'Đã đến hạn vào {{dueDate}} và chưa được nộp.',
  },
  'tax.deadline.income': {
    title: 'Tờ khai thuế thu nhập sắp đến hạn',
    message: '{{returnName}} cho {{taxYear}} đến hạn vào {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Thuế suất VAT chính thức khác với của bạn',
    message:
      'Thuế suất VAT chính thức của {{country}} khác với của bạn. Hãy kiểm tra trong cài đặt thuế.',
  },
};

const id: TranslationMap = {
  'subscription.price_changed': {
    title: 'Harga langganan berubah',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} per tagihan, {{yearly}} per tahun)',
  },
  'review.waiting': {
    title: 'Menunggu peninjauan',
    message: '{{count}} item menunggu di kotak masuk peninjauan',
  },
  'note.mentioned': {
    title: 'Anda disebut dalam sebuah catatan',
    message: '{{actorName}} menyebut Anda: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Laporan diunggah',
    message: '{{actorName}} mengunggah laporan "{{statementName}}"',
  },
  'import.committed': {
    title: 'Impor selesai',
    message: '{{actorName}} mengimpor {{transactionCount}} transaksi',
  },
  'category.created': {
    title: 'Kategori dibuat',
    message: '{{actorName}} membuat kategori "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategori diperbarui',
    message: '{{actorName}} memperbarui kategori "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategori dihapus',
    message: '{{actorName}} menghapus kategori "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Anggota baru diundang',
    message: '{{actorName}} mengundang {{invitedEmail}}',
  },
  'member.joined': { title: 'Anggota bergabung', message: '{{memberName}} bergabung ke workspace' },
  'data.deleted': { title: 'Data dihapus', message: '{{actorName}} menghapus {{count}} catatan' },
  'workspace.updated': {
    title: 'Pengaturan workspace diperbarui',
    message: '{{actorName}} memperbarui pengaturan workspace',
  },
  'parsing.error': { title: 'Kesalahan parsing laporan', message: 'Gagal memproses laporan' },
  'parsing.error.named': {
    title: 'Kesalahan parsing laporan',
    message: 'Gagal memproses laporan "{{statementName}}"',
  },
  'import.failed': { title: 'Impor gagal', message: 'Impor gagal' },
  'import.failed.named': {
    title: 'Impor gagal',
    message: 'Impor laporan "{{statementName}}" gagal',
  },
  'transactions.uncategorized': {
    title: 'Transaksi tanpa kategori',
    message: '{{count}} transaksi perlu dikategorikan',
  },
  'receipt.uncategorized': {
    title: 'Kwitansi tanpa kategori',
    message: 'Ditemukan kwitansi tanpa kategori',
  },
  'receipt.uncategorized.named': {
    title: 'Kwitansi tanpa kategori',
    message: 'Kwitansi "{{receiptName}}" tidak memiliki kategori',
  },
  'payable.marked_paid': {
    title: 'Tagihan ditandai lunas',
    message: '{{vendor}} ditandai sebagai lunas',
  },
  'payable.overdue': {
    title: 'Tagihan terlambat',
    message: '{{amount}} untuk {{vendor}} sudah jatuh tempo pada {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Tagihan segera jatuh tempo',
    message: '{{amount}} untuk {{vendor}} jatuh tempo pada {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Anggaran terlampaui',
    message: 'Anggaran "{{budgetName}}" telah melampaui batas ({{percentUsed}}%)',
  },
  'budget.warning': {
    title: 'Peringatan anggaran',
    message: 'Anggaran "{{budgetName}}" telah mencapai {{percentUsed}}% batas',
  },
  'subscription.detected': {
    title: 'Langganan terdeteksi',
    message: 'Pembayaran berulang ditemukan: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Tagihan langganan mendatang',
    message: 'Segera ditagih: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Tagihan langganan mendatang',
    message: 'Segera ditagih: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Ambang pendaftaran pajak',
    message:
      'Omzet telah mencapai {{percentUsed}}% dari ambang pendaftaran {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Ambang pendaftaran tercapai',
    message: 'Omzet telah mencapai ambang pendaftaran {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'SPT PPN {{period}} segera jatuh tempo',
    message: 'SPT PPN {{period}} ({{range}}) jatuh tempo pada {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'SPT PPN {{period}} terlambat',
    message: 'Jatuh tempo pada {{dueDate}} dan belum diajukan.',
  },
  'tax.deadline.income': {
    title: 'SPT pajak penghasilan segera jatuh tempo',
    message: '{{returnName}} untuk {{taxYear}} jatuh tempo pada {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Tarif PPN resmi berbeda dari tarif Anda',
    message: 'Tarif PPN resmi {{country}} berbeda dari tarif Anda. Periksa di pengaturan pajak.',
  },
};

const da: TranslationMap = {
  'subscription.price_changed': {
    title: 'Abonnementets pris er ændret',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} pr. træk, {{yearly}} om året)',
  },
  'review.waiting': {
    title: 'Poster venter på gennemgang',
    message: '{{count}} poster venter i gennemgangsindbakken',
  },
  'note.mentioned': {
    title: 'Du blev nævnt i en note',
    message: '{{actorName}} nævnte dig: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Kontoudtog uploadet',
    message: '{{actorName}} uploadede kontoudtoget "{{statementName}}"',
  },
  'import.committed': {
    title: 'Import fuldført',
    message: '{{actorName}} importerede {{transactionCount}} posteringer',
  },
  'category.created': {
    title: 'Kategori oprettet',
    message: '{{actorName}} oprettede kategorien "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategori opdateret',
    message: '{{actorName}} opdaterede kategorien "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategori slettet',
    message: '{{actorName}} slettede kategorien "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Nyt medlem inviteret',
    message: '{{actorName}} inviterede {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Medlem tilsluttet',
    message: '{{memberName}} blev medlem af arbejdsområdet',
  },
  'data.deleted': {
    title: 'Data slettet',
    message: '{{actorName}} slettede {{count}} poster',
  },
  'workspace.updated': {
    title: 'Arbejdsområdets indstillinger opdateret',
    message: '{{actorName}} opdaterede arbejdsområdets indstillinger',
  },
  'parsing.error': {
    title: 'Fejl ved tolkning af kontoudtog',
    message: 'Kontoudtoget kunne ikke behandles',
  },
  'parsing.error.named': {
    title: 'Fejl ved tolkning af kontoudtog',
    message: 'Kontoudtoget "{{statementName}}" kunne ikke behandles',
  },
  'import.failed': {
    title: 'Import mislykkedes',
    message: 'Importen mislykkedes med en fejl',
  },
  'import.failed.named': {
    title: 'Import mislykkedes',
    message: 'Import af kontoudtoget "{{statementName}}" mislykkedes',
  },
  'transactions.uncategorized': {
    title: 'Ukategoriserede posteringer',
    message: '{{count}} posteringer mangler kategori',
  },
  'receipt.uncategorized': {
    title: 'Ukategoriseret kvittering',
    message: 'Der blev fundet en kvittering uden kategori',
  },
  'receipt.uncategorized.named': {
    title: 'Ukategoriseret kvittering',
    message: 'Kvitteringen "{{receiptName}}" har ingen kategori',
  },
  'payable.marked_paid': {
    title: 'Kreditorpost markeret som betalt',
    message: '{{vendor}} blev markeret som betalt',
  },
  'payable.overdue': {
    title: 'Kreditorpost overskredet',
    message: '{{amount}} til {{vendor}} skulle betales senest {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Kreditorpost forfalder snart',
    message: '{{amount}} til {{vendor}} skal betales senest {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Budget overskredet',
    message: 'Budgettet "{{budgetName}}" har overskredet sin grænse ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Budgetadvarsel',
    message: 'Budgettet "{{budgetName}}" har nået {{percentUsed}} % af sin grænse',
  },
  'subscription.detected': {
    title: 'Abonnementer fundet',
    message: 'Fundet tilbagevendende betalinger: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Kommende abonnementsopkrævninger',
    message: '{{charges}} trækkes snart',
  },
  'subscription.upcoming.one': {
    title: 'Kommende abonnementsopkrævning',
    message: '{{charges}} trækkes snart',
  },
  'tax.threshold.warning': {
    title: 'Grænse for momsregistrering',
    message:
      'Omsætningen har nået {{percentUsed}} % af registreringsgrænsen på {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Registreringsgrænsen er nået',
    message: 'Omsætningen har nået registreringsgrænsen på {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Momsangivelse for {{period}} forfalder snart',
    message: 'Momsangivelsen for {{period}} ({{range}}) skal indberettes senest {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Momsangivelse for {{period}} er overskredet',
    message: 'Skulle indberettes senest {{dueDate}} og er ikke indberettet.',
  },
  'tax.deadline.income': {
    title: 'Selvangivelse forfalder snart',
    message: '{{returnName}} for {{taxYear}} forfalder {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Officielle momssatser afviger fra dine',
    message:
      'De officielle momssatser for {{country}} afviger fra dine. Gennemgå dem i skatteindstillingerne.',
  },
};

const nb: TranslationMap = {
  'subscription.price_changed': {
    title: 'Abonnementsprisen er endret',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} per trekk, {{yearly}} i året)',
  },
  'review.waiting': {
    title: 'Poster venter på gjennomgang',
    message: '{{count}} poster venter i gjennomgangsinnboksen',
  },
  'note.mentioned': {
    title: 'Du ble nevnt i et notat',
    message: '{{actorName}} nevnte deg: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Kontoutskrift lastet opp',
    message: '{{actorName}} lastet opp kontoutskriften "{{statementName}}"',
  },
  'import.committed': {
    title: 'Import fullført',
    message: '{{actorName}} importerte {{transactionCount}} transaksjoner',
  },
  'category.created': {
    title: 'Kategori opprettet',
    message: '{{actorName}} opprettet kategorien "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategori oppdatert',
    message: '{{actorName}} oppdaterte kategorien "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategori slettet',
    message: '{{actorName}} slettet kategorien "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Nytt medlem invitert',
    message: '{{actorName}} inviterte {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Medlem ble med',
    message: '{{memberName}} ble med i arbeidsområdet',
  },
  'data.deleted': {
    title: 'Data slettet',
    message: '{{actorName}} slettet {{count}} poster',
  },
  'workspace.updated': {
    title: 'Innstillinger for arbeidsområdet oppdatert',
    message: '{{actorName}} oppdaterte innstillingene for arbeidsområdet',
  },
  'parsing.error': {
    title: 'Feil ved tolking av kontoutskrift',
    message: 'Kontoutskriften kunne ikke behandles',
  },
  'parsing.error.named': {
    title: 'Feil ved tolking av kontoutskrift',
    message: 'Kontoutskriften "{{statementName}}" kunne ikke behandles',
  },
  'import.failed': {
    title: 'Import mislyktes',
    message: 'Importen mislyktes med en feil',
  },
  'import.failed.named': {
    title: 'Import mislyktes',
    message: 'Import av kontoutskriften "{{statementName}}" mislyktes',
  },
  'transactions.uncategorized': {
    title: 'Ukategoriserte transaksjoner',
    message: '{{count}} transaksjoner mangler kategori',
  },
  'receipt.uncategorized': {
    title: 'Ukategorisert kvittering',
    message: 'Det ble funnet en kvittering uten kategori',
  },
  'receipt.uncategorized.named': {
    title: 'Ukategorisert kvittering',
    message: 'Kvitteringen "{{receiptName}}" har ingen kategori',
  },
  'payable.marked_paid': {
    title: 'Leverandørgjeld merket som betalt',
    message: '{{vendor}} ble merket som betalt',
  },
  'payable.overdue': {
    title: 'Leverandørgjeld forfalt',
    message: '{{amount}} til {{vendor}} skulle vært betalt innen {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Leverandørgjeld forfaller snart',
    message: '{{amount}} til {{vendor}} skal betales innen {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Budsjett overskredet',
    message: 'Budsjettet "{{budgetName}}" har overskredet grensen ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Budsjettvarsel',
    message: 'Budsjettet "{{budgetName}}" har nådd {{percentUsed}} % av grensen',
  },
  'subscription.detected': {
    title: 'Abonnementer oppdaget',
    message: 'Fant gjentakende betalinger: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Kommende abonnementsbelastninger',
    message: '{{charges}} trekkes snart',
  },
  'subscription.upcoming.one': {
    title: 'Kommende abonnementsbelastning',
    message: '{{charges}} trekkes snart',
  },
  'tax.threshold.warning': {
    title: 'Grense for mva-registrering',
    message:
      'Omsetningen har nådd {{percentUsed}} % av registreringsgrensen på {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Registreringsgrensen er nådd',
    message: 'Omsetningen har nådd registreringsgrensen på {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Mva-melding for {{period}} forfaller snart',
    message: 'Mva-meldingen for {{period}} ({{range}}) skal leveres innen {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Mva-melding for {{period}} er forfalt',
    message: 'Skulle vært levert innen {{dueDate}} og er ikke levert.',
  },
  'tax.deadline.income': {
    title: 'Skattemelding forfaller snart',
    message: '{{returnName}} for {{taxYear}} forfaller {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Offisielle mva-satser avviker fra dine',
    message:
      'De offisielle mva-satsene for {{country}} avviker fra dine. Gå gjennom dem i skatteinnstillingene.',
  },
};

const nn: TranslationMap = {
  'subscription.price_changed': {
    title: 'Abonnementsprisen er endra',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} per trekk, {{yearly}} i året)',
  },
  'review.waiting': {
    title: 'Postar ventar på gjennomgang',
    message: '{{count}} postar ventar i gjennomgangsinnboksen',
  },
  'note.mentioned': {
    title: 'Du vart nemnd i eit notat',
    message: '{{actorName}} nemnde deg: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Kontoutskrift lasta opp',
    message: '{{actorName}} lasta opp kontoutskrifta "{{statementName}}"',
  },
  'import.committed': {
    title: 'Import fullført',
    message: '{{actorName}} importerte {{transactionCount}} transaksjonar',
  },
  'category.created': {
    title: 'Kategori oppretta',
    message: '{{actorName}} oppretta kategorien "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategori oppdatert',
    message: '{{actorName}} oppdaterte kategorien "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategori sletta',
    message: '{{actorName}} sletta kategorien "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Nytt medlem invitert',
    message: '{{actorName}} inviterte {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Medlem vart med',
    message: '{{memberName}} vart med i arbeidsområdet',
  },
  'data.deleted': {
    title: 'Data sletta',
    message: '{{actorName}} sletta {{count}} postar',
  },
  'workspace.updated': {
    title: 'Innstillingar for arbeidsområdet oppdaterte',
    message: '{{actorName}} oppdaterte innstillingane for arbeidsområdet',
  },
  'parsing.error': {
    title: 'Feil ved tolking av kontoutskrift',
    message: 'Kontoutskrifta kunne ikkje handsamast',
  },
  'parsing.error.named': {
    title: 'Feil ved tolking av kontoutskrift',
    message: 'Kontoutskrifta "{{statementName}}" kunne ikkje handsamast',
  },
  'import.failed': {
    title: 'Import mislukkast',
    message: 'Importen mislukkast med ein feil',
  },
  'import.failed.named': {
    title: 'Import mislukkast',
    message: 'Import av kontoutskrifta "{{statementName}}" mislukkast',
  },
  'transactions.uncategorized': {
    title: 'Ukategoriserte transaksjonar',
    message: '{{count}} transaksjonar manglar kategori',
  },
  'receipt.uncategorized': {
    title: 'Ukategorisert kvittering',
    message: 'Det vart funnen ei kvittering utan kategori',
  },
  'receipt.uncategorized.named': {
    title: 'Ukategorisert kvittering',
    message: 'Kvitteringa "{{receiptName}}" har ingen kategori',
  },
  'payable.marked_paid': {
    title: 'Leverandørgjeld merkt som betalt',
    message: '{{vendor}} vart merkt som betalt',
  },
  'payable.overdue': {
    title: 'Leverandørgjeld forfallen',
    message: '{{amount}} til {{vendor}} skulle vore betalt innan {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Leverandørgjeld forfell snart',
    message: '{{amount}} til {{vendor}} skal betalast innan {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Budsjett overskride',
    message: 'Budsjettet "{{budgetName}}" har overskride grensa ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Budsjettåtvaring',
    message: 'Budsjettet "{{budgetName}}" har nådd {{percentUsed}} % av grensa',
  },
  'subscription.detected': {
    title: 'Abonnement oppdaga',
    message: 'Fann gjentakande betalingar: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Komande abonnementsbelastingar',
    message: '{{charges}} vert trekt snart',
  },
  'subscription.upcoming.one': {
    title: 'Komande abonnementsbelasting',
    message: '{{charges}} vert trekt snart',
  },
  'tax.threshold.warning': {
    title: 'Grense for mva-registrering',
    message:
      'Omsetninga har nådd {{percentUsed}} % av registreringsgrensa på {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Registreringsgrensa er nådd',
    message: 'Omsetninga har nådd registreringsgrensa på {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Mva-melding for {{period}} forfell snart',
    message: 'Mva-meldinga for {{period}} ({{range}}) skal leverast innan {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Mva-melding for {{period}} er forfallen',
    message: 'Skulle vore levert innan {{dueDate}} og er ikkje levert.',
  },
  'tax.deadline.income': {
    title: 'Skattemelding forfell snart',
    message: '{{returnName}} for {{taxYear}} forfell {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Offisielle mva-satsar avvik frå dine',
    message:
      'Dei offisielle mva-satsane for {{country}} avvik frå dine. Gå gjennom dei i skatteinnstillingane.',
  },
};

const fi: TranslationMap = {
  'subscription.price_changed': {
    title: 'Tilauksen hinta muuttui',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} per veloitus, {{yearly}} vuodessa)',
  },
  'review.waiting': {
    title: 'Kohteita odottaa tarkistusta',
    message: '{{count}} kohdetta odottaa tarkistuslaatikossa',
  },
  'note.mentioned': {
    title: 'Sinut mainittiin muistiinpanossa',
    message: '{{actorName}} mainitsi sinut: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Tiliote ladattu',
    message: '{{actorName}} latasi tiliotteen "{{statementName}}"',
  },
  'import.committed': {
    title: 'Tuonti valmis',
    message: '{{actorName}} toi {{transactionCount}} tapahtumaa',
  },
  'category.created': {
    title: 'Kategoria luotu',
    message: '{{actorName}} loi kategorian "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategoria päivitetty',
    message: '{{actorName}} päivitti kategorian "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategoria poistettu',
    message: '{{actorName}} poisti kategorian "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Uusi jäsen kutsuttu',
    message: '{{actorName}} kutsui {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Jäsen liittyi',
    message: '{{memberName}} liittyi työtilaan',
  },
  'data.deleted': {
    title: 'Tietoja poistettu',
    message: '{{actorName}} poisti {{count}} tietuetta',
  },
  'workspace.updated': {
    title: 'Työtilan asetukset päivitetty',
    message: '{{actorName}} päivitti työtilan asetuksia',
  },
  'parsing.error': {
    title: 'Virhe tiliotteen jäsennyksessä',
    message: 'Tiliotteen käsittely ei onnistunut',
  },
  'parsing.error.named': {
    title: 'Virhe tiliotteen jäsennyksessä',
    message: 'Tiliotteen "{{statementName}}" käsittely ei onnistunut',
  },
  'import.failed': {
    title: 'Tuonti epäonnistui',
    message: 'Tuonti päättyi virheeseen',
  },
  'import.failed.named': {
    title: 'Tuonti epäonnistui',
    message: 'Tiliotteen "{{statementName}}" tuonti epäonnistui',
  },
  'transactions.uncategorized': {
    title: 'Luokittelemattomat tapahtumat',
    message: '{{count}} tapahtumaa tarvitsee kategorian',
  },
  'receipt.uncategorized': {
    title: 'Luokittelematon kuitti',
    message: 'Löytyi kuitti ilman kategoriaa',
  },
  'receipt.uncategorized.named': {
    title: 'Luokittelematon kuitti',
    message: 'Kuitilla "{{receiptName}}" ei ole kategoriaa',
  },
  'payable.marked_paid': {
    title: 'Ostovelka merkitty maksetuksi',
    message: '{{vendor}} merkittiin maksetuksi',
  },
  'payable.overdue': {
    title: 'Ostovelka myöhässä',
    message: '{{vendor}}: {{amount}}, erääntyi {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Ostovelka erääntyy pian',
    message: '{{vendor}}: {{amount}}, erääntyy {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Budjetti ylitetty',
    message: 'Budjetti "{{budgetName}}" on ylittänyt rajansa ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Budjettivaroitus',
    message: 'Budjetti "{{budgetName}}" on saavuttanut {{percentUsed}} % rajastaan',
  },
  'subscription.detected': {
    title: 'Tilauksia havaittu',
    message: 'Löytyi toistuvia maksuja: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Tulevat tilausveloitukset',
    message: 'Veloitetaan pian: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Tuleva tilausveloitus',
    message: 'Veloitetaan pian: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'ALV-rekisteröinnin raja',
    message:
      'Liikevaihto on saavuttanut {{percentUsed}} % rekisteröintirajasta {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Rekisteröintiraja saavutettu',
    message: 'Liikevaihto on saavuttanut rekisteröintirajan {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'ALV-ilmoitus erääntyy pian ({{period}})',
    message: 'ALV-ilmoitus ({{period}}, {{range}}) erääntyy {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'ALV-ilmoitus myöhässä ({{period}})',
    message: 'Erääntyi {{dueDate}}, eikä sitä ole jätetty.',
  },
  'tax.deadline.income': {
    title: 'Veroilmoitus erääntyy pian',
    message: '{{returnName}} vuodelle {{taxYear}} erääntyy {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Viralliset ALV-kannat poikkeavat omistasi',
    message:
      'Viralliset ALV-kannat ({{country}}) poikkeavat omistasi. Tarkista ne veroasetuksista.',
  },
};

const is: TranslationMap = {
  'subscription.price_changed': {
    title: 'Verð áskriftar breyttist',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} á hverja færslu, {{yearly}} á ári)',
  },
  'review.waiting': {
    title: 'Færslur bíða yfirferðar',
    message: '{{count}} færslur bíða í yfirferðarhólfinu',
  },
  'note.mentioned': {
    title: 'Þú varst nefnd í athugasemd',
    message: '{{actorName}} nefndi þig: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Yfirliti hlaðið upp',
    message: '{{actorName}} hlóð upp yfirlitinu "{{statementName}}"',
  },
  'import.committed': {
    title: 'Innflutningi lokið',
    message: '{{actorName}} flutti inn {{transactionCount}} færslur',
  },
  'category.created': {
    title: 'Kategoría búin til',
    message: '{{actorName}} bjó til kategoríuna "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategoría uppfærð',
    message: '{{actorName}} uppfærði kategoríuna "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategoríu eytt',
    message: '{{actorName}} eyddi kategoríunni "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Nýjum meðlim boðið',
    message: '{{actorName}} bauð {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Meðlimur gekk til liðs',
    message: '{{memberName}} gekk til liðs við vinnusvæðið',
  },
  'data.deleted': {
    title: 'Gögnum eytt',
    message: '{{actorName}} eyddi {{count}} skrám',
  },
  'workspace.updated': {
    title: 'Stillingar vinnusvæðis uppfærðar',
    message: '{{actorName}} uppfærði stillingar vinnusvæðisins',
  },
  'parsing.error': {
    title: 'Villa við þáttun yfirlits',
    message: 'Ekki var unnt að vinna úr yfirlitinu',
  },
  'parsing.error.named': {
    title: 'Villa við þáttun yfirlits',
    message: 'Ekki var unnt að vinna úr yfirlitinu "{{statementName}}"',
  },
  'import.failed': {
    title: 'Innflutningur mistókst',
    message: 'Innflutningur endaði með villu',
  },
  'import.failed.named': {
    title: 'Innflutningur mistókst',
    message: 'Innflutningur yfirlitsins "{{statementName}}" mistókst',
  },
  'transactions.uncategorized': {
    title: 'Óflokkaðar færslur',
    message: '{{count}} færslur þurfa kategoríu',
  },
  'receipt.uncategorized': {
    title: 'Óflokkuð kvittun',
    message: 'Kvittun án kategoríu fannst',
  },
  'receipt.uncategorized.named': {
    title: 'Óflokkuð kvittun',
    message: 'Kvittunin "{{receiptName}}" hefur enga kategoríu',
  },
  'payable.marked_paid': {
    title: 'Skuld merkt sem greidd',
    message: '{{vendor}} var merkt sem greidd',
  },
  'payable.overdue': {
    title: 'Skuld í vanskilum',
    message: '{{vendor}}: {{amount}}, gjalddagi var {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Skuld á gjalddaga á næstunni',
    message: '{{vendor}}: {{amount}}, gjalddagi {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Fjárhagsáætlun yfirfarin',
    message: 'Fjárhagsáætlunin "{{budgetName}}" hefur farið yfir markið ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Viðvörun fjárhagsáætlunar',
    message: 'Fjárhagsáætlunin "{{budgetName}}" hefur náð {{percentUsed}} % af markinu',
  },
  'subscription.detected': {
    title: 'Áskriftir greindar',
    message: 'Fundust endurteknar greiðslur: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Komandi áskriftargjöld',
    message: 'Skuldfært fljótlega: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Komandi áskriftargjald',
    message: 'Skuldfært fljótlega: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Þröskuldur VSK-skráningar',
    message:
      'Velta hefur náð {{percentUsed}} % af skráningarþröskuldinum {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Skráningarþröskuldi náð',
    message: 'Velta hefur náð skráningarþröskuldinum {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'VSK-skýrsla ({{period}}) á gjalddaga á næstunni',
    message: 'VSK-skýrsla {{period}} ({{range}}) er á gjalddaga {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'VSK-skýrsla ({{period}}) í vanskilum',
    message: 'Var á gjalddaga {{dueDate}} og hefur ekki verið skilað.',
  },
  'tax.deadline.income': {
    title: 'Skattframtal á gjalddaga á næstunni',
    message: '{{returnName}} fyrir {{taxYear}} er á gjalddaga {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Opinber VSK-hlutföll eru önnur en þín',
    message:
      'Opinber VSK-hlutföll ({{country}}) eru önnur en þín. Farðu yfir þau í skattastillingum.',
  },
};

const fo: TranslationMap = {
  'subscription.price_changed': {
    title: 'Prísurin á haldinum er broyttur',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} fyri hvørja skuldseting, {{yearly}} um árið)',
  },
  'review.waiting': {
    title: 'Postar bíða eftir eftirkanning',
    message: '{{count}} postar bíða í eftirkanningarinnbakkanum',
  },
  'note.mentioned': {
    title: 'Tú varðst nevnd í einum notati',
    message: '{{actorName}} nevndi tær: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Kontoúrtøk lagt upp',
    message: '{{actorName}} legði kontoúrtøkið "{{statementName}}" upp',
  },
  'import.committed': {
    title: 'Innflutningur fullfíggjaður',
    message: '{{actorName}} flutti {{transactionCount}} posteringar inn',
  },
  'category.created': {
    title: 'Bólkur stovnaður',
    message: '{{actorName}} stovnaði bólkin "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Bólkur dagførdur',
    message: '{{actorName}} dagførdi bólkin "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Bólkur strikaður',
    message: '{{actorName}} strikaði bólkin "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Nýggjur limur bodin',
    message: '{{actorName}} bjóðaði {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Limur varð við',
    message: '{{memberName}} varð við í arbeiðsøkinum',
  },
  'data.deleted': {
    title: 'Dátur strikaðar',
    message: '{{actorName}} strikaði {{count}} skrásetingar',
  },
  'workspace.updated': {
    title: 'Innstillingar fyri arbeiðsøki dagførdar',
    message: '{{actorName}} dagførdi innstillingarnar fyri arbeiðsøkið',
  },
  'parsing.error': {
    title: 'Feilur í tólking av kontoúrtøki',
    message: 'Fekk ikki viðgjørt kontoúrtøkið',
  },
  'parsing.error.named': {
    title: 'Feilur í tólking av kontoúrtøki',
    message: 'Fekk ikki viðgjørt kontoúrtøkið "{{statementName}}"',
  },
  'import.failed': {
    title: 'Innflutningur miseydnaðist',
    message: 'Innflutningurin endaði við einum feili',
  },
  'import.failed.named': {
    title: 'Innflutningur miseydnaðist',
    message: 'Innflutningur av kontoúrtøkinum "{{statementName}}" miseydnaðist',
  },
  'transactions.uncategorized': {
    title: 'Óbólkaðar posteringar',
    message: '{{count}} posteringar mangla bólk',
  },
  'receipt.uncategorized': {
    title: 'Óbólkað kvittan',
    message: 'Ein kvittan uttan bólk varð funnin',
  },
  'receipt.uncategorized.named': {
    title: 'Óbólkað kvittan',
    message: 'Kvittanin "{{receiptName}}" hevur ongan bólk',
  },
  'payable.marked_paid': {
    title: 'Skuld merkt sum gjaldað',
    message: '{{vendor}} varð merkt sum gjaldað',
  },
  'payable.overdue': {
    title: 'Skuld yvir tíðina',
    message: '{{vendor}}: {{amount}}, gjalddagur var {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Skuld fellur skjótt',
    message: '{{vendor}}: {{amount}}, gjalddagur {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Fíggjarætlan yvirstigin',
    message: 'Fíggjarætlanin "{{budgetName}}" hevur fart yvir markið ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Ávaring um fíggjarætlan',
    message: 'Fíggjarætlanin "{{budgetName}}" hevur nátt {{percentUsed}} % av markinum',
  },
  'subscription.detected': {
    title: 'Hald funnin',
    message: 'Funnar endurtaknar gjaldingar: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Komandi haldsgjøld',
    message: 'Verður trekt skjótt: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Komandi haldsgjald',
    message: 'Verður trekt skjótt: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Mark fyri MVG-skráseting',
    message:
      'Umsetningurin hevur nátt {{percentUsed}} % av skrásetingarmarkinum {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Skrásetingarmarkið er nátt',
    message: 'Umsetningurin hevur nátt skrásetingarmarkinum {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'MVG-frágreiðing ({{period}}) fellur skjótt',
    message: 'MVG-frágreiðingin {{period}} ({{range}}) fellur {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'MVG-frágreiðing ({{period}}) er yvir tíðina',
    message: 'Skuldi verið latin inn {{dueDate}} og er ikki latin inn.',
  },
  'tax.deadline.income': {
    title: 'Skattframtal fellur skjótt',
    message: '{{returnName}} fyri {{taxYear}} fellur {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Almennir MVG-satsar víkja frá tínum',
    message:
      'Almennu MVG-satsarnir ({{country}}) víkja frá tínum. Kanna teir í skattastillingunum.',
  },
};

const cs: TranslationMap = {
  'subscription.price_changed': {
    title: 'Cena předplatného se změnila',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} za platbu, {{yearly}} ročně)',
  },
  'review.waiting': {
    title: 'Položky čekají na kontrolu',
    message: '{{count}} položek čeká ve schránce ke kontrole',
  },
  'note.mentioned': {
    title: 'Byli jste zmíněni v poznámce',
    message: '{{actorName}} vás zmínil: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Výpis nahrán',
    message: '{{actorName}} nahrál výpis "{{statementName}}"',
  },
  'import.committed': {
    title: 'Import dokončen',
    message: '{{actorName}} naimportoval {{transactionCount}} transakcí',
  },
  'category.created': {
    title: 'Kategorie vytvořena',
    message: '{{actorName}} vytvořil kategorii "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategorie upravena',
    message: '{{actorName}} upravil kategorii "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategorie smazána',
    message: '{{actorName}} smazal kategorii "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Pozvání nového člena',
    message: '{{actorName}} pozval {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Člen se připojil',
    message: '{{memberName}} se připojil k pracovnímu prostoru',
  },
  'data.deleted': {
    title: 'Data smazána',
    message: '{{actorName}} smazal {{count}} záznamů',
  },
  'workspace.updated': {
    title: 'Nastavení pracovního prostoru upraveno',
    message: '{{actorName}} upravil nastavení pracovního prostoru',
  },
  'parsing.error': {
    title: 'Chyba zpracování výpisu',
    message: 'Výpis se nepodařilo zpracovat',
  },
  'parsing.error.named': {
    title: 'Chyba zpracování výpisu',
    message: 'Výpis "{{statementName}}" se nepodařilo zpracovat',
  },
  'import.failed': {
    title: 'Import se nezdařil',
    message: 'Import skončil chybou',
  },
  'import.failed.named': {
    title: 'Import se nezdařil',
    message: 'Import výpisu "{{statementName}}" se nezdařil',
  },
  'transactions.uncategorized': {
    title: 'Transakce bez kategorie',
    message: '{{count}} transakcí potřebuje kategorii',
  },
  'receipt.uncategorized': {
    title: 'Účtenka bez kategorie',
    message: 'Byla nalezena účtenka bez kategorie',
  },
  'receipt.uncategorized.named': {
    title: 'Účtenka bez kategorie',
    message: 'Účtenka "{{receiptName}}" nemá kategorii',
  },
  'payable.marked_paid': {
    title: 'Závazek označen jako zaplacený',
    message: '{{vendor}} byl označen jako zaplacený',
  },
  'payable.overdue': {
    title: 'Závazek po splatnosti',
    message: '{{vendor}}: {{amount}} bylo splatné {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Závazek je brzy splatný',
    message: '{{vendor}}: {{amount}} je splatné {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Rozpočet překročen',
    message: 'Rozpočet "{{budgetName}}" překročil svůj limit ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Upozornění rozpočtu',
    message: 'Rozpočet "{{budgetName}}" dosáhl {{percentUsed}} % svého limitu',
  },
  'subscription.detected': {
    title: 'Zjištěno předplatné',
    message: 'Nalezeny opakované platby: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Blížící se platby předplatného',
    message: 'Brzy k úhradě: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Blížící se platba předplatného',
    message: 'Brzy k úhradě: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Limit pro registraci k DPH',
    message: 'Obrat dosáhl {{percentUsed}} % registračního limitu {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Registrační limit dosažen',
    message: 'Obrat dosáhl registračního limitu {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Přiznání k DPH za {{period}} je brzy splatné',
    message: 'Přiznání k DPH za {{period}} ({{range}}) je splatné {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Přiznání k DPH za {{period}} po splatnosti',
    message: 'Bylo splatné {{dueDate}} a není podané.',
  },
  'tax.deadline.income': {
    title: 'Daňové přiznání k dani z příjmů je brzy splatné',
    message: '{{returnName}} za {{taxYear}} je splatné {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Oficiální sazby DPH se liší od vašich',
    message:
      'Oficiální sazby DPH ({{country}}) se liší od vašich. Zkontrolujte je v daňovém nastavení.',
  },
};

const bg: TranslationMap = {
  'subscription.price_changed': {
    title: 'Цената на абонамента се промени',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} на плащане, {{yearly}} годишно)',
  },
  'review.waiting': {
    title: 'Записи чакат преглед',
    message: '{{count}} записа чакат в кутията за преглед',
  },
  'note.mentioned': {
    title: 'Споменаха ви в бележка',
    message: '{{actorName}} ви спомена: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Извлечението е качено',
    message: '{{actorName}} качи извлечението "{{statementName}}"',
  },
  'import.committed': {
    title: 'Импортът е завършен',
    message: '{{actorName}} импортира {{transactionCount}} транзакции',
  },
  'category.created': {
    title: 'Категорията е създадена',
    message: '{{actorName}} създаде категорията "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Категорията е обновена',
    message: '{{actorName}} обнови категорията "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Категорията е изтрита',
    message: '{{actorName}} изтри категорията "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Поканен е нов участник',
    message: '{{actorName}} покани {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Участник се присъедини',
    message: '{{memberName}} се присъедини към работното пространство',
  },
  'data.deleted': {
    title: 'Данни са изтрити',
    message: '{{actorName}} изтри {{count}} записа',
  },
  'workspace.updated': {
    title: 'Настройките на работното пространство са обновени',
    message: '{{actorName}} обнови настройките на работното пространство',
  },
  'parsing.error': {
    title: 'Грешка при разчитане на извлечение',
    message: 'Извлечението не можа да бъде обработено',
  },
  'parsing.error.named': {
    title: 'Грешка при разчитане на извлечение',
    message: 'Извлечението "{{statementName}}" не можа да бъде обработено',
  },
  'import.failed': {
    title: 'Импортът се провали',
    message: 'Импортът завърши с грешка',
  },
  'import.failed.named': {
    title: 'Импортът се провали',
    message: 'Импортът на извлечението "{{statementName}}" се провали',
  },
  'transactions.uncategorized': {
    title: 'Транзакции без категория',
    message: '{{count}} транзакции се нуждаят от категория',
  },
  'receipt.uncategorized': {
    title: 'Касова бележка без категория',
    message: 'Намерена е бележка без категория',
  },
  'receipt.uncategorized.named': {
    title: 'Касова бележка без категория',
    message: 'Бележката "{{receiptName}}" е без категория',
  },
  'payable.marked_paid': {
    title: 'Задължението е отбелязано като платено',
    message: '{{vendor}} беше отбелязано като платено',
  },
  'payable.overdue': {
    title: 'Просрочено задължение',
    message: '{{vendor}}: {{amount}}, падежът беше {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Задължение с близък срок',
    message: '{{vendor}}: {{amount}}, падеж {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Бюджетът е надвишен',
    message: 'Бюджетът "{{budgetName}}" надвиши лимита си ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Предупреждение за бюджет',
    message: 'Бюджетът "{{budgetName}}" достигна {{percentUsed}} % от лимита си',
  },
  'subscription.detected': {
    title: 'Открити са абонаменти',
    message: 'Намерени повтарящи се плащания: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Предстоящи плащания по абонаменти',
    message: 'Предстои таксуване: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Предстоящо плащане по абонамент',
    message: 'Предстои таксуване: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Праг за регистрация по ДДС',
    message:
      'Оборотът достигна {{percentUsed}} % от прага за регистрация {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Прагът за регистрация е достигнат',
    message: 'Оборотът достигна прага за регистрация {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Декларацията по ДДС за {{period}} скоро изтича',
    message: 'Декларацията по ДДС за {{period}} ({{range}}) трябва да се подаде до {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Декларацията по ДДС за {{period}} е просрочена',
    message: 'Срокът беше {{dueDate}} и не е подадена.',
  },
  'tax.deadline.income': {
    title: 'Данъчната декларация за доходите скоро изтича',
    message: '{{returnName}} за {{taxYear}} трябва да се подаде до {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Официалните ставки на ДДС се различават от вашите',
    message:
      'Официалните ставки на ДДС ({{country}}) се различават от вашите. Проверете ги в данъчните настройки.',
  },
};

const hr: TranslationMap = {
  'subscription.price_changed': {
    title: 'Cijena pretplate se promijenila',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} po terećenju, {{yearly}} godišnje)',
  },
  'review.waiting': {
    title: 'Stavke čekaju pregled',
    message: '{{count}} stavki čeka u sandučiću za pregled',
  },
  'note.mentioned': {
    title: 'Spomenuti ste u bilješci',
    message: '{{actorName}} vas je spomenuo: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Izvod je prenesen',
    message: '{{actorName}} je prenio izvod "{{statementName}}"',
  },
  'import.committed': {
    title: 'Uvoz je dovršen',
    message: '{{actorName}} je uvezao {{transactionCount}} transakcija',
  },
  'category.created': {
    title: 'Kategorija je napravljena',
    message: '{{actorName}} je napravio kategoriju "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategorija je ažurirana',
    message: '{{actorName}} je ažurirao kategoriju "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategorija je izbrisana',
    message: '{{actorName}} je izbrisao kategoriju "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Pozvan je novi član',
    message: '{{actorName}} je pozvao {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Član se pridružio',
    message: '{{memberName}} se pridružio radnom prostoru',
  },
  'data.deleted': {
    title: 'Podaci su izbrisani',
    message: '{{actorName}} je izbrisao {{count}} zapisa',
  },
  'workspace.updated': {
    title: 'Postavke radnog prostora su ažurirane',
    message: '{{actorName}} je ažurirao postavke radnog prostora',
  },
  'parsing.error': {
    title: 'Pogreška obrade izvoda',
    message: 'Izvod nije bilo moguće obraditi',
  },
  'parsing.error.named': {
    title: 'Pogreška obrade izvoda',
    message: 'Izvod "{{statementName}}" nije bilo moguće obraditi',
  },
  'import.failed': {
    title: 'Uvoz nije uspio',
    message: 'Uvoz je završio pogreškom',
  },
  'import.failed.named': {
    title: 'Uvoz nije uspio',
    message: 'Uvoz izvoda "{{statementName}}" nije uspio',
  },
  'transactions.uncategorized': {
    title: 'Transakcije bez kategorije',
    message: '{{count}} transakcija treba kategoriju',
  },
  'receipt.uncategorized': {
    title: 'Račun bez kategorije',
    message: 'Nađen je račun bez kategorije',
  },
  'receipt.uncategorized.named': {
    title: 'Račun bez kategorije',
    message: 'Račun "{{receiptName}}" nema kategoriju',
  },
  'payable.marked_paid': {
    title: 'Obveza označena kao plaćena',
    message: '{{vendor}} je označen kao plaćen',
  },
  'payable.overdue': {
    title: 'Dospjela obveza',
    message: '{{vendor}}: {{amount}}, dospijeće je bilo {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Obveza dospijeva uskoro',
    message: '{{vendor}}: {{amount}}, dospijeće {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Proračun je prekoračen',
    message: 'Proračun "{{budgetName}}" prekoračio je svoje ograničenje ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Upozorenje proračuna',
    message: 'Proračun "{{budgetName}}" dosegao je {{percentUsed}} % svojeg ograničenja',
  },
  'subscription.detected': {
    title: 'Otkrivene pretplate',
    message: 'Nađena ponavljajuća plaćanja: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Predstojeće naplate pretplata',
    message: 'Uskoro se naplaćuje: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Predstojeća naplata pretplate',
    message: 'Uskoro se naplaćuje: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Prag za registraciju PDV-a',
    message: 'Promet je dosegao {{percentUsed}} % praga za registraciju {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Prag za registraciju je dosegnut',
    message: 'Promet je dosegao prag za registraciju {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Prijava PDV-a za {{period}} uskoro dospijeva',
    message: 'Prijava PDV-a za {{period}} ({{range}}) dospijeva {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Prijava PDV-a za {{period}} je dospjela',
    message: 'Dospjela je {{dueDate}} i nije predana.',
  },
  'tax.deadline.income': {
    title: 'Porezna prijava uskoro dospijeva',
    message: '{{returnName}} za {{taxYear}} dospijeva {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Službene stope PDV-a razlikuju se od vaših',
    message:
      'Službene stope PDV-a ({{country}}) razlikuju se od vaših. Provjerite ih u poreznim postavkama.',
  },
};

const sr: TranslationMap = {
  'subscription.price_changed': {
    title: 'Цена претплате се променила',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} по задужењу, {{yearly}} годишње)',
  },
  'review.waiting': {
    title: 'Ставке чекају преглед',
    message: '{{count}} ставки чека у сандучету за преглед',
  },
  'note.mentioned': {
    title: 'Поменути сте у белешци',
    message: '{{actorName}} вас је поменуо: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Извод је пренет',
    message: '{{actorName}} је пренео извод "{{statementName}}"',
  },
  'import.committed': {
    title: 'Увоз је завршен',
    message: '{{actorName}} је увезао {{transactionCount}} трансакција',
  },
  'category.created': {
    title: 'Категорија је направљена',
    message: '{{actorName}} је направио категорију "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Категорија је ажурирана',
    message: '{{actorName}} је ажурирао категорију "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Категорија је избрисана',
    message: '{{actorName}} је избрисао категорију "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Позван је нови члан',
    message: '{{actorName}} је позвао {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Члан се придружио',
    message: '{{memberName}} се придружио радном простору',
  },
  'data.deleted': {
    title: 'Подаци су избрисани',
    message: '{{actorName}} је избрисао {{count}} записа',
  },
  'workspace.updated': {
    title: 'Подешавања радног простора су ажурирана',
    message: '{{actorName}} је ажурирао подешавања радног простора',
  },
  'parsing.error': {
    title: 'Грешка обраде извода',
    message: 'Извод није могуће обрадити',
  },
  'parsing.error.named': {
    title: 'Грешка обраде извода',
    message: 'Извод "{{statementName}}" није могуће обрадити',
  },
  'import.failed': {
    title: 'Увоз није успео',
    message: 'Увоз је завршио грешком',
  },
  'import.failed.named': {
    title: 'Увоз није успео',
    message: 'Увоз извода "{{statementName}}" није успео',
  },
  'transactions.uncategorized': {
    title: 'Трансакције без категорије',
    message: '{{count}} трансакција треба категорију',
  },
  'receipt.uncategorized': {
    title: 'Рачун без категорије',
    message: 'Нађен је рачун без категорије',
  },
  'receipt.uncategorized.named': {
    title: 'Рачун без категорије',
    message: 'Рачун "{{receiptName}}" нема категорију',
  },
  'payable.marked_paid': {
    title: 'Обавеза означена као плаћена',
    message: '{{vendor}} је означен као плаћен',
  },
  'payable.overdue': {
    title: 'Доспела обавеза',
    message: '{{vendor}}: {{amount}}, рок је био {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Обавеза доспева ускоро',
    message: '{{vendor}}: {{amount}}, рок {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Буџет је прекорачен',
    message: 'Буџет "{{budgetName}}" прекорачио је своје ограничење ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Упозорење буџета',
    message: 'Буџет "{{budgetName}}" достигао је {{percentUsed}} % свог ограничења',
  },
  'subscription.detected': {
    title: 'Откривене претплате',
    message: 'Нађена понављајућа плаћања: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Предстојеће наплате претплата',
    message: 'Ускоро се наплаћује: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Предстојећа наплата претплате',
    message: 'Ускоро се наплаћује: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Праг за регистрацију ПДВ-а',
    message:
      'Промет је достигао {{percentUsed}} % прага за регистрацију {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Праг за регистрацију је достигнут',
    message: 'Промет је достигао праг за регистрацију {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Пријава ПДВ-а за {{period}} ускоро доспева',
    message: 'Пријава ПДВ-а за {{period}} ({{range}}) доспева {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Пријава ПДВ-а за {{period}} је доспела',
    message: 'Доспела је {{dueDate}} и није предата.',
  },
  'tax.deadline.income': {
    title: 'Пореска пријава ускоро доспева',
    message: '{{returnName}} за {{taxYear}} доспева {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Званичне стопе ПДВ-а разликују се од ваших',
    message:
      'Званичне стопе ПДВ-а ({{country}}) разликују се од ваших. Проверите их у пореским подешавањима.',
  },
};

const sl: TranslationMap = {
  'subscription.price_changed': {
    title: 'Cena naročnine se je spremenila',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} na bremenitev, {{yearly}} na leto)',
  },
  'review.waiting': {
    title: 'Postavke čakajo na pregled',
    message: '{{count}} postavk čaka v nabiralniku za pregled',
  },
  'note.mentioned': {
    title: 'Omenjeni ste bili v opombi',
    message: '{{actorName}} vas je omenil: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Izpisek je naložen',
    message: '{{actorName}} je naložil izpisek "{{statementName}}"',
  },
  'import.committed': {
    title: 'Uvoz je končan',
    message: '{{actorName}} je uvozil {{transactionCount}} transakcij',
  },
  'category.created': {
    title: 'Kategorija je ustvarjena',
    message: '{{actorName}} je ustvaril kategorijo "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategorija je posodobljena',
    message: '{{actorName}} je posodobil kategorijo "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategorija je izbrisana',
    message: '{{actorName}} je izbrisal kategorijo "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Povabljen je nov član',
    message: '{{actorName}} je povabil {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Član se je pridružil',
    message: '{{memberName}} se je pridružil delovnemu prostoru',
  },
  'data.deleted': {
    title: 'Podatki so izbrisani',
    message: '{{actorName}} je izbrisal {{count}} zapisov',
  },
  'workspace.updated': {
    title: 'Nastavitve delovnega prostora so posodobljene',
    message: '{{actorName}} je posodobil nastavitve delovnega prostora',
  },
  'parsing.error': {
    title: 'Napaka pri razčlenjevanju izpiska',
    message: 'Izpiska ni bilo mogoče obdelati',
  },
  'parsing.error.named': {
    title: 'Napaka pri razčlenjevanju izpiska',
    message: 'Izpiska "{{statementName}}" ni bilo mogoče obdelati',
  },
  'import.failed': {
    title: 'Uvoz ni uspel',
    message: 'Uvoz se je končal z napako',
  },
  'import.failed.named': {
    title: 'Uvoz ni uspel',
    message: 'Uvoz izpiska "{{statementName}}" ni uspel',
  },
  'transactions.uncategorized': {
    title: 'Transakcije brez kategorije',
    message: '{{count}} transakcij potrebuje kategorijo',
  },
  'receipt.uncategorized': {
    title: 'Račun brez kategorije',
    message: 'Najden je račun brez kategorije',
  },
  'receipt.uncategorized.named': {
    title: 'Račun brez kategorije',
    message: 'Račun "{{receiptName}}" nima kategorije',
  },
  'payable.marked_paid': {
    title: 'Obveznost označena kot plačana',
    message: '{{vendor}} je bil označen kot plačan',
  },
  'payable.overdue': {
    title: 'Zapadla obveznost',
    message: '{{vendor}}: {{amount}}, zapadlo {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Obveznost zapade kmalu',
    message: '{{vendor}}: {{amount}}, zapade {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Proračun je presežen',
    message: 'Proračun "{{budgetName}}" je presegel svojo omejitev ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Opozorilo proračuna',
    message: 'Proračun "{{budgetName}}" je dosegel {{percentUsed}} % svoje omejitve',
  },
  'subscription.detected': {
    title: 'Zaznane naročnine',
    message: 'Najdena ponavljajoča se plačila: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Prihajajoči obračuni naročnin',
    message: 'Kmalu v obračunu: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Prihajajoči obračun naročnine',
    message: 'Kmalu v obračunu: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Prag za registracijo DDV',
    message: 'Promet je dosegel {{percentUsed}} % praga za registracijo {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Prag za registracijo je dosežen',
    message: 'Promet je dosegel prag za registracijo {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Napoved DDV za {{period}} kmalu zapade',
    message: 'Napoved DDV za {{period}} ({{range}}) zapade {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Napoved DDV za {{period}} je zapadla',
    message: 'Zapadla je {{dueDate}} in ni oddana.',
  },
  'tax.deadline.income': {
    title: 'Davčna napoved kmalu zapade',
    message: '{{returnName}} za {{taxYear}} zapade {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Uradne stopnje DDV se razlikujejo od vaših',
    message:
      'Uradne stopnje DDV ({{country}}) se razlikujejo od vaših. Preverite jih v davčnih nastavitvah.',
  },
};

const mk: TranslationMap = {
  'subscription.price_changed': {
    title: 'Цената на претплатата се промени',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} по задолжување, {{yearly}} годишно)',
  },
  'review.waiting': {
    title: 'Ставки чекаат преглед',
    message: '{{count}} ставки чекаат во сандачето за преглед',
  },
  'note.mentioned': {
    title: 'Споменати сте во белешка',
    message: '{{actorName}} ве спомна: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Изводот е прикачен',
    message: '{{actorName}} го прикачи изводот "{{statementName}}"',
  },
  'import.committed': {
    title: 'Увозот е завршен',
    message: '{{actorName}} увезе {{transactionCount}} трансакции',
  },
  'category.created': {
    title: 'Категоријата е создадена',
    message: '{{actorName}} ја создаде категоријата "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Категоријата е ажурирана',
    message: '{{actorName}} ја ажурира категоријата "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Категоријата е избришана',
    message: '{{actorName}} ја избриша категоријата "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Поканет е нов член',
    message: '{{actorName}} покани {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Член се придружи',
    message: '{{memberName}} се придружи на работниот простор',
  },
  'data.deleted': {
    title: 'Податоците се избришани',
    message: '{{actorName}} избриша {{count}} записи',
  },
  'workspace.updated': {
    title: 'Поставките на работниот простор се ажурирани',
    message: '{{actorName}} ги ажурира поставките на работниот простор',
  },
  'parsing.error': {
    title: 'Грешка при обработка на изводот',
    message: 'Изводот не можеше да се обработи',
  },
  'parsing.error.named': {
    title: 'Грешка при обработка на изводот',
    message: 'Изводот "{{statementName}}" не можеше да се обработи',
  },
  'import.failed': {
    title: 'Увозот не успеа',
    message: 'Увозот заврши со грешка',
  },
  'import.failed.named': {
    title: 'Увозот не успеа',
    message: 'Увозот на изводот "{{statementName}}" не успеа',
  },
  'transactions.uncategorized': {
    title: 'Трансакции без категорија',
    message: '{{count}} трансакции бараат категорија',
  },
  'receipt.uncategorized': {
    title: 'Фискална сметка без категорија',
    message: 'Најдена е сметка без категорија',
  },
  'receipt.uncategorized.named': {
    title: 'Фискална сметка без категорија',
    message: 'Сметката "{{receiptName}}" нема категорија',
  },
  'payable.marked_paid': {
    title: 'Обврската е означена како платена',
    message: '{{vendor}} беше означен како платен',
  },
  'payable.overdue': {
    title: 'Пречекорена обврска',
    message: '{{vendor}}: {{amount}}, рокот беше {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Обврска со близок рок',
    message: '{{vendor}}: {{amount}}, рок {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Буџетот е пречекорен',
    message: 'Буџетот "{{budgetName}}" го пречекори својот лимит ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Предупредување за буџет',
    message: 'Буџетот "{{budgetName}}" достигна {{percentUsed}} % од својот лимит',
  },
  'subscription.detected': {
    title: 'Откриени претплати',
    message: 'Најдени повторливи плаќања: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Претстојни наплати за претплати',
    message: 'Наскоро се наплатува: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Претстојна наплата за претплата',
    message: 'Наскоро се наплатува: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Праг за регистрација за ДДВ',
    message:
      'Прометот достигна {{percentUsed}} % од прагот за регистрација {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Прагот за регистрација е достигнат',
    message: 'Прометот достигна прагот за регистрација {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Пријавата за ДДВ за {{period}} наскоро доспева',
    message: 'Пријавата за ДДВ за {{period}} ({{range}}) доспева на {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Пријавата за ДДВ за {{period}} е пречекорена',
    message: 'Доспеа на {{dueDate}} и не е поднесена.',
  },
  'tax.deadline.income': {
    title: 'Даночната пријава за доход наскоро доспева',
    message: '{{returnName}} за {{taxYear}} доспева на {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Официјалните стапки на ДДВ се разликуваат од вашите',
    message:
      'Официјалните стапки на ДДВ ({{country}}) се разликуваат од вашите. Проверете ги во даночните поставки.',
  },
};

const be: TranslationMap = {
  'subscription.price_changed': {
    title: 'Кошт падпіскі змяніўся',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} за спісанне, {{yearly}} у год)',
  },
  'review.waiting': {
    title: 'Запісы чакаюць праверкі',
    message: '{{count}} запісаў чакаюць у скрыні праверкі',
  },
  'note.mentioned': {
    title: 'Вас згадалі ў заўвазе',
    message: '{{actorName}} згадаў вас: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Выпіска загружана',
    message: '{{actorName}} загрузіў выпіску «{{statementName}}»',
  },
  'import.committed': {
    title: 'Імпарт завершаны',
    message: '{{actorName}} імпартаваў {{transactionCount}} транзакцый',
  },
  'category.created': {
    title: 'Катэгорыя створана',
    message: '{{actorName}} стварыў катэгорыю «{{categoryName}}»',
  },
  'category.updated': {
    title: 'Катэгорыя абноўлена',
    message: '{{actorName}} абнавіў катэгорыю «{{categoryName}}»',
  },
  'category.deleted': {
    title: 'Катэгорыя выдалена',
    message: '{{actorName}} выдаліў катэгорыю «{{categoryName}}»',
  },
  'member.invited': {
    title: 'Запрошаны новы ўдзельнік',
    message: '{{actorName}} запрасіў {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Удзельнік далучыўся',
    message: '{{memberName}} далучыўся да працоўнай прасторы',
  },
  'data.deleted': {
    title: 'Даныя выдалены',
    message: '{{actorName}} выдаліў {{count}} запісаў',
  },
  'workspace.updated': {
    title: 'Налады працоўнай прасторы абноўлены',
    message: '{{actorName}} абнавіў налады працоўнай прасторы',
  },
  'parsing.error': {
    title: 'Памылка разбору выпіскі',
    message: 'Не ўдалося апрацаваць выпіску',
  },
  'parsing.error.named': {
    title: 'Памылка разбору выпіскі',
    message: 'Не ўдалося апрацаваць выпіску «{{statementName}}»',
  },
  'import.failed': {
    title: 'Імпарт не ўдаўся',
    message: 'Імпарт завяршыўся памылкай',
  },
  'import.failed.named': {
    title: 'Імпарт не ўдаўся',
    message: 'Імпарт выпіскі «{{statementName}}» не ўдаўся',
  },
  'transactions.uncategorized': {
    title: 'Транзакцыі без катэгорыі',
    message: '{{count}} транзакцый патрабуюць катэгорыю',
  },
  'receipt.uncategorized': {
    title: 'Чэк без катэгорыі',
    message: 'Знойдзены чэк без катэгорыі',
  },
  'receipt.uncategorized.named': {
    title: 'Чэк без катэгорыі',
    message: 'У чэка «{{receiptName}}» няма катэгорыі',
  },
  'payable.marked_paid': {
    title: 'Плацёж пазначаны як аплачаны',
    message: '{{vendor}} пазначаны як аплачаны',
  },
  'payable.overdue': {
    title: 'Пратэрмінаваны плацёж',
    message: '{{vendor}}: {{amount}}, тэрмін аплаты быў {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Плацёж хутка настане',
    message: '{{vendor}}: {{amount}}, тэрмін аплаты {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Бюджэт перавышаны',
    message: 'Бюджэт «{{budgetName}}» перавысіў свой ліміт ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Папярэджанне па бюджэце',
    message: 'Бюджэт «{{budgetName}}» дасягнуў {{percentUsed}} % свайго ліміту',
  },
  'subscription.detected': {
    title: 'Выяўлены падпіскі',
    message: 'Знойдзены паўтаральныя плацяжы: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Хуткія спісанні па падпісках',
    message: 'Хутка спішуцца: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Хуткае спісанне па падпісцы',
    message: 'Хутка спішацца: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Парог рэгістрацыі ПДВ',
    message: 'Абарот дасягнуў {{percentUsed}} % парога рэгістрацыі {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Парог рэгістрацыі дасягнуты',
    message: 'Абарот дасягнуў парога рэгістрацыі {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Хутка тэрмін дэкларацыі па ПДВ за {{period}}',
    message: 'Дэкларацыю па ПДВ за {{period}} ({{range}}) трэба падаць да {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Пратэрмінавана дэкларацыя па ПДВ за {{period}}',
    message: 'Тэрмін быў {{dueDate}}, дэкларацыя не пададзена.',
  },
  'tax.deadline.income': {
    title: 'Дэкларацыя аб падатку на даходы хутка настане',
    message: '{{returnName}} за {{taxYear}} трэба падаць да {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Афіцыйныя стаўкі ПДВ адрозніваюцца ад вашых',
    message:
      'Афіцыйныя стаўкі ПДВ ({{country}}) адрозніваюцца ад вашых. Праверце іх у падатковых наладах.',
  },
};

const bs: TranslationMap = {
  'subscription.price_changed': {
    title: 'Cijena pretplate se promijenila',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} po terećenju, {{yearly}} godišnje)',
  },
  'review.waiting': {
    title: 'Stavke čekaju pregled',
    message: '{{count}} stavki čeka u sandučetu za pregled',
  },
  'note.mentioned': {
    title: 'Spomenuti ste u bilješci',
    message: '{{actorName}} vas je spomenuo: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Izvod je prenesen',
    message: '{{actorName}} je prenio izvod "{{statementName}}"',
  },
  'import.committed': {
    title: 'Uvoz je završen',
    message: '{{actorName}} je uvezao {{transactionCount}} transakcija',
  },
  'category.created': {
    title: 'Kategorija je napravljena',
    message: '{{actorName}} je napravio kategoriju "{{categoryName}}"',
  },
  'category.updated': {
    title: 'Kategorija je ažurirana',
    message: '{{actorName}} je ažurirao kategoriju "{{categoryName}}"',
  },
  'category.deleted': {
    title: 'Kategorija je izbrisana',
    message: '{{actorName}} je izbrisao kategoriju "{{categoryName}}"',
  },
  'member.invited': {
    title: 'Pozvan je novi član',
    message: '{{actorName}} je pozvao {{invitedEmail}}',
  },
  'member.joined': {
    title: 'Član se pridružio',
    message: '{{memberName}} se pridružio radnom prostoru',
  },
  'data.deleted': {
    title: 'Podaci su izbrisani',
    message: '{{actorName}} je izbrisao {{count}} zapisa',
  },
  'workspace.updated': {
    title: 'Postavke radnog prostora su ažurirane',
    message: '{{actorName}} je ažurirao postavke radnog prostora',
  },
  'parsing.error': {
    title: 'Greška obrade izvoda',
    message: 'Izvod nije moguće obraditi',
  },
  'parsing.error.named': {
    title: 'Greška obrade izvoda',
    message: 'Izvod "{{statementName}}" nije moguće obraditi',
  },
  'import.failed': {
    title: 'Uvoz nije uspio',
    message: 'Uvoz je završio greškom',
  },
  'import.failed.named': {
    title: 'Uvoz nije uspio',
    message: 'Uvoz izvoda "{{statementName}}" nije uspio',
  },
  'transactions.uncategorized': {
    title: 'Transakcije bez kategorije',
    message: '{{count}} transakcija treba kategoriju',
  },
  'receipt.uncategorized': {
    title: 'Račun bez kategorije',
    message: 'Nađen je račun bez kategorije',
  },
  'receipt.uncategorized.named': {
    title: 'Račun bez kategorije',
    message: 'Račun "{{receiptName}}" nema kategoriju',
  },
  'payable.marked_paid': {
    title: 'Obaveza označena kao plaćena',
    message: '{{vendor}} je označen kao plaćen',
  },
  'payable.overdue': {
    title: 'Dospjela obaveza',
    message: '{{vendor}}: {{amount}}, rok je bio {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Obaveza dospijeva uskoro',
    message: '{{vendor}}: {{amount}}, rok {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Budžet je prekoračen',
    message: 'Budžet "{{budgetName}}" prekoračio je svoje ograničenje ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Upozorenje budžeta',
    message: 'Budžet "{{budgetName}}" dosegao je {{percentUsed}} % svog ograničenja',
  },
  'subscription.detected': {
    title: 'Otkrivene pretplate',
    message: 'Nađena ponavljajuća plaćanja: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Predstojeće naplate pretplata',
    message: 'Uskoro se naplaćuje: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Predstojeća naplata pretplate',
    message: 'Uskoro se naplaćuje: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Prag za registraciju PDV-a',
    message: 'Promet je dosegao {{percentUsed}} % praga za registraciju {{threshold}} {{currency}}',
  },
  'tax.threshold.reached': {
    title: 'Prag za registraciju je dosegnut',
    message: 'Promet je dosegao prag za registraciju {{threshold}} {{currency}}',
  },
  'tax.deadline.vat': {
    title: 'Prijava PDV-a za {{period}} uskoro dospijeva',
    message: 'Prijava PDV-a za {{period}} ({{range}}) dospijeva {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'Prijava PDV-a za {{period}} je dospjela',
    message: 'Dospjela je {{dueDate}} i nije predana.',
  },
  'tax.deadline.income': {
    title: 'Porezna prijava uskoro dospijeva',
    message: '{{returnName}} za {{taxYear}} dospijeva {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Službene stope PDV-a razlikuju se od vaših',
    message:
      'Službene stope PDV-a ({{country}}) razlikuju se od vaših. Provjerite ih u poreznim postavkama.',
  },
};

const hsb: TranslationMap = {
  'subscription.price_changed': {
    title: 'Płaćizna abonementa je so změniła',
    message:
      '{{vendor}}: {{previous}} → {{current}} {{currency}} ({{delta}} na wotknihowanje, {{yearly}} wob lěto)',
  },
  'review.waiting': {
    title: 'Zapiski čakaja na přepruwowanje',
    message: '{{count}} zapiskow čaka w kašćiku za přepruwowanje',
  },
  'note.mentioned': {
    title: 'Sće so w notici naspomnjeli',
    message: '{{actorName}} je was naspomnił: {{excerpt}}',
  },
  'statement.uploaded': {
    title: 'Wupis je nahrate',
    message: '{{actorName}} je wupis "{{statementName}}" nahrał',
  },
  'import.committed': {
    title: 'Import je dokónčeny',
    message: '{{actorName}} je {{transactionCount}} transakcijow importował',
  },
  'category.created': {
    title: 'Kategorija je załožena',
    message: '{{actorName}} je kategoriju "{{categoryName}}" załožił',
  },
  'category.updated': {
    title: 'Kategorija je aktualizowana',
    message: '{{actorName}} je kategoriju "{{categoryName}}" aktualizował',
  },
  'category.deleted': {
    title: 'Kategorija je zhašana',
    message: '{{actorName}} je kategoriju "{{categoryName}}" zhašał',
  },
  'member.invited': {
    title: 'Nowy čłon je přeprošeny',
    message: '{{actorName}} je {{invitedEmail}} přeprosył',
  },
  'member.joined': {
    title: 'Čłon je so přizamknył',
    message: '{{memberName}} je so dźěłowemu rumej přizamknył',
  },
  'data.deleted': {
    title: 'Daty su zhašane',
    message: '{{actorName}} je {{count}} zapiskow zhašał',
  },
  'workspace.updated': {
    title: 'Nastajenja dźěłoweho ruma su aktualizowane',
    message: '{{actorName}} je nastajenja dźěłoweho ruma aktualizował',
  },
  'parsing.error': {
    title: 'Zmylk při analyzy wupisa',
    message: 'Wupis njeda so předźěłać',
  },
  'parsing.error.named': {
    title: 'Zmylk při analyzy wupisa',
    message: 'Wupis "{{statementName}}" njeda so předźěłać',
  },
  'import.failed': {
    title: 'Import je so njeporadźił',
    message: 'Import je so ze zmylkom skónčił',
  },
  'import.failed.named': {
    title: 'Import je so njeporadźił',
    message: 'Import wupisa "{{statementName}}" je so njeporadźił',
  },
  'transactions.uncategorized': {
    title: 'Transakcije bjez kategorije',
    message: '{{count}} transakcijow trjeba kategoriju',
  },
  'receipt.uncategorized': {
    title: 'Kwitancija bjez kategorije',
    message: 'Kwitancija bjez kategorije je namakana',
  },
  'receipt.uncategorized.named': {
    title: 'Kwitancija bjez kategorije',
    message: 'Kwitancija "{{receiptName}}" nima kategoriju',
  },
  'payable.marked_paid': {
    title: 'Dołh je jako zapłaćeny markowany',
    message: '{{vendor}} bu jako zapłaćeny markowany',
  },
  'payable.overdue': {
    title: 'Přepadnjeny dołh',
    message: '{{vendor}}: {{amount}}, termin bě {{dueDate}}',
  },
  'payable.due_soon': {
    title: 'Dołh bórze dospěje',
    message: '{{vendor}}: {{amount}}, termin {{dueDate}}',
  },
  'budget.exceeded': {
    title: 'Budget je překročeny',
    message: 'Budget "{{budgetName}}" je swój limit překročił ({{percentUsed}} %)',
  },
  'budget.warning': {
    title: 'Warnowanje budgeta',
    message: 'Budget "{{budgetName}}" je {{percentUsed}} % swojeho limita docpěł',
  },
  'subscription.detected': {
    title: 'Spóznate abonementy',
    message: 'Namakane wospjetowane zapłaćenja: {{vendors}}',
  },
  'subscription.upcoming': {
    title: 'Přichodne zapłaćenja abonementow',
    message: 'Bórze so wotknihuje: {{charges}}',
  },
  'subscription.upcoming.one': {
    title: 'Přichodne zapłaćenje abonementa',
    message: 'Bórze so wotknihuje: {{charges}}',
  },
  'tax.threshold.warning': {
    title: 'Prag registracije MwSt.',
    message: 'Wobrot je {{percentUsed}} % praga registracije {{threshold}} {{currency}} docpěł',
  },
  'tax.threshold.reached': {
    title: 'Prag registracije docpěty',
    message: 'Wobrot je prag registracije {{threshold}} {{currency}} docpěł',
  },
  'tax.deadline.vat': {
    title: 'MwSt.-přiznanje za {{period}} bórze dospěje',
    message: 'MwSt.-přiznanje za {{period}} ({{range}}) dospěje {{dueDate}}.',
  },
  'tax.deadline.vat.overdue': {
    title: 'MwSt.-přiznanje za {{period}} přepadnjene',
    message: 'Dyrbješe so {{dueDate}} podać a njeje podate.',
  },
  'tax.deadline.income': {
    title: 'Dochodowe přiznanje bórze dospěje',
    message: '{{returnName}} za {{taxYear}} dospěje {{dueDate}}',
  },
  'tax.rates.official': {
    title: 'Oficialne sadźby MwSt. so wot wašich rozeznawaja',
    message:
      'Oficialne sadźby MwSt. ({{country}}) so wot wašich rozeznawaja. Přepruwujće je w dawkowych nastajenjach.',
  },
};

export const NOTIFICATION_TRANSLATIONS: Record<string, TranslationMap> = {
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

export function renderNotification(
  locale: string,
  key: NotificationMessageKey,
  params: NotificationParams,
  now: Date = new Date(),
): { title: string; message: string } {
  const known = NOTIFICATION_TRANSLATIONS[locale] ? locale : 'en';
  const entry = NOTIFICATION_TRANSLATIONS[known][key];
  const interpolate = (template: string) =>
    template.replace(/\{\{(\w+)\}\}/g, (placeholder, k: string, at: number) => {
      const value = formatParam(params[k], known, now);
      // "due 12 окт." at the end of a sentence must not read "12 окт..".
      return template[at + placeholder.length] === '.' && value.endsWith('.')
        ? value.slice(0, -1)
        : value;
    });
  return { title: interpolate(entry.title), message: interpolate(entry.message) };
}
