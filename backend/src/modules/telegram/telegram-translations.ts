import { APP_NAME } from '../../common/brand';

/**
 * Message templates the Telegram bot sends, keyed by intent rather than
 * hardcoded per language. Mirrors insight-translations.ts /
 * notification-translations.ts: a key plus params, rendered in the
 * recipient's locale at send time.
 *
 * The recipient's locale comes from `User.locale` (their in-app language
 * choice) whenever a connected user is known. Before that — the very first
 * /start from someone we haven't matched to an account yet — there is no
 * stored preference, so callers fall back to Telegram's own
 * `message.from.language_code` and finally to 'ru'.
 */
export type TelegramMessageKey =
  | 'receipt_photo_received'
  | 'receipt_photo_done'
  | 'receipt_photo_unreadable'
  | 'receipt_photo_failed'
  | 'expense_text_done'
  | 'expense_text_unparsed'
  | 'expense_text_failed'
  | 'delete_button'
  | 'deleted'
  | 'delete_failed'
  | 'inbound_help'
  | 'connected'
  | 'start_greeting'
  | 'unknown_command'
  | 'telegram_id_unknown'
  | 'not_connected'
  | 'link_expired'
  | 'report_failed'
  | 'document_telegram_id_unknown'
  | 'document_pdf_only'
  | 'document_received'
  | 'document_processed'
  | 'document_failed'
  | 'help'
  | 'daily_header'
  | 'income_line'
  | 'expense_line'
  | 'daily_total'
  | 'top_income_header'
  | 'top_expense_header'
  | 'list_item'
  | 'monthly_header'
  | 'monthly_income'
  | 'monthly_expense'
  | 'monthly_diff'
  | 'top_categories_header'
  | 'category_item'
  | 'top_counterparties_header'
  | 'counterparty_item'
  | 'goals_header'
  | 'goals_empty'
  | 'goal_item'
  | 'networth_header'
  | 'networth_change_up'
  | 'networth_change_down'
  | 'networth_change_no_percent'
  | 'networth_risky_warning'
  | 'insight_digest_header';

type TranslationMap = Record<TelegramMessageKey, string>;

const ru: TranslationMap = {
  receipt_photo_received: '📷 Фото получено, распознаю чек…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Чек ждёт в разборе (статус: {{status}}).',
  receipt_photo_unreadable: '🧾 Чек сохранён, но сумму прочитать не удалось. Он ждёт в разборе.',
  receipt_photo_failed:
    'Не удалось обработать фото. Попробуйте ещё раз или загрузите через веб-приложение.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} записано. Категорию можно выбрать в разборе.',
  expense_text_unparsed: 'Не понял сумму. Напишите, например: «кофе 4.50» или «такси 1500 тг».',
  expense_text_failed: 'Не удалось записать расход. Попробуйте ещё раз.',
  delete_button: '🗑 Удалить',
  deleted: 'Удалено.',
  delete_failed: 'Не удалось удалить.',
  inbound_help:
    'Также можно:\n• прислать фото или картинку чека — я распознаю сумму и положу чек в разбор\n• написать расход текстом: «кофе 4.50», «такси 1500 тг»\n• прислать PDF выписки — она уйдёт на импорт',
  connected: '✅ Telegram подключен. Мы будем отправлять отчёты в этот чат.',
  link_expired: `⚠️ Ссылка устарела или уже использована. Нажмите «Подключить» в ${APP_NAME} ещё раз.`,
  start_greeting: `👋 Привет! Я бот ${APP_NAME}. Чтобы подключить этот чат, откройте в ${APP_NAME} Настройки → Уведомления и нажмите «Подключить» у Telegram.`,
  unknown_command: 'Неизвестная команда. Используйте /help для списка команд.',
  telegram_id_unknown: 'Не удалось определить ваш Telegram ID. Попробуйте позже.',
  not_connected: `Этот чат ещё не подключён к аккаунту ${APP_NAME}. Откройте в ${APP_NAME} Настройки → Уведомления и нажмите «Подключить» у Telegram.`,
  report_failed: 'Не удалось отправить отчёт. Попробуйте позже.',
  document_telegram_id_unknown:
    '⚠️ Не удалось определить ваш Telegram ID. Отправьте /start и повторите.',
  document_pdf_only: 'Поддерживаются только PDF-файлы выписок.',
  document_received: '📥 Файл получен, начинаем обработку...',
  document_processed: `✅ Файл принят и отправлен в обработку. Статус: {{status}}. Проверить результат можно в веб-интерфейсе ${APP_NAME}.`,
  document_failed:
    'Не удалось обработать файл. Попробуйте позже или загрузите через веб-интерфейс.',
  help: `Доступные команды:\n/start — как подключить этот чат к ${APP_NAME}\n/help — эта подсказка\n/report — ежедневный отчёт за сегодня\n/report YYYY-MM-DD — отчёт за указанную дату\n/report monthly — отчёт за текущий месяц\n/goals — прогресс по целям накоплений\n/networth — текущие чистые активы`,
  daily_header: '📅 Ежедневный отчёт — {{date}}',
  income_line: '➕ Приход: {{amount}} ({{count}})',
  expense_line: '➖ Расход: {{amount}} ({{count}})',
  daily_total: '📊 Итог дня: {{amount}}',
  top_income_header: 'Топ контрагентов по приходу:',
  top_expense_header: 'Топ категорий по расходу:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Отчёт за {{period}}',
  monthly_income: '➕ Приход: {{amount}}',
  monthly_expense: '➖ Расход: {{amount}}',
  monthly_diff: '📊 Разница: {{amount}} (операций: {{count}})',
  top_categories_header: 'Топ категорий расходов:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'Топ контрагентов:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 Цели накоплений',
  goals_empty: `Целей пока нет. Создайте цель в веб-интерфейсе ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 Чистые активы: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) за период',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) за период',
  networth_change_no_percent: 'Изменение за период: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}}% активов в среднем/высоком риске — выше порога {{threshold}}%',
  insight_digest_header: `🔔 Новое уведомление ${APP_NAME}`,
};

const en: TranslationMap = {
  receipt_photo_received: '📷 Photo received, reading the receipt…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. The receipt is waiting in the review inbox (status: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Receipt saved, but the amount could not be read. It is waiting in the review inbox.',
  receipt_photo_failed: 'Could not process the photo. Try again or upload it through the web app.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} recorded. Pick a category in the review inbox.',
  expense_text_unparsed:
    'I could not find an amount. Try something like “coffee 4.50” or “taxi 15 EUR”.',
  expense_text_failed: 'Could not record the expense. Please try again.',
  delete_button: '🗑 Delete',
  deleted: 'Deleted.',
  delete_failed: 'Could not delete.',
  inbound_help:
    'You can also:\n• send a photo or image of a receipt — I read the amount and put it in the review inbox\n• type an expense: “coffee 4.50”, “taxi 15 EUR”\n• send a PDF statement — it goes to import',
  connected: "✅ Telegram connected. We'll send reports to this chat.",
  link_expired: `⚠️ This link has expired or was already used. Press Connect in ${APP_NAME} again.`,
  start_greeting: `👋 Hi! I'm the ${APP_NAME} bot. To connect this chat, open Settings → Notifications in ${APP_NAME} and press Connect next to Telegram.`,
  unknown_command: 'Unknown command. Use /help to see the list of commands.',
  telegram_id_unknown: 'Could not determine your Telegram ID. Please try again later.',
  not_connected: `This chat isn't connected to a ${APP_NAME} account yet. Open Settings → Notifications in ${APP_NAME} and press Connect next to Telegram.`,
  report_failed: 'Could not send the report. Please try again later.',
  document_telegram_id_unknown:
    '⚠️ Could not determine your Telegram ID. Send /start and try again.',
  document_pdf_only: 'Only PDF statement files are supported.',
  document_received: '📥 File received, processing has started...',
  document_processed: `✅ File accepted and queued for processing. Status: {{status}}. Check the result in the ${APP_NAME} web app.`,
  document_failed:
    'Could not process the file. Please try again later or upload it through the web app.',
  help: `Available commands:\n/start — how to connect this chat to ${APP_NAME}\n/help — this help message\n/report — today's daily report\n/report YYYY-MM-DD — report for a specific date\n/report monthly — report for the current month\n/goals — progress on your savings goals\n/networth — your current net worth`,
  daily_header: '📅 Daily report — {{date}}',
  income_line: '➕ Income: {{amount}} ({{count}})',
  expense_line: '➖ Expense: {{amount}} ({{count}})',
  daily_total: '📊 Day total: {{amount}}',
  top_income_header: 'Top counterparties by income:',
  top_expense_header: 'Top expense categories:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Report for {{period}}',
  monthly_income: '➕ Income: {{amount}}',
  monthly_expense: '➖ Expense: {{amount}}',
  monthly_diff: '📊 Difference: {{amount}} ({{count}} transactions)',
  top_categories_header: 'Top expense categories:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'Top counterparties:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 Savings goals',
  goals_empty: `No goals yet. Create one in the ${APP_NAME} web app.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 Net worth: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) over the period',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) over the period',
  networth_change_no_percent: 'Change over the period: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}}% of assets are at medium/high risk — above the {{threshold}}% threshold',
  insight_digest_header: `🔔 New ${APP_NAME} alert`,
};

const kk: TranslationMap = {
  receipt_photo_received: '📷 Фото алынды, чекті оқып жатырмын…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Чек қарауда күтіп тұр (күйі: {{status}}).',
  receipt_photo_unreadable: '🧾 Чек сақталды, бірақ сома оқылмады. Ол қарауда күтіп тұр.',
  receipt_photo_failed:
    'Фотоны өңдеу мүмкін болмады. Қайталап көріңіз немесе веб-қосымша арқылы жүктеңіз.',
  expense_text_done: '✅ {{merchant}} — {{amount}} {{currency}} жазылды. Санатты қарауда таңдаңыз.',
  expense_text_unparsed: 'Соманы таба алмадым. Мысалы: «кофе 4.50» немесе «такси 1500 тг».',
  expense_text_failed: 'Шығынды жазу мүмкін болмады. Қайталап көріңіз.',
  delete_button: '🗑 Жою',
  deleted: 'Жойылды.',
  delete_failed: 'Жою мүмкін болмады.',
  inbound_help:
    'Сондай-ақ:\n• чектің фотосын жіберіңіз — соманы оқып, чекті қарауға қоямын\n• шығынды мәтінмен жазыңыз: «кофе 4.50», «такси 1500 тг»\n• PDF үзінді көшірме жіберіңіз — ол импортқа кетеді',
  connected: '✅ Telegram қосылды. Осы чатқа есептер жібереміз.',
  link_expired: `⚠️ Сілтеменің мерзімі өтті немесе ол бұрын пайдаланылған. ${APP_NAME}-да «Қосу» түймесін қайта басыңыз.`,
  start_greeting: `👋 Сәлем! Мен ${APP_NAME} ботымын. Осы чатты қосу үшін ${APP_NAME}-да Баптаулар → Хабарландырулар бөлімін ашып, Telegram жанындағы «Қосу» түймесін басыңыз.`,
  unknown_command: 'Белгісіз команда. Командалар тізімі үшін /help пайдаланыңыз.',
  telegram_id_unknown: 'Telegram ID-іңізді анықтау мүмкін болмады. Кейінірек қайталап көріңіз.',
  not_connected: `Бұл чат әлі ${APP_NAME} аккаунтына қосылмаған. ${APP_NAME}-да Баптаулар → Хабарландырулар бөлімін ашып, Telegram жанындағы «Қосу» түймесін басыңыз.`,
  report_failed: 'Есепті жіберу мүмкін болмады. Кейінірек қайталап көріңіз.',
  document_telegram_id_unknown:
    '⚠️ Telegram ID-іңізді анықтау мүмкін болмады. /start жіберіп, қайталаңыз.',
  document_pdf_only: 'Тек PDF үзінді файлдары қолдау көрсетіледі.',
  document_received: '📥 Файл алынды, өңдеу басталды...',
  document_processed: `✅ Файл қабылданды және өңдеуге жіберілді. Күйі: {{status}}. Нәтижені ${APP_NAME} веб-нұсқасында тексеруге болады.`,
  document_failed:
    'Файлды өңдеу мүмкін болмады. Кейінірек қайталаңыз немесе веб-нұсқа арқылы жүктеңіз.',
  help: `Қолжетімді командалар:\n/start — осы чатты ${APP_NAME}-ға қалай қосу керек\n/help — осы анықтама\n/report — бүгінгі күндік есеп\n/report YYYY-MM-DD — көрсетілген күнгі есеп\n/report monthly — ағымдағы айдың есебі\n/goals — жинақтау мақсаттары бойынша прогресс\n/networth — ағымдағы таза активтер`,
  daily_header: '📅 Күндік есеп — {{date}}',
  income_line: '➕ Кіріс: {{amount}} ({{count}})',
  expense_line: '➖ Шығыс: {{amount}} ({{count}})',
  daily_total: '📊 Күн қорытындысы: {{amount}}',
  top_income_header: 'Кіріс бойынша топ контрагенттер:',
  top_expense_header: 'Шығыс бойынша топ санаттар:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ {{period}} есебі',
  monthly_income: '➕ Кіріс: {{amount}}',
  monthly_expense: '➖ Шығыс: {{amount}}',
  monthly_diff: '📊 Айырма: {{amount}} (операциялар: {{count}})',
  top_categories_header: 'Шығыс санаттарының тізімі:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'Топ контрагенттер:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 Жинақтау мақсаттары',
  goals_empty: `Әзірге мақсат жоқ. ${APP_NAME} веб-нұсқасында мақсат жасаңыз.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 Таза активтер: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) кезең ішінде',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) кезең ішінде',
  networth_change_no_percent: 'Кезең ішіндегі өзгеріс: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ Активтердің {{percent}}%-ы орташа/жоғары тәуекелде — {{threshold}}% шегінен жоғары',
  insight_digest_header: `🔔 Жаңа ${APP_NAME} хабарламасы`,
};

const de: TranslationMap = {
  receipt_photo_received: '📷 Foto erhalten, Beleg wird gelesen…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Der Beleg wartet im Prüf-Posteingang (Status: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Beleg gespeichert, aber der Betrag war nicht lesbar. Er wartet im Prüf-Posteingang.',
  receipt_photo_failed:
    'Das Foto konnte nicht verarbeitet werden. Bitte erneut versuchen oder über die Web-App hochladen.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} erfasst. Die Kategorie wählen Sie im Prüf-Posteingang.',
  expense_text_unparsed:
    'Ich habe keinen Betrag gefunden. Versuchen Sie z. B. „Kaffee 4,50“ oder „Taxi 15 EUR“.',
  expense_text_failed: 'Die Ausgabe konnte nicht erfasst werden. Bitte erneut versuchen.',
  delete_button: '🗑 Löschen',
  deleted: 'Gelöscht.',
  delete_failed: 'Löschen fehlgeschlagen.',
  inbound_help:
    'Außerdem:\n• Foto oder Bild eines Belegs senden — ich lese den Betrag und lege ihn in den Prüf-Posteingang\n• Ausgabe als Text: „Kaffee 4,50“, „Taxi 15 EUR“\n• PDF-Kontoauszug senden — er geht in den Import',
  connected: '✅ Telegram verbunden. Wir senden Berichte an diesen Chat.',
  link_expired: `⚠️ Dieser Link ist abgelaufen oder wurde bereits verwendet. Klicken Sie in ${APP_NAME} erneut auf „Verbinden“.`,
  start_greeting: `👋 Hallo! Ich bin der ${APP_NAME}-Bot. Um diesen Chat zu verbinden, öffnen Sie in ${APP_NAME} Einstellungen → Benachrichtigungen und klicken Sie bei Telegram auf „Verbinden“.`,
  unknown_command: 'Unbekannter Befehl. Verwende /help für die Befehlsliste.',
  telegram_id_unknown:
    'Deine Telegram-ID konnte nicht ermittelt werden. Bitte versuche es später erneut.',
  not_connected: `Dieser Chat ist noch mit keinem ${APP_NAME}-Konto verbunden. Öffnen Sie in ${APP_NAME} Einstellungen → Benachrichtigungen und klicken Sie bei Telegram auf „Verbinden“.`,
  report_failed: 'Der Bericht konnte nicht gesendet werden. Bitte versuche es später erneut.',
  document_telegram_id_unknown:
    '⚠️ Deine Telegram-ID konnte nicht ermittelt werden. Sende /start und versuche es erneut.',
  document_pdf_only: 'Es werden nur PDF-Kontoauszüge unterstützt.',
  document_received: '📥 Datei empfangen, Verarbeitung hat begonnen...',
  document_processed: `✅ Datei akzeptiert und zur Verarbeitung eingereiht. Status: {{status}}. Das Ergebnis siehst du in der ${APP_NAME}-Web-App.`,
  document_failed:
    'Die Datei konnte nicht verarbeitet werden. Versuche es später erneut oder lade sie über die Web-App hoch.',
  help: `Verfügbare Befehle:\n/start — so verbinden Sie diesen Chat mit ${APP_NAME}\n/help — diese Hilfe\n/report — Tagesbericht für heute\n/report YYYY-MM-DD — Bericht für ein bestimmtes Datum\n/report monthly — Bericht für den aktuellen Monat\n/goals — Fortschritt deiner Sparziele\n/networth — dein aktuelles Nettovermögen`,
  daily_header: '📅 Tagesbericht — {{date}}',
  income_line: '➕ Eingang: {{amount}} ({{count}})',
  expense_line: '➖ Ausgang: {{amount}} ({{count}})',
  daily_total: '📊 Tagesbilanz: {{amount}}',
  top_income_header: 'Top-Kontrahenten nach Eingang:',
  top_expense_header: 'Top-Ausgabenkategorien:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Bericht für {{period}}',
  monthly_income: '➕ Eingang: {{amount}}',
  monthly_expense: '➖ Ausgang: {{amount}}',
  monthly_diff: '📊 Differenz: {{amount}} ({{count}} Transaktionen)',
  top_categories_header: 'Top-Ausgabenkategorien:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'Top-Kontrahenten:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 Sparziele',
  goals_empty: `Noch keine Ziele. Lege eines in der ${APP_NAME}-Web-App an.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 Nettovermögen: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) im Zeitraum',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) im Zeitraum',
  networth_change_no_percent: 'Änderung im Zeitraum: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}}% der Vermögenswerte sind mittleres/hohes Risiko — über der Grenze von {{threshold}}%',
  insight_digest_header: `🔔 Neuer ${APP_NAME}-Hinweis`,
};

const fr: TranslationMap = {
  receipt_photo_received: '📷 Photo reçue, lecture du reçu…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Le reçu attend dans la boîte de revue (statut : {{status}}).',
  receipt_photo_unreadable:
    '🧾 Reçu enregistré, mais le montant est illisible. Il attend dans la boîte de revue.',
  receipt_photo_failed:
    'Impossible de traiter la photo. Réessayez ou importez-la via l’application web.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} enregistré. Choisissez la catégorie dans la boîte de revue.',
  expense_text_unparsed: 'Je n’ai pas trouvé de montant. Essayez « café 4.50 » ou « taxi 15 EUR ».',
  expense_text_failed: 'Impossible d’enregistrer la dépense. Réessayez.',
  delete_button: '🗑 Supprimer',
  deleted: 'Supprimé.',
  delete_failed: 'Suppression impossible.',
  inbound_help:
    'Vous pouvez aussi :\n• envoyer une photo d’un reçu — je lis le montant et le place dans la boîte de revue\n• écrire une dépense : « café 4.50 », « taxi 15 EUR »\n• envoyer un relevé PDF — il part à l’import',
  connected: '✅ Telegram connecté. Nous enverrons les rapports dans ce chat.',
  link_expired: `⚠️ Ce lien a expiré ou a déjà été utilisé. Cliquez de nouveau sur « Connecter » dans ${APP_NAME}.`,
  start_greeting: `👋 Bonjour ! Je suis le bot ${APP_NAME}. Pour connecter ce chat, ouvrez Paramètres → Notifications dans ${APP_NAME} et cliquez sur « Connecter » à côté de Telegram.`,
  unknown_command: 'Commande inconnue. Utilisez /help pour voir la liste des commandes.',
  telegram_id_unknown: 'Impossible de déterminer votre ID Telegram. Réessayez plus tard.',
  not_connected: `Ce chat n'est encore lié à aucun compte ${APP_NAME}. Ouvrez Paramètres → Notifications dans ${APP_NAME} et cliquez sur « Connecter » à côté de Telegram.`,
  report_failed: "Impossible d'envoyer le rapport. Réessayez plus tard.",
  document_telegram_id_unknown:
    '⚠️ Impossible de déterminer votre ID Telegram. Envoyez /start et réessayez.',
  document_pdf_only: 'Seuls les fichiers de relevé PDF sont pris en charge.',
  document_received: '📥 Fichier reçu, le traitement a commencé...',
  document_processed: `✅ Fichier accepté et mis en file d'attente. Statut : {{status}}. Consultez le résultat dans l'application web ${APP_NAME}.`,
  document_failed:
    "Impossible de traiter le fichier. Réessayez plus tard ou téléversez-le via l'application web.",
  help: `Commandes disponibles :\n/start — comment connecter ce chat à ${APP_NAME}\n/help — cette aide\n/report — rapport quotidien du jour\n/report YYYY-MM-DD — rapport pour une date précise\n/report monthly — rapport du mois en cours\n/goals — progression de vos objectifs d'épargne\n/networth — votre valeur nette actuelle`,
  daily_header: '📅 Rapport quotidien — {{date}}',
  income_line: '➕ Entrées : {{amount}} ({{count}})',
  expense_line: '➖ Sorties : {{amount}} ({{count}})',
  daily_total: '📊 Total du jour : {{amount}}',
  top_income_header: 'Meilleurs contreparties par entrées :',
  top_expense_header: 'Principales catégories de dépenses :',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Rapport pour {{period}}',
  monthly_income: '➕ Entrées : {{amount}}',
  monthly_expense: '➖ Sorties : {{amount}}',
  monthly_diff: '📊 Différence : {{amount}} ({{count}} opérations)',
  top_categories_header: 'Principales catégories de dépenses :',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Meilleures contreparties :',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: "🎯 Objectifs d'épargne",
  goals_empty: `Aucun objectif pour l'instant. Créez-en un dans l'application web ${APP_NAME}.`,
  goal_item: '{{name}} : {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Valeur nette : {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) sur la période',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) sur la période',
  networth_change_no_percent: 'Variation sur la période : {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}}% des actifs sont à risque moyen/élevé — au-delà du seuil de {{threshold}}%',
  insight_digest_header: `🔔 Nouvelle alerte ${APP_NAME}`,
};

const es: TranslationMap = {
  receipt_photo_received: '📷 Foto recibida, leyendo el recibo…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. El recibo espera en la bandeja de revisión (estado: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Recibo guardado, pero no se pudo leer el importe. Espera en la bandeja de revisión.',
  receipt_photo_failed:
    'No se pudo procesar la foto. Inténtalo de nuevo o súbela desde la app web.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} registrado. Elige la categoría en la bandeja de revisión.',
  expense_text_unparsed: 'No encontré un importe. Prueba con «café 4.50» o «taxi 15 EUR».',
  expense_text_failed: 'No se pudo registrar el gasto. Inténtalo de nuevo.',
  delete_button: '🗑 Eliminar',
  deleted: 'Eliminado.',
  delete_failed: 'No se pudo eliminar.',
  inbound_help:
    'También puedes:\n• enviar una foto de un recibo: leo el importe y lo pongo en la bandeja de revisión\n• escribir un gasto: «café 4.50», «taxi 15 EUR»\n• enviar un extracto PDF: va a importación',
  connected: '✅ Telegram conectado. Enviaremos los informes a este chat.',
  link_expired: `⚠️ Este enlace ha caducado o ya se ha usado. Pulsa «Conectar» en ${APP_NAME} otra vez.`,
  start_greeting: `👋 ¡Hola! Soy el bot de ${APP_NAME}. Para conectar este chat, abre Configuración → Notificaciones en ${APP_NAME} y pulsa «Conectar» junto a Telegram.`,
  unknown_command: 'Comando desconocido. Usa /help para ver la lista de comandos.',
  telegram_id_unknown: 'No se pudo determinar tu ID de Telegram. Inténtalo de nuevo más tarde.',
  not_connected: `Este chat aún no está conectado a una cuenta de ${APP_NAME}. Abre Configuración → Notificaciones en ${APP_NAME} y pulsa «Conectar» junto a Telegram.`,
  report_failed: 'No se pudo enviar el informe. Inténtalo de nuevo más tarde.',
  document_telegram_id_unknown:
    '⚠️ No se pudo determinar tu ID de Telegram. Envía /start e inténtalo de nuevo.',
  document_pdf_only: 'Solo se admiten archivos de extracto en PDF.',
  document_received: '📥 Archivo recibido, el procesamiento ha comenzado...',
  document_processed: `✅ Archivo aceptado y en cola de procesamiento. Estado: {{status}}. Revisa el resultado en la aplicación web de ${APP_NAME}.`,
  document_failed:
    'No se pudo procesar el archivo. Inténtalo de nuevo más tarde o súbelo desde la aplicación web.',
  help: `Comandos disponibles:\n/start — cómo conectar este chat a ${APP_NAME}\n/help — esta ayuda\n/report — informe diario de hoy\n/report YYYY-MM-DD — informe de una fecha concreta\n/report monthly — informe del mes actual\n/goals — progreso de tus metas de ahorro\n/networth — tu patrimonio neto actual`,
  daily_header: '📅 Informe diario — {{date}}',
  income_line: '➕ Ingresos: {{amount}} ({{count}})',
  expense_line: '➖ Gastos: {{amount}} ({{count}})',
  daily_total: '📊 Total del día: {{amount}}',
  top_income_header: 'Principales contrapartes por ingresos:',
  top_expense_header: 'Principales categorías de gasto:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Informe de {{period}}',
  monthly_income: '➕ Ingresos: {{amount}}',
  monthly_expense: '➖ Gastos: {{amount}}',
  monthly_diff: '📊 Diferencia: {{amount}} ({{count}} operaciones)',
  top_categories_header: 'Principales categorías de gasto:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'Principales contrapartes:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 Metas de ahorro',
  goals_empty: `Aún no hay metas. Crea una en la aplicación web de ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 Patrimonio neto: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) en el periodo',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) en el periodo',
  networth_change_no_percent: 'Cambio en el periodo: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ El {{percent}}% de los activos está en riesgo medio/alto — por encima del umbral del {{threshold}}%',
  insight_digest_header: `🔔 Nueva alerta de ${APP_NAME}`,
};

const pt: TranslationMap = {
  receipt_photo_received: '📷 Foto recebida, a ler o recibo…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. O recibo aguarda na caixa de revisão (estado: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Recibo guardado, mas não foi possível ler o valor. Aguarda na caixa de revisão.',
  receipt_photo_failed:
    'Não foi possível processar a foto. Tente novamente ou carregue pela app web.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} registado. Escolha a categoria na caixa de revisão.',
  expense_text_unparsed: 'Não encontrei um valor. Tente «café 4.50» ou «táxi 15 EUR».',
  expense_text_failed: 'Não foi possível registar a despesa. Tente novamente.',
  delete_button: '🗑 Eliminar',
  deleted: 'Eliminado.',
  delete_failed: 'Não foi possível eliminar.',
  inbound_help:
    'Também pode:\n• enviar uma foto de um recibo — leio o valor e coloco-o na caixa de revisão\n• escrever uma despesa: «café 4.50», «táxi 15 EUR»\n• enviar um extrato PDF — vai para importação',
  connected: '✅ Telegram conectado. Enviaremos os relatórios para este chat.',
  link_expired: `⚠️ Este link expirou ou já foi usado. Toque em «Conectar» no ${APP_NAME} novamente.`,
  start_greeting: `👋 Olá! Sou o bot do ${APP_NAME}. Para conectar este chat, abra Configurações → Notificações no ${APP_NAME} e toque em «Conectar» ao lado do Telegram.`,
  unknown_command: 'Comando desconhecido. Use /help para ver a lista de comandos.',
  telegram_id_unknown:
    'Não foi possível determinar o seu ID do Telegram. Tente novamente mais tarde.',
  not_connected: `Este chat ainda não está conectado a uma conta do ${APP_NAME}. Abra Configurações → Notificações no ${APP_NAME} e toque em «Conectar» ao lado do Telegram.`,
  report_failed: 'Não foi possível enviar o relatório. Tente novamente mais tarde.',
  document_telegram_id_unknown:
    '⚠️ Não foi possível determinar o seu ID do Telegram. Envie /start e tente novamente.',
  document_pdf_only: 'Apenas ficheiros PDF de extrato são suportados.',
  document_received: '📥 Ficheiro recebido, o processamento começou...',
  document_processed: `✅ Ficheiro aceite e na fila de processamento. Estado: {{status}}. Verifique o resultado na aplicação web do ${APP_NAME}.`,
  document_failed:
    'Não foi possível processar o ficheiro. Tente novamente mais tarde ou carregue-o através da aplicação web.',
  help: `Comandos disponíveis:\n/start — como conectar este chat ao ${APP_NAME}\n/help — esta ajuda\n/report — relatório diário de hoje\n/report YYYY-MM-DD — relatório de uma data específica\n/report monthly — relatório do mês atual\n/goals — progresso das suas metas de poupança\n/networth — o seu património líquido atual`,
  daily_header: '📅 Relatório diário — {{date}}',
  income_line: '➕ Receitas: {{amount}} ({{count}})',
  expense_line: '➖ Despesas: {{amount}} ({{count}})',
  daily_total: '📊 Total do dia: {{amount}}',
  top_income_header: 'Principais contrapartes por receita:',
  top_expense_header: 'Principais categorias de despesa:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Relatório de {{period}}',
  monthly_income: '➕ Receitas: {{amount}}',
  monthly_expense: '➖ Despesas: {{amount}}',
  monthly_diff: '📊 Diferença: {{amount}} ({{count}} operações)',
  top_categories_header: 'Principais categorias de despesa:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'Principais contrapartes:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 Objetivos de poupança',
  goals_empty: `Ainda sem objetivos. Crie um na aplicação web do ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 Património líquido: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) no período',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) no período',
  networth_change_no_percent: 'Variação no período: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}}% dos ativos estão em risco médio/alto — acima do limite de {{threshold}}%',
  insight_digest_header: `🔔 Novo alerta do ${APP_NAME}`,
};

const tr: TranslationMap = {
  receipt_photo_received: '📷 Fotoğraf alındı, fiş okunuyor…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Fiş inceleme gelen kutusunda bekliyor (durum: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Fiş kaydedildi ama tutar okunamadı. İnceleme gelen kutusunda bekliyor.',
  receipt_photo_failed: 'Fotoğraf işlenemedi. Tekrar deneyin veya web uygulamasından yükleyin.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} kaydedildi. Kategoriyi inceleme gelen kutusunda seçin.',
  expense_text_unparsed: 'Tutar bulamadım. Örneğin “kahve 4.50” veya “taksi 15 EUR” yazın.',
  expense_text_failed: 'Harcama kaydedilemedi. Tekrar deneyin.',
  delete_button: '🗑 Sil',
  deleted: 'Silindi.',
  delete_failed: 'Silinemedi.',
  inbound_help:
    'Ayrıca:\n• bir fişin fotoğrafını gönderin — tutarı okuyup inceleme gelen kutusuna koyarım\n• harcamayı yazın: “kahve 4.50”, “taksi 15 EUR”\n• PDF ekstre gönderin — içe aktarmaya gider',
  connected: '✅ Telegram bağlandı. Raporları bu sohbete göndereceğiz.',
  link_expired: `⚠️ Bu bağlantının süresi doldu veya zaten kullanıldı. ${APP_NAME}'da «Bağla»ya yeniden basın.`,
  start_greeting: `👋 Merhaba! Ben ${APP_NAME} botuyum. Bu sohbeti bağlamak için ${APP_NAME}'da Ayarlar → Bildirimler'i açın ve Telegram'ın yanındaki «Bağla»ya basın.`,
  unknown_command: 'Bilinmeyen komut. Komut listesi için /help kullanın.',
  telegram_id_unknown: "Telegram ID'niz belirlenemedi. Lütfen daha sonra tekrar deneyin.",
  not_connected: `Bu sohbet henüz bir ${APP_NAME} hesabına bağlı değil. ${APP_NAME}'da Ayarlar → Bildirimler'i açın ve Telegram'ın yanındaki «Bağla»ya basın.`,
  report_failed: 'Rapor gönderilemedi. Lütfen daha sonra tekrar deneyin.',
  document_telegram_id_unknown: "⚠️ Telegram ID'niz belirlenemedi. /start gönderip tekrar deneyin.",
  document_pdf_only: 'Yalnızca PDF ekstre dosyaları desteklenir.',
  document_received: '📥 Dosya alındı, işleme başladı...',
  document_processed: `✅ Dosya kabul edildi ve işleme alındı. Durum: {{status}}. Sonucu ${APP_NAME} web uygulamasında kontrol edebilirsiniz.`,
  document_failed:
    'Dosya işlenemedi. Lütfen daha sonra tekrar deneyin veya web uygulamasından yükleyin.',
  help: `Kullanılabilir komutlar:\n/start — bu sohbet ${APP_NAME}'ya nasıl bağlanır\n/help — bu yardım\n/report — bugünün günlük raporu\n/report YYYY-MM-DD — belirli bir tarihin raporu\n/report monthly — geçerli ayın raporu\n/goals — birikim hedeflerinizdeki ilerleme\n/networth — güncel net değeriniz`,
  daily_header: '📅 Günlük rapor — {{date}}',
  income_line: '➕ Gelir: {{amount}} ({{count}})',
  expense_line: '➖ Gider: {{amount}} ({{count}})',
  daily_total: '📊 Gün toplamı: {{amount}}',
  top_income_header: 'Gelire göre en iyi karşı taraflar:',
  top_expense_header: 'En yüksek gider kategorileri:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ {{period}} raporu',
  monthly_income: '➕ Gelir: {{amount}}',
  monthly_expense: '➖ Gider: {{amount}}',
  monthly_diff: '📊 Fark: {{amount}} ({{count}} işlem)',
  top_categories_header: 'En yüksek gider kategorileri:',
  category_item: '{{index}}. {{name}} — {{amount}} (%{{percent}})',
  top_counterparties_header: 'En iyi karşı taraflar:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} (%{{percent}})',
  goals_header: '🎯 Birikim hedefleri',
  goals_empty: `Henüz hedef yok. ${APP_NAME} web uygulamasında bir tane oluşturun.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} (%{{percent}})',
  networth_header: '📈 Net değer: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+%{{percent}}) dönem içinde',
  networth_change_down: '▼ {{amount}} {{currency}} (%{{percent}}) dönem içinde',
  networth_change_no_percent: 'Dönem içindeki değişim: {{amount}} {{currency}}',
  networth_risky_warning:
    "⚠️ Varlıkların %{{percent}}'i orta/yüksek riskte — %{{threshold}} eşiğinin üzerinde",
  insight_digest_header: `🔔 Yeni ${APP_NAME} uyarısı`,
};

const uk: TranslationMap = {
  receipt_photo_received: '📷 Фото отримано, розпізнаю чек…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Чек чекає в розборі (статус: {{status}}).',
  receipt_photo_unreadable: '🧾 Чек збережено, але суму прочитати не вдалося. Він чекає в розборі.',
  receipt_photo_failed:
    'Не вдалося обробити фото. Спробуйте ще раз або завантажте через вебзастосунок.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} записано. Категорію можна вибрати в розборі.',
  expense_text_unparsed: 'Не зрозумів суму. Напишіть, наприклад: «кава 4.50» або «таксі 15 EUR».',
  expense_text_failed: 'Не вдалося записати витрату. Спробуйте ще раз.',
  delete_button: '🗑 Видалити',
  deleted: 'Видалено.',
  delete_failed: 'Не вдалося видалити.',
  inbound_help:
    'Також можна:\n• надіслати фото чека — я розпізнаю суму й покладу чек у розбір\n• написати витрату текстом: «кава 4.50», «таксі 15 EUR»\n• надіслати PDF виписки — вона піде на імпорт',
  connected: '✅ Telegram підключено. Надсилатимемо звіти в цей чат.',
  link_expired: `⚠️ Посилання застаріло або вже використане. Натисніть «Підключити» в ${APP_NAME} ще раз.`,
  start_greeting: `👋 Привіт! Я бот ${APP_NAME}. Щоб підключити цей чат, відкрийте в ${APP_NAME} Налаштування → Сповіщення й натисніть «Підключити» біля Telegram.`,
  unknown_command: 'Невідома команда. Використайте /help для списку команд.',
  telegram_id_unknown: 'Не вдалося визначити ваш Telegram ID. Спробуйте пізніше.',
  not_connected: `Цей чат ще не підключено до облікового запису ${APP_NAME}. Відкрийте в ${APP_NAME} Налаштування → Сповіщення й натисніть «Підключити» біля Telegram.`,
  report_failed: 'Не вдалося надіслати звіт. Спробуйте пізніше.',
  document_telegram_id_unknown:
    '⚠️ Не вдалося визначити ваш Telegram ID. Надішліть /start і спробуйте ще раз.',
  document_pdf_only: 'Підтримуються лише PDF-файли виписок.',
  document_received: '📥 Файл отримано, обробку розпочато...',
  document_processed: `✅ Файл прийнято та надіслано на обробку. Статус: {{status}}. Перевірити результат можна у веб-додатку ${APP_NAME}.`,
  document_failed: 'Не вдалося обробити файл. Спробуйте пізніше або завантажте через веб-додаток.',
  help: `Доступні команди:\n/start — як підключити цей чат до ${APP_NAME}\n/help — ця довідка\n/report — щоденний звіт за сьогодні\n/report YYYY-MM-DD — звіт за вказану дату\n/report monthly — звіт за поточний місяць\n/goals — прогрес за цілями накопичень\n/networth — поточні чисті активи`,
  daily_header: '📅 Щоденний звіт — {{date}}',
  income_line: '➕ Надходження: {{amount}} ({{count}})',
  expense_line: '➖ Витрати: {{amount}} ({{count}})',
  daily_total: '📊 Підсумок дня: {{amount}}',
  top_income_header: 'Топ контрагентів за надходженнями:',
  top_expense_header: 'Топ категорій витрат:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Звіт за {{period}}',
  monthly_income: '➕ Надходження: {{amount}}',
  monthly_expense: '➖ Витрати: {{amount}}',
  monthly_diff: '📊 Різниця: {{amount}} (операцій: {{count}})',
  top_categories_header: 'Топ категорій витрат:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'Топ контрагентів:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 Цілі накопичень',
  goals_empty: `Цілей поки немає. Створіть ціль у веб-додатку ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 Чисті активи: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) за період',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) за період',
  networth_change_no_percent: 'Зміна за період: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}}% активів у середньому/високому ризику — понад поріг {{threshold}}%',
  insight_digest_header: `🔔 Нове сповіщення ${APP_NAME}`,
};

const zh: TranslationMap = {
  receipt_photo_received: '📷 已收到照片，正在识别收据…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}。收据已进入审核收件箱（状态：{{status}}）。',
  receipt_photo_unreadable: '🧾 收据已保存，但无法读取金额。它在审核收件箱中等待。',
  receipt_photo_failed: '无法处理照片。请重试或通过网页应用上传。',
  expense_text_done: '✅ 已记录 {{merchant}} — {{amount}} {{currency}}。请在审核收件箱中选择类别。',
  expense_text_unparsed: '没有找到金额。试试“咖啡 4.50”或“出租车 15 EUR”。',
  expense_text_failed: '无法记录支出，请重试。',
  delete_button: '🗑 删除',
  deleted: '已删除。',
  delete_failed: '无法删除。',
  inbound_help:
    '您还可以：\n• 发送收据照片 — 我会识别金额并放入审核收件箱\n• 用文字记录支出：“咖啡 4.50”、“出租车 15 EUR”\n• 发送 PDF 对账单 — 将进入导入',
  connected: '✅ Telegram 已连接。我们会将报告发送到此聊天。',
  link_expired: `⚠️ 此链接已过期或已被使用。请在 ${APP_NAME} 中再次点击“连接”。`,
  start_greeting: `👋 你好！我是 ${APP_NAME} 机器人。要连接此聊天，请在 ${APP_NAME} 中打开 设置 → 通知，然后点击 Telegram 旁的“连接”。`,
  unknown_command: '未知命令。使用 /help 查看命令列表。',
  telegram_id_unknown: '无法确定你的 Telegram ID。请稍后再试。',
  not_connected: `此聊天尚未连接到 ${APP_NAME} 账户。请在 ${APP_NAME} 中打开 设置 → 通知，然后点击 Telegram 旁的“连接”。`,
  report_failed: '无法发送报告。请稍后再试。',
  document_telegram_id_unknown: '⚠️ 无法确定你的 Telegram ID。请发送 /start 后重试。',
  document_pdf_only: '仅支持 PDF 格式的对账单文件。',
  document_received: '📥 已收到文件，正在开始处理……',
  document_processed: `✅ 文件已接受并加入处理队列。状态：{{status}}。可在 ${APP_NAME} 网页应用中查看结果。`,
  document_failed: '无法处理该文件。请稍后重试，或通过网页应用上传。',
  help: `可用命令：\n/start — 如何将此聊天连接到 ${APP_NAME}\n/help — 本帮助信息\n/report — 今日的每日报告\n/report YYYY-MM-DD — 指定日期的报告\n/report monthly — 本月报告\n/goals — 储蓄目标进度\n/networth — 当前净资产`,
  daily_header: '📅 每日报告 — {{date}}',
  income_line: '➕ 收入：{{amount}}（{{count}}）',
  expense_line: '➖ 支出：{{amount}}（{{count}}）',
  daily_total: '📊 当日合计：{{amount}}',
  top_income_header: '按收入排名的主要往来方：',
  top_expense_header: '主要支出类别：',
  list_item: '{{index}}. {{name}} — {{amount}}（{{count}}）',
  monthly_header: '🗓️ {{period}} 报告',
  monthly_income: '➕ 收入：{{amount}}',
  monthly_expense: '➖ 支出：{{amount}}',
  monthly_diff: '📊 差额：{{amount}}（{{count}} 笔交易）',
  top_categories_header: '支出类别排行：',
  category_item: '{{index}}. {{name}} — {{amount}}（{{percent}}%）',
  top_counterparties_header: '主要往来方：',
  counterparty_item: '{{index}}. {{name}} — {{amount}}（{{percent}}%）',
  goals_header: '🎯 储蓄目标',
  goals_empty: `还没有目标。请在 ${APP_NAME} 网页应用中创建一个。`,
  goal_item: '{{name}}：{{current}} / {{target}} {{currency}}（{{percent}}%）',
  networth_header: '📈 净资产：{{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}}（+{{percent}}%）本期',
  networth_change_down: '▼ {{amount}} {{currency}}（{{percent}}%）本期',
  networth_change_no_percent: '本期变化：{{amount}} {{currency}}',
  networth_risky_warning: '⚠️ {{percent}}% 的资产处于中/高风险 — 超过 {{threshold}}% 的阈值',
  insight_digest_header: `🔔 ${APP_NAME} 新提醒`,
};

const pl: TranslationMap = {
  receipt_photo_received: '📷 Zdjęcie odebrane, odczytuję paragon…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Paragon czeka w skrzynce przeglądu (status: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Paragon zapisany, ale nie udało się odczytać kwoty. Czeka w skrzynce przeglądu.',
  receipt_photo_failed:
    'Nie udało się przetworzyć zdjęcia. Spróbuj ponownie lub prześlij przez aplikację web.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} zapisane. Kategorię wybierz w skrzynce przeglądu.',
  expense_text_unparsed: 'Nie znalazłem kwoty. Spróbuj np. „kawa 4.50” lub „taxi 15 EUR”.',
  expense_text_failed: 'Nie udało się zapisać wydatku. Spróbuj ponownie.',
  delete_button: '🗑 Usuń',
  deleted: 'Usunięto.',
  delete_failed: 'Nie udało się usunąć.',
  inbound_help:
    'Możesz też:\n• wysłać zdjęcie paragonu — odczytam kwotę i umieszczę go w skrzynce przeglądu\n• wpisać wydatek: „kawa 4.50”, „taxi 15 EUR”\n• wysłać wyciąg PDF — trafi do importu',
  connected: '✅ Telegram połączony. Będziemy wysyłać raporty na ten czat.',
  link_expired: `⚠️ Ten link wygasł lub został już użyty. Kliknij ponownie „Połącz” w ${APP_NAME}.`,
  start_greeting: `👋 Cześć! Jestem botem ${APP_NAME}. Aby połączyć ten czat, otwórz w ${APP_NAME} Ustawienia → Powiadomienia i kliknij „Połącz” przy Telegramie.`,
  unknown_command: 'Nieznane polecenie. Użyj /help, aby zobaczyć listę poleceń.',
  telegram_id_unknown: 'Nie udało się ustalić Twojego Telegram ID. Spróbuj ponownie później.',
  not_connected: `Ten czat nie jest jeszcze połączony z kontem ${APP_NAME}. Otwórz w ${APP_NAME} Ustawienia → Powiadomienia i kliknij „Połącz” przy Telegramie.`,
  report_failed: 'Nie udało się wysłać raportu. Spróbuj ponownie później.',
  document_telegram_id_unknown:
    '⚠️ Nie udało się ustalić Twojego Telegram ID. Wyślij /start i spróbuj ponownie.',
  document_pdf_only: 'Obsługiwane są tylko pliki wyciągów w formacie PDF.',
  document_received: '📥 Plik otrzymany, rozpoczęto przetwarzanie...',
  document_processed: `✅ Plik zaakceptowany i skierowany do przetwarzania. Status: {{status}}. Wynik sprawdzisz w aplikacji webowej ${APP_NAME}.`,
  document_failed:
    'Nie udało się przetworzyć pliku. Spróbuj ponownie później lub prześlij go przez aplikację webową.',
  help: `Dostępne polecenia:\n/start — jak połączyć ten czat z ${APP_NAME}\n/help — ta pomoc\n/report — dzienny raport na dziś\n/report YYYY-MM-DD — raport za wskazaną datę\n/report monthly — raport za bieżący miesiąc\n/goals — postęp celów oszczędnościowych\n/networth — Twoja aktualna wartość netto`,
  daily_header: '📅 Raport dzienny — {{date}}',
  income_line: '➕ Przychód: {{amount}} ({{count}})',
  expense_line: '➖ Wydatki: {{amount}} ({{count}})',
  daily_total: '📊 Podsumowanie dnia: {{amount}}',
  top_income_header: 'Najlepsi kontrahenci wg przychodu:',
  top_expense_header: 'Najlepsze kategorie wydatków:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Raport za {{period}}',
  monthly_income: '➕ Przychód: {{amount}}',
  monthly_expense: '➖ Wydatki: {{amount}}',
  monthly_diff: '📊 Różnica: {{amount}} ({{count}} operacji)',
  top_categories_header: 'Najlepsze kategorie wydatków:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'Najlepsi kontrahenci:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 Cele oszczędnościowe',
  goals_empty: `Brak celów. Utwórz jeden w aplikacji webowej ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 Wartość netto: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) w tym okresie',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) w tym okresie',
  networth_change_no_percent: 'Zmiana w okresie: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}}% aktywów jest w średnim/wysokim ryzyku — powyżej progu {{threshold}}%',
  insight_digest_header: `🔔 Nowy alert ${APP_NAME}`,
};

const it: TranslationMap = {
  receipt_photo_received: '📷 Foto ricevuta, leggo lo scontrino…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Lo scontrino attende nella posta di revisione (stato: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Scontrino salvato, ma l’importo non è leggibile. Attende nella posta di revisione.',
  receipt_photo_failed: 'Impossibile elaborare la foto. Riprova o caricala dall’app web.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} registrato. Scegli la categoria nella posta di revisione.',
  expense_text_unparsed: 'Non ho trovato un importo. Prova con “caffè 4.50” o “taxi 15 EUR”.',
  expense_text_failed: 'Impossibile registrare la spesa. Riprova.',
  delete_button: '🗑 Elimina',
  deleted: 'Eliminato.',
  delete_failed: 'Impossibile eliminare.',
  inbound_help:
    'Puoi anche:\n• inviare la foto di uno scontrino — leggo l’importo e lo metto nella posta di revisione\n• scrivere una spesa: “caffè 4.50”, “taxi 15 EUR”\n• inviare un estratto PDF — va all’importazione',
  connected: '✅ Telegram collegato. Invieremo i report in questa chat.',
  link_expired: `⚠️ Questo link è scaduto o è già stato usato. Premi di nuovo «Collega» in ${APP_NAME}.`,
  start_greeting: `👋 Ciao! Sono il bot di ${APP_NAME}. Per collegare questa chat, apri Impostazioni → Notifiche in ${APP_NAME} e premi «Collega» accanto a Telegram.`,
  unknown_command: "Comando sconosciuto. Usa /help per l'elenco dei comandi.",
  telegram_id_unknown: 'Impossibile determinare il tuo ID Telegram. Riprova più tardi.',
  not_connected: `Questa chat non è ancora collegata a un account ${APP_NAME}. Apri Impostazioni → Notifiche in ${APP_NAME} e premi «Collega» accanto a Telegram.`,
  report_failed: 'Impossibile inviare il report. Riprova più tardi.',
  document_telegram_id_unknown:
    '⚠️ Impossibile determinare il tuo ID Telegram. Invia /start e riprova.',
  document_pdf_only: 'Sono supportati solo i file PDF degli estratti conto.',
  document_received: '📥 File ricevuto, elaborazione avviata...',
  document_processed: `✅ File accettato e messo in coda per l'elaborazione. Stato: {{status}}. Controlla il risultato nell'app web di ${APP_NAME}.`,
  document_failed:
    "Impossibile elaborare il file. Riprova più tardi oppure caricalo tramite l'app web.",
  help: `Comandi disponibili:\n/start — come collegare questa chat a ${APP_NAME}\n/help — questo aiuto\n/report — report giornaliero di oggi\n/report YYYY-MM-DD — report per una data specifica\n/report monthly — report del mese corrente\n/goals — avanzamento dei tuoi obiettivi di risparmio\n/networth — il tuo patrimonio netto attuale`,
  daily_header: '📅 Report giornaliero — {{date}}',
  income_line: '➕ Entrate: {{amount}} ({{count}})',
  expense_line: '➖ Uscite: {{amount}} ({{count}})',
  daily_total: '📊 Totale giornaliero: {{amount}}',
  top_income_header: 'Migliori controparti per entrate:',
  top_expense_header: 'Principali categorie di spesa:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Report di {{period}}',
  monthly_income: '➕ Entrate: {{amount}}',
  monthly_expense: '➖ Uscite: {{amount}}',
  monthly_diff: '📊 Differenza: {{amount}} ({{count}} operazioni)',
  top_categories_header: 'Principali categorie di spesa:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'Migliori controparti:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 Obiettivi di risparmio',
  goals_empty: `Nessun obiettivo ancora. Creane uno nell'app web di ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 Patrimonio netto: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) nel periodo',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) nel periodo',
  networth_change_no_percent: 'Variazione nel periodo: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ Il {{percent}}% degli attivi è a rischio medio/alto — oltre la soglia del {{threshold}}%',
  insight_digest_header: `🔔 Nuovo avviso ${APP_NAME}`,
};

const sk: TranslationMap = {
  receipt_photo_received: '📷 Fotka prijatá, čítam účtenku…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Účtenka čaká v schránke na kontrolu (stav: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Účtenka uložená, ale sumu sa nepodarilo prečítať. Čaká v schránke na kontrolu.',
  receipt_photo_failed:
    'Fotku sa nepodarilo spracovať. Skúste znova alebo ju nahrajte cez webovú aplikáciu.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} zapísané. Kategóriu vyberte v schránke na kontrolu.',
  expense_text_unparsed: 'Nenašiel som sumu. Skúste napr. „káva 4.50“ alebo „taxi 15 EUR“.',
  expense_text_failed: 'Výdavok sa nepodarilo zapísať. Skúste znova.',
  delete_button: '🗑 Zmazať',
  deleted: 'Zmazané.',
  delete_failed: 'Nepodarilo sa zmazať.',
  inbound_help:
    'Môžete tiež:\n• poslať fotku účtenky — prečítam sumu a dám ju do schránky na kontrolu\n• napísať výdavok: „káva 4.50“, „taxi 15 EUR“\n• poslať PDF výpis — pôjde na import',
  connected: '✅ Telegram pripojený. Správy budeme posielať do tohto chatu.',
  link_expired: `⚠️ Platnosť odkazu vypršala alebo už bol použitý. Kliknite v ${APP_NAME} znova na „Pripojiť“.`,
  start_greeting: `👋 Ahoj! Som bot ${APP_NAME}. Ak chcete pripojiť tento čet, otvorte v ${APP_NAME} Nastavenia → Upozornenia a kliknite na „Pripojiť“ pri Telegrame.`,
  unknown_command: 'Neznámy príkaz. Použi /help pre zoznam príkazov.',
  telegram_id_unknown: 'Nepodarilo sa zistiť tvoje Telegram ID. Skús to neskôr.',
  not_connected: `Tento čet ešte nie je pripojený k účtu ${APP_NAME}. Otvorte v ${APP_NAME} Nastavenia → Upozornenia a kliknite na „Pripojiť“ pri Telegrame.`,
  report_failed: 'Správu sa nepodarilo odoslať. Skús to neskôr.',
  document_telegram_id_unknown:
    '⚠️ Nepodarilo sa zistiť tvoje Telegram ID. Pošli /start a skús znova.',
  document_pdf_only: 'Podporované sú iba PDF súbory výpisov.',
  document_received: '📥 Súbor prijatý, spracovanie sa začalo...',
  document_processed: `✅ Súbor prijatý a zaradený na spracovanie. Stav: {{status}}. Výsledok skontroluješ vo webovej aplikácii ${APP_NAME}.`,
  document_failed:
    'Súbor sa nepodarilo spracovať. Skús to neskôr, alebo ho nahraj cez webovú aplikáciu.',
  help: `Dostupné príkazy:\n/start — ako pripojiť tento čet k ${APP_NAME}\n/help — táto pomoc\n/report — denná správa za dnešok\n/report YYYY-MM-DD — správa za zadaný dátum\n/report monthly — správa za aktuálny mesiac\n/goals — pokrok v sporiacich cieľoch\n/networth — tvoje aktuálne čisté imanie`,
  daily_header: '📅 Denná správa — {{date}}',
  income_line: '➕ Príjem: {{amount}} ({{count}})',
  expense_line: '➖ Výdavok: {{amount}} ({{count}})',
  daily_total: '📊 Súhrn dňa: {{amount}}',
  top_income_header: 'Najlepší partneri podľa príjmu:',
  top_expense_header: 'Najvyššie kategórie výdavkov:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Správa za {{period}}',
  monthly_income: '➕ Príjem: {{amount}}',
  monthly_expense: '➖ Výdavok: {{amount}}',
  monthly_diff: '📊 Rozdiel: {{amount}} ({{count}} operácií)',
  top_categories_header: 'Najvyššie kategórie výdavkov:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Najlepší partneri:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Sporiace ciele',
  goals_empty: `Zatiaľ žiadne ciele. Vytvor jeden vo webovej aplikácii ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Čisté imanie: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) za obdobie',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) za obdobie',
  networth_change_no_percent: 'Zmena za obdobie: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}}% aktív je v strednom/vysokom riziku — nad hranicou {{threshold}}%',
  insight_digest_header: `🔔 Nové upozornenie ${APP_NAME}`,
};

const ja: TranslationMap = {
  receipt_photo_received: '📷 写真を受け取りました。レシートを読み取り中…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}。レシートは確認用受信箱で待機中です（状態：{{status}}）。',
  receipt_photo_unreadable:
    '🧾 レシートは保存しましたが金額を読み取れませんでした。確認用受信箱で待機中です。',
  receipt_photo_failed:
    '写真を処理できませんでした。もう一度試すか、Web アプリからアップロードしてください。',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} を記録しました。カテゴリは確認用受信箱で選べます。',
  expense_text_unparsed:
    '金額が見つかりません。「コーヒー 4.50」や「タクシー 15 EUR」のように送ってください。',
  expense_text_failed: '支出を記録できませんでした。もう一度お試しください。',
  delete_button: '🗑 削除',
  deleted: '削除しました。',
  delete_failed: '削除できませんでした。',
  inbound_help:
    'ほかにもできること：\n• レシートの写真を送る — 金額を読み取って確認用受信箱に入れます\n• 支出をテキストで送る：「コーヒー 4.50」「タクシー 15 EUR」\n• PDF の明細を送る — インポートに回します',
  connected: '✅ Telegramが接続されました。このチャットにレポートを送信します。',
  link_expired: `⚠️ このリンクは期限切れか、すでに使用されています。${APP_NAME} でもう一度「接続」を押してください。`,
  start_greeting: `👋 こんにちは！${APP_NAME} ボットです。このチャットを接続するには、${APP_NAME} で 設定 → 通知 を開き、Telegram の横の「接続」を押してください。`,
  unknown_command: '不明なコマンドです。コマンド一覧は/helpをご利用ください。',
  telegram_id_unknown:
    'Telegram IDを確認できませんでした。しばらくしてからもう一度お試しください。',
  not_connected: `このチャットはまだ ${APP_NAME} アカウントに接続されていません。${APP_NAME} で 設定 → 通知 を開き、Telegram の横の「接続」を押してください。`,
  report_failed: 'レポートを送信できませんでした。しばらくしてからもう一度お試しください。',
  document_telegram_id_unknown:
    '⚠️ Telegram IDを確認できませんでした。/start を送信してからもう一度お試しください。',
  document_pdf_only: '対応しているのはPDF形式の明細書ファイルのみです。',
  document_received: '📥 ファイルを受信しました。処理を開始しています…',
  document_processed: `✅ ファイルを受け付け、処理キューに追加しました。ステータス：{{status}}。結果は${APP_NAME}のWebアプリでご確認ください。`,
  document_failed:
    'ファイルを処理できませんでした。しばらくしてから再試行するか、Webアプリからアップロードしてください。',
  help: `利用可能なコマンド:\n/start — このチャットを ${APP_NAME} に接続する方法\n/help — このヘルプ\n/report — 本日の日次レポート\n/report YYYY-MM-DD — 指定日のレポート\n/report monthly — 今月のレポート\n/goals — 貯蓄目標の進捗\n/networth — 現在の純資産`,
  daily_header: '📅 日次レポート — {{date}}',
  income_line: '➕ 収入：{{amount}}（{{count}}件）',
  expense_line: '➖ 支出：{{amount}}（{{count}}件）',
  daily_total: '📊 本日の合計：{{amount}}',
  top_income_header: '収入トップの取引先:',
  top_expense_header: '支出トップのカテゴリ:',
  list_item: '{{index}}. {{name}} — {{amount}}（{{count}}件）',
  monthly_header: '🗓️ {{period}} のレポート',
  monthly_income: '➕ 収入：{{amount}}',
  monthly_expense: '➖ 支出：{{amount}}',
  monthly_diff: '📊 差額：{{amount}}（取引数：{{count}}）',
  top_categories_header: '支出カテゴリのトップ:',
  category_item: '{{index}}. {{name}} — {{amount}}（{{percent}}%）',
  top_counterparties_header: '取引先トップ:',
  counterparty_item: '{{index}}. {{name}} — {{amount}}（{{percent}}%）',
  goals_header: '🎯 貯蓄目標',
  goals_empty: `まだ目標がありません。${APP_NAME}のWebアプリで作成してください。`,
  goal_item: '{{name}}：{{current}} / {{target}} {{currency}}（{{percent}}%）',
  networth_header: '📈 純資産：{{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}}（+{{percent}}%）期間中',
  networth_change_down: '▼ {{amount}} {{currency}}（{{percent}}%）期間中',
  networth_change_no_percent: '期間中の変化：{{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ 資産の{{percent}}%が中〜高リスクです — 閾値{{threshold}}%を超えています',
  insight_digest_header: `🔔 ${APP_NAME}からの新しい通知`,
};

const ko: TranslationMap = {
  receipt_photo_received: '📷 사진을 받았습니다. 영수증을 읽는 중…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. 영수증이 검토함에서 기다리고 있습니다(상태: {{status}}).',
  receipt_photo_unreadable:
    '🧾 영수증은 저장했지만 금액을 읽지 못했습니다. 검토함에서 기다리고 있습니다.',
  receipt_photo_failed: '사진을 처리할 수 없습니다. 다시 시도하거나 웹 앱에서 업로드하세요.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} 기록됨. 카테고리는 검토함에서 선택하세요.',
  expense_text_unparsed: '금액을 찾지 못했습니다. “커피 4.50” 또는 “택시 15 EUR”처럼 보내 보세요.',
  expense_text_failed: '지출을 기록하지 못했습니다. 다시 시도하세요.',
  delete_button: '🗑 삭제',
  deleted: '삭제되었습니다.',
  delete_failed: '삭제하지 못했습니다.',
  inbound_help:
    '이 외에도:\n• 영수증 사진 보내기 — 금액을 읽어 검토함에 넣습니다\n• 지출을 글로 보내기: “커피 4.50”, “택시 15 EUR”\n• PDF 명세서 보내기 — 가져오기로 넘어갑니다',
  connected: '✅ Telegram이 연결되었습니다. 이 채팅으로 리포트를 보내드립니다.',
  link_expired: `⚠️ 이 링크는 만료되었거나 이미 사용되었습니다. ${APP_NAME}에서 "연결"을 다시 누르세요.`,
  start_greeting: `👋 안녕하세요! ${APP_NAME} 봇입니다. 이 채팅을 연결하려면 ${APP_NAME}에서 설정 → 알림을 열고 Telegram 옆의 "연결"을 누르세요.`,
  unknown_command: '알 수 없는 명령입니다. 명령 목록은 /help를 사용하세요.',
  telegram_id_unknown: 'Telegram ID를 확인할 수 없습니다. 나중에 다시 시도해 주세요.',
  not_connected: `이 채팅은 아직 ${APP_NAME} 계정에 연결되지 않았습니다. ${APP_NAME}에서 설정 → 알림을 열고 Telegram 옆의 "연결"을 누르세요.`,
  report_failed: '리포트를 보낼 수 없습니다. 나중에 다시 시도해 주세요.',
  document_telegram_id_unknown:
    '⚠️ Telegram ID를 확인할 수 없습니다. /start를 보낸 후 다시 시도해 주세요.',
  document_pdf_only: 'PDF 명세서 파일만 지원됩니다.',
  document_received: '📥 파일을 받았습니다. 처리를 시작합니다...',
  document_processed: `✅ 파일이 접수되어 처리 대기열에 추가되었습니다. 상태: {{status}}. 결과는 ${APP_NAME} 웹 앱에서 확인하세요.`,
  document_failed:
    '파일을 처리할 수 없습니다. 나중에 다시 시도하거나 웹 앱을 통해 업로드해 주세요.',
  help: `사용 가능한 명령:\n/start — 이 채팅을 ${APP_NAME}에 연결하는 방법\n/help — 이 도움말\n/report — 오늘의 일일 리포트\n/report YYYY-MM-DD — 지정한 날짜의 리포트\n/report monthly — 이번 달 리포트\n/goals — 저축 목표 진행 상황\n/networth — 현재 순자산`,
  daily_header: '📅 일일 리포트 — {{date}}',
  income_line: '➕ 수입: {{amount}} ({{count}}건)',
  expense_line: '➖ 지출: {{amount}} ({{count}}건)',
  daily_total: '📊 오늘의 합계: {{amount}}',
  top_income_header: '수입 기준 상위 거래처:',
  top_expense_header: '지출 상위 카테고리:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}}건)',
  monthly_header: '🗓️ {{period}} 리포트',
  monthly_income: '➕ 수입: {{amount}}',
  monthly_expense: '➖ 지출: {{amount}}',
  monthly_diff: '📊 차액: {{amount}} (거래 {{count}}건)',
  top_categories_header: '지출 카테고리 상위 목록:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: '상위 거래처:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 저축 목표',
  goals_empty: `아직 목표가 없습니다. ${APP_NAME} 웹 앱에서 만들어 보세요.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 순자산: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) 기간 동안',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) 기간 동안',
  networth_change_no_percent: '기간 동안 변화: {{amount}} {{currency}}',
  networth_risky_warning: '⚠️ 자산의 {{percent}}%가 중/고위험입니다 — {{threshold}}% 임계값을 초과',
  insight_digest_header: `🔔 새로운 ${APP_NAME} 알림`,
};

const hi: TranslationMap = {
  receipt_photo_received: '📷 फ़ोटो मिली, रसीद पढ़ी जा रही है…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}। रसीद समीक्षा इनबॉक्स में प्रतीक्षा कर रही है (स्थिति: {{status}})।',
  receipt_photo_unreadable: '🧾 रसीद सहेजी गई, पर राशि नहीं पढ़ी जा सकी। यह समीक्षा इनबॉक्स में है।',
  receipt_photo_failed: 'फ़ोटो संसाधित नहीं हो सकी। फिर कोशिश करें या वेब ऐप से अपलोड करें।',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} दर्ज किया गया। श्रेणी समीक्षा इनबॉक्स में चुनें।',
  expense_text_unparsed: 'राशि नहीं मिली। जैसे “coffee 4.50” या “taxi 15 EUR” लिखें।',
  expense_text_failed: 'खर्च दर्ज नहीं हो सका। फिर कोशिश करें।',
  delete_button: '🗑 हटाएँ',
  deleted: 'हटा दिया गया।',
  delete_failed: 'हटाया नहीं जा सका।',
  inbound_help:
    'आप यह भी कर सकते हैं:\n• रसीद की फ़ोटो भेजें — मैं राशि पढ़कर उसे समीक्षा इनबॉक्स में रखूँगा\n• खर्च लिखकर भेजें: “coffee 4.50”, “taxi 15 EUR”\n• PDF स्टेटमेंट भेजें — वह आयात में जाएगा',
  connected: '✅ Telegram जुड़ गया। हम इस चैट में रिपोर्ट भेजेंगे।',
  link_expired: `⚠️ यह लिंक समाप्त हो गया है या पहले ही इस्तेमाल हो चुका है। ${APP_NAME} में फिर से "कनेक्ट करें" दबाएँ।`,
  start_greeting: `👋 नमस्ते! मैं ${APP_NAME} बॉट हूँ। इस चैट को जोड़ने के लिए ${APP_NAME} में सेटिंग → सूचनाएं खोलें और Telegram के आगे "कनेक्ट करें" दबाएँ।`,
  unknown_command: 'अज्ञात कमांड। कमांड सूची के लिए /help का उपयोग करें।',
  telegram_id_unknown: 'आपका Telegram ID पता नहीं चल सका। बाद में पुनः प्रयास करें।',
  not_connected: `यह चैट अभी किसी ${APP_NAME} खाते से नहीं जुड़ी है। ${APP_NAME} में सेटिंग → सूचनाएं खोलें और Telegram के आगे "कनेक्ट करें" दबाएँ।`,
  report_failed: 'रिपोर्ट भेजी नहीं जा सकी। बाद में पुनः प्रयास करें।',
  document_telegram_id_unknown: '⚠️ आपका Telegram ID पता नहीं चल सका। /start भेजें और पुनः प्रयास करें।',
  document_pdf_only: 'केवल PDF स्टेटमेंट फ़ाइलें समर्थित हैं।',
  document_received: '📥 फ़ाइल प्राप्त हुई, प्रोसेसिंग शुरू हो गई है...',
  document_processed: `✅ फ़ाइल स्वीकार कर ली गई और प्रोसेसिंग में डाल दी गई। स्थिति: {{status}}। परिणाम ${APP_NAME} वेब ऐप में देखें।`,
  document_failed: 'फ़ाइल प्रोसेस नहीं हो सकी। बाद में पुनः प्रयास करें या वेब ऐप से अपलोड करें।',
  help: `उपलब्ध कमांड:\n/start — इस चैट को ${APP_NAME} से कैसे जोड़ें\n/help — यह सहायता\n/report — आज की दैनिक रिपोर्ट\n/report YYYY-MM-DD — निर्दिष्ट तिथि की रिपोर्ट\n/report monthly — चालू माह की रिपोर्ट\n/goals — बचत लक्ष्यों की प्रगति\n/networth — आपकी वर्तमान निवल संपत्ति`,
  daily_header: '📅 दैनिक रिपोर्ट — {{date}}',
  income_line: '➕ आय: {{amount}} ({{count}})',
  expense_line: '➖ व्यय: {{amount}} ({{count}})',
  daily_total: '📊 दिन का योग: {{amount}}',
  top_income_header: 'आय के अनुसार शीर्ष प्रतिपक्ष:',
  top_expense_header: 'शीर्ष व्यय श्रेणियाँ:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ {{period}} की रिपोर्ट',
  monthly_income: '➕ आय: {{amount}}',
  monthly_expense: '➖ व्यय: {{amount}}',
  monthly_diff: '📊 अंतर: {{amount}} (लेनदेन: {{count}})',
  top_categories_header: 'शीर्ष व्यय श्रेणियाँ:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'शीर्ष प्रतिपक्ष:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 बचत लक्ष्य',
  goals_empty: `अभी कोई लक्ष्य नहीं है। ${APP_NAME} वेब ऐप में एक बनाएँ।`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 निवल संपत्ति: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) अवधि में',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) अवधि में',
  networth_change_no_percent: 'अवधि में परिवर्तन: {{amount}} {{currency}}',
  networth_risky_warning: '⚠️ {{percent}}% संपत्ति मध्यम/उच्च जोखिम में है — {{threshold}}% सीमा से अधिक',
  insight_digest_header: `🔔 नई ${APP_NAME} अलर्ट`,
};

const nl: TranslationMap = {
  receipt_photo_received: '📷 Foto ontvangen, bon wordt gelezen…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. De bon wacht in het beoordelingspostvak (status: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Bon opgeslagen, maar het bedrag was niet leesbaar. Hij wacht in het beoordelingspostvak.',
  receipt_photo_failed:
    'De foto kon niet worden verwerkt. Probeer het opnieuw of upload via de web-app.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} vastgelegd. Kies een categorie in het beoordelingspostvak.',
  expense_text_unparsed: 'Ik vond geen bedrag. Probeer “koffie 4.50” of “taxi 15 EUR”.',
  expense_text_failed: 'De uitgave kon niet worden vastgelegd. Probeer het opnieuw.',
  delete_button: '🗑 Verwijderen',
  deleted: 'Verwijderd.',
  delete_failed: 'Verwijderen mislukt.',
  inbound_help:
    'Je kunt ook:\n• een foto van een bon sturen — ik lees het bedrag en zet hem in het beoordelingspostvak\n• een uitgave typen: “koffie 4.50”, “taxi 15 EUR”\n• een PDF-afschrift sturen — dat gaat naar import',
  connected: '✅ Telegram verbonden. We sturen rapporten naar deze chat.',
  link_expired: `⚠️ Deze link is verlopen of al gebruikt. Klik in ${APP_NAME} opnieuw op ‘Verbinden’.`,
  start_greeting: `👋 Hallo! Ik ben de ${APP_NAME}-bot. Open in ${APP_NAME} Instellingen → Meldingen en klik bij Telegram op ‘Verbinden’ om deze chat te koppelen.`,
  unknown_command: "Onbekend commando. Gebruik /help voor de lijst met commando's.",
  telegram_id_unknown: 'Kon je Telegram-ID niet vaststellen. Probeer het later opnieuw.',
  not_connected: `Deze chat is nog niet aan een ${APP_NAME}-account gekoppeld. Open in ${APP_NAME} Instellingen → Meldingen en klik bij Telegram op ‘Verbinden’.`,
  report_failed: 'Kon het rapport niet versturen. Probeer het later opnieuw.',
  document_telegram_id_unknown:
    '⚠️ Kon je Telegram-ID niet vaststellen. Stuur /start en probeer het opnieuw.',
  document_pdf_only: 'Alleen PDF-afschriften worden ondersteund.',
  document_received: '📥 Bestand ontvangen, verwerking is gestart...',
  document_processed: `✅ Bestand geaccepteerd en in de wachtrij voor verwerking gezet. Status: {{status}}. Bekijk het resultaat in de ${APP_NAME}-webapp.`,
  document_failed:
    'Kon het bestand niet verwerken. Probeer het later opnieuw of upload het via de webapp.',
  help: `Beschikbare commando's:\n/start — hoe je deze chat aan ${APP_NAME} koppelt\n/help — deze hulp\n/report — dagrapport van vandaag\n/report YYYY-MM-DD — rapport voor een specifieke datum\n/report monthly — rapport van de huidige maand\n/goals — voortgang van je spaardoelen\n/networth — je huidige nettovermogen`,
  daily_header: '📅 Dagrapport — {{date}}',
  income_line: '➕ Inkomsten: {{amount}} ({{count}})',
  expense_line: '➖ Uitgaven: {{amount}} ({{count}})',
  daily_total: '📊 Dagtotaal: {{amount}}',
  top_income_header: 'Topcontacten naar inkomsten:',
  top_expense_header: 'Topuitgavecategorieën:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Rapport voor {{period}}',
  monthly_income: '➕ Inkomsten: {{amount}}',
  monthly_expense: '➖ Uitgaven: {{amount}}',
  monthly_diff: '📊 Verschil: {{amount}} ({{count}} transacties)',
  top_categories_header: 'Topuitgavecategorieën:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'Topcontacten:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 Spaardoelen',
  goals_empty: `Nog geen doelen. Maak er een aan in de ${APP_NAME}-webapp.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 Nettovermogen: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) over de periode',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) over de periode',
  networth_change_no_percent: 'Verandering over de periode: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}}% van de activa loopt een gemiddeld/hoog risico — boven de grens van {{threshold}}%',
  insight_digest_header: `🔔 Nieuwe ${APP_NAME}-melding`,
};

const sv: TranslationMap = {
  receipt_photo_received: '📷 Foto mottaget, läser kvittot…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Kvittot väntar i granskningsinkorgen (status: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Kvittot sparades men beloppet gick inte att läsa. Det väntar i granskningsinkorgen.',
  receipt_photo_failed: 'Fotot kunde inte behandlas. Försök igen eller ladda upp via webbappen.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} registrerat. Välj kategori i granskningsinkorgen.',
  expense_text_unparsed: 'Jag hittade inget belopp. Prova ”kaffe 4.50” eller ”taxi 15 EUR”.',
  expense_text_failed: 'Utgiften kunde inte registreras. Försök igen.',
  delete_button: '🗑 Ta bort',
  deleted: 'Borttaget.',
  delete_failed: 'Kunde inte ta bort.',
  inbound_help:
    'Du kan också:\n• skicka ett foto på ett kvitto — jag läser beloppet och lägger det i granskningsinkorgen\n• skriva en utgift: ”kaffe 4.50”, ”taxi 15 EUR”\n• skicka ett PDF-kontoutdrag — det går till import',
  connected: '✅ Telegram anslutet. Vi skickar rapporter till den här chatten.',
  link_expired: `⚠️ Länken har gått ut eller redan använts. Tryck på ”Anslut” i ${APP_NAME} igen.`,
  start_greeting: `👋 Hej! Jag är ${APP_NAME}-boten. För att ansluta den här chatten öppnar du Inställningar → Aviseringar i ${APP_NAME} och trycker på ”Anslut” bredvid Telegram.`,
  unknown_command: 'Okänt kommando. Använd /help för listan över kommandon.',
  telegram_id_unknown: 'Kunde inte fastställa ditt Telegram-ID. Försök igen senare.',
  not_connected: `Den här chatten är inte ansluten till något ${APP_NAME}-konto än. Öppna Inställningar → Aviseringar i ${APP_NAME} och tryck på ”Anslut” bredvid Telegram.`,
  report_failed: 'Kunde inte skicka rapporten. Försök igen senare.',
  document_telegram_id_unknown:
    '⚠️ Kunde inte fastställa ditt Telegram-ID. Skicka /start och försök igen.',
  document_pdf_only: 'Endast PDF-kontoutdrag stöds.',
  document_received: '📥 Fil mottagen, bearbetning har startat...',
  document_processed: `✅ Filen har accepterats och köats för bearbetning. Status: {{status}}. Se resultatet i ${APP_NAME}s webbapp.`,
  document_failed:
    'Kunde inte bearbeta filen. Försök igen senare eller ladda upp den via webbappen.',
  help: `Tillgängliga kommandon:\n/start — hur du ansluter den här chatten till ${APP_NAME}\n/help — den här hjälpen\n/report — dagens rapport\n/report YYYY-MM-DD — rapport för ett visst datum\n/report monthly — rapport för aktuell månad\n/goals — framsteg för dina sparmål\n/networth — din aktuella nettoförmögenhet`,
  daily_header: '📅 Dagsrapport — {{date}}',
  income_line: '➕ Inkomst: {{amount}} ({{count}})',
  expense_line: '➖ Utgift: {{amount}} ({{count}})',
  daily_total: '📊 Dagens totalt: {{amount}}',
  top_income_header: 'Toppmotparter efter inkomst:',
  top_expense_header: 'Toppkategorier för utgifter:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Rapport för {{period}}',
  monthly_income: '➕ Inkomst: {{amount}}',
  monthly_expense: '➖ Utgift: {{amount}}',
  monthly_diff: '📊 Skillnad: {{amount}} ({{count}} transaktioner)',
  top_categories_header: 'Toppkategorier för utgifter:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Toppmotparter:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Sparmål',
  goals_empty: `Inga mål ännu. Skapa ett i ${APP_NAME}s webbapp.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Nettoförmögenhet: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) under perioden',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) under perioden',
  networth_change_no_percent: 'Förändring under perioden: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}}% av tillgångarna har medel-/hög risk — över gränsen på {{threshold}}%',
  insight_digest_header: `🔔 Ny ${APP_NAME}-avisering`,
};

const vi: TranslationMap = {
  receipt_photo_received: '📷 Đã nhận ảnh, đang đọc hóa đơn…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Hóa đơn đang chờ trong hộp thư xem xét (trạng thái: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Đã lưu hóa đơn nhưng không đọc được số tiền. Nó đang chờ trong hộp thư xem xét.',
  receipt_photo_failed: 'Không xử lý được ảnh. Thử lại hoặc tải lên qua ứng dụng web.',
  expense_text_done:
    '✅ Đã ghi {{merchant}} — {{amount}} {{currency}}. Chọn danh mục trong hộp thư xem xét.',
  expense_text_unparsed: 'Không tìm thấy số tiền. Thử “cà phê 4.50” hoặc “taxi 15 EUR”.',
  expense_text_failed: 'Không ghi được khoản chi. Vui lòng thử lại.',
  delete_button: '🗑 Xóa',
  deleted: 'Đã xóa.',
  delete_failed: 'Không xóa được.',
  inbound_help:
    'Bạn cũng có thể:\n• gửi ảnh hóa đơn — tôi đọc số tiền và đưa vào hộp thư xem xét\n• nhập khoản chi: “cà phê 4.50”, “taxi 15 EUR”\n• gửi sao kê PDF — sẽ được đưa vào nhập dữ liệu',
  connected: '✅ Đã kết nối Telegram. Chúng tôi sẽ gửi báo cáo vào cuộc trò chuyện này.',
  link_expired: `⚠️ Liên kết này đã hết hạn hoặc đã được sử dụng. Hãy nhấn "Kết nối" trong ${APP_NAME} một lần nữa.`,
  start_greeting: `👋 Xin chào! Tôi là bot ${APP_NAME}. Để kết nối cuộc trò chuyện này, hãy mở Cài đặt → Thông báo trong ${APP_NAME} và nhấn "Kết nối" bên cạnh Telegram.`,
  unknown_command: 'Lệnh không xác định. Dùng /help để xem danh sách lệnh.',
  telegram_id_unknown: 'Không thể xác định ID Telegram của bạn. Vui lòng thử lại sau.',
  not_connected: `Cuộc trò chuyện này chưa được kết nối với tài khoản ${APP_NAME}. Hãy mở Cài đặt → Thông báo trong ${APP_NAME} và nhấn "Kết nối" bên cạnh Telegram.`,
  report_failed: 'Không thể gửi báo cáo. Vui lòng thử lại sau.',
  document_telegram_id_unknown: '⚠️ Không thể xác định ID Telegram của bạn. Gửi /start rồi thử lại.',
  document_pdf_only: 'Chỉ hỗ trợ tệp sao kê định dạng PDF.',
  document_received: '📥 Đã nhận tệp, bắt đầu xử lý...',
  document_processed: `✅ Đã nhận tệp và đưa vào hàng đợi xử lý. Trạng thái: {{status}}. Xem kết quả trong ứng dụng web ${APP_NAME}.`,
  document_failed: 'Không thể xử lý tệp. Vui lòng thử lại sau hoặc tải lên qua ứng dụng web.',
  help: `Các lệnh khả dụng:\n/start — cách kết nối cuộc trò chuyện này với ${APP_NAME}\n/help — trợ giúp này\n/report — báo cáo hằng ngày của hôm nay\n/report YYYY-MM-DD — báo cáo cho một ngày cụ thể\n/report monthly — báo cáo của tháng hiện tại\n/goals — tiến độ mục tiêu tiết kiệm\n/networth — giá trị ròng hiện tại của bạn`,
  daily_header: '📅 Báo cáo hằng ngày — {{date}}',
  income_line: '➕ Thu: {{amount}} ({{count}})',
  expense_line: '➖ Chi: {{amount}} ({{count}})',
  daily_total: '📊 Tổng trong ngày: {{amount}}',
  top_income_header: 'Đối tác hàng đầu theo khoản thu:',
  top_expense_header: 'Danh mục chi hàng đầu:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Báo cáo tháng {{period}}',
  monthly_income: '➕ Thu: {{amount}}',
  monthly_expense: '➖ Chi: {{amount}}',
  monthly_diff: '📊 Chênh lệch: {{amount}} ({{count}} giao dịch)',
  top_categories_header: 'Danh mục chi tiêu hàng đầu:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'Đối tác hàng đầu:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 Mục tiêu tiết kiệm',
  goals_empty: `Chưa có mục tiêu. Hãy tạo một mục tiêu trong ứng dụng web ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 Giá trị ròng: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) trong kỳ',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) trong kỳ',
  networth_change_no_percent: 'Thay đổi trong kỳ: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}}% tài sản ở mức rủi ro trung bình/cao — vượt ngưỡng {{threshold}}%',
  insight_digest_header: `🔔 Cảnh báo mới từ ${APP_NAME}`,
};

const id: TranslationMap = {
  receipt_photo_received: '📷 Foto diterima, membaca struk…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Struk menunggu di kotak masuk peninjauan (status: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Struk disimpan, tetapi jumlahnya tidak terbaca. Menunggu di kotak masuk peninjauan.',
  receipt_photo_failed: 'Foto tidak dapat diproses. Coba lagi atau unggah lewat aplikasi web.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} dicatat. Pilih kategori di kotak masuk peninjauan.',
  expense_text_unparsed: 'Jumlah tidak ditemukan. Coba “kopi 4.50” atau “taksi 15 EUR”.',
  expense_text_failed: 'Pengeluaran tidak dapat dicatat. Coba lagi.',
  delete_button: '🗑 Hapus',
  deleted: 'Dihapus.',
  delete_failed: 'Tidak dapat menghapus.',
  inbound_help:
    'Anda juga bisa:\n• mengirim foto struk — saya membaca jumlahnya dan menaruhnya di kotak masuk peninjauan\n• menulis pengeluaran: “kopi 4.50”, “taksi 15 EUR”\n• mengirim laporan PDF — akan masuk ke impor',
  connected: '✅ Telegram terhubung. Kami akan mengirim laporan ke chat ini.',
  link_expired: `⚠️ Tautan ini sudah kedaluwarsa atau sudah dipakai. Tekan "Hubungkan" di ${APP_NAME} lagi.`,
  start_greeting: `👋 Halo! Saya bot ${APP_NAME}. Untuk menghubungkan obrolan ini, buka Pengaturan → Notifikasi di ${APP_NAME} lalu tekan "Hubungkan" di samping Telegram.`,
  unknown_command: 'Perintah tidak dikenal. Gunakan /help untuk melihat daftar perintah.',
  telegram_id_unknown: 'Tidak dapat menentukan ID Telegram Anda. Coba lagi nanti.',
  not_connected: `Obrolan ini belum terhubung ke akun ${APP_NAME}. Buka Pengaturan → Notifikasi di ${APP_NAME} lalu tekan "Hubungkan" di samping Telegram.`,
  report_failed: 'Tidak dapat mengirim laporan. Coba lagi nanti.',
  document_telegram_id_unknown:
    '⚠️ Tidak dapat menentukan ID Telegram Anda. Kirim /start lalu coba lagi.',
  document_pdf_only: 'Hanya file laporan PDF yang didukung.',
  document_received: '📥 File diterima, pemrosesan dimulai...',
  document_processed: `✅ File diterima dan masuk antrean pemrosesan. Status: {{status}}. Periksa hasilnya di aplikasi web ${APP_NAME}.`,
  document_failed: 'Tidak dapat memproses file. Coba lagi nanti atau unggah melalui aplikasi web.',
  help: `Perintah yang tersedia:\n/start — cara menghubungkan obrolan ini ke ${APP_NAME}\n/help — bantuan ini\n/report — laporan harian hari ini\n/report YYYY-MM-DD — laporan untuk tanggal tertentu\n/report monthly — laporan bulan berjalan\n/goals — progres target tabungan Anda\n/networth — kekayaan bersih Anda saat ini`,
  daily_header: '📅 Laporan harian — {{date}}',
  income_line: '➕ Pemasukan: {{amount}} ({{count}})',
  expense_line: '➖ Pengeluaran: {{amount}} ({{count}})',
  daily_total: '📊 Total hari ini: {{amount}}',
  top_income_header: 'Mitra teratas berdasarkan pemasukan:',
  top_expense_header: 'Kategori pengeluaran teratas:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Laporan untuk {{period}}',
  monthly_income: '➕ Pemasukan: {{amount}}',
  monthly_expense: '➖ Pengeluaran: {{amount}}',
  monthly_diff: '📊 Selisih: {{amount}} ({{count}} transaksi)',
  top_categories_header: 'Kategori pengeluaran teratas:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  top_counterparties_header: 'Mitra teratas:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}}%)',
  goals_header: '🎯 Target tabungan',
  goals_empty: `Belum ada target. Buat satu di aplikasi web ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}}%)',
  networth_header: '📈 Kekayaan bersih: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}}%) selama periode',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}}%) selama periode',
  networth_change_no_percent: 'Perubahan selama periode: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}}% aset berisiko menengah/tinggi — di atas ambang {{threshold}}%',
  insight_digest_header: `🔔 Peringatan ${APP_NAME} baru`,
};

const da: TranslationMap = {
  connected: '✅ Telegram forbundet. Vi sender rapporter til denne chat.',
  link_expired: `⚠️ Linket er udløbet eller allerede brugt. Tryk på »Forbind« i ${APP_NAME} igen.`,
  start_greeting: `👋 Hej! Jeg er ${APP_NAME}-botten. For at forbinde denne chat skal du åbne Indstillinger → Notifikationer i ${APP_NAME} og trykke på »Forbind« ud for Telegram.`,
  unknown_command: 'Ukendt kommando. Brug /help for at se listen over kommandoer.',
  telegram_id_unknown: 'Dit Telegram-id kunne ikke bestemmes. Prøv igen senere.',
  not_connected: `Denne chat er endnu ikke forbundet til en ${APP_NAME}-konto. Åbn Indstillinger → Notifikationer i ${APP_NAME} og tryk på »Forbind« ud for Telegram.`,
  report_failed: 'Rapporten kunne ikke sendes. Prøv igen senere.',
  document_telegram_id_unknown: '⚠️ Dit Telegram-id kunne ikke bestemmes. Send /start og prøv igen.',
  document_pdf_only: 'Kun PDF-kontoudtog understøttes.',
  document_received: '📥 Fil modtaget, behandlingen er begyndt...',
  document_processed: `✅ Filen er accepteret og sat i kø til behandling. Status: {{status}}. Se resultatet i ${APP_NAME}-webappen.`,
  document_failed: 'Filen kunne ikke behandles. Prøv igen senere, eller upload den via webappen.',
  help: `Tilgængelige kommandoer:\n/start — sådan forbinder du denne chat med ${APP_NAME}\n/help — denne hjælp\n/report — dagens rapport\n/report ÅÅÅÅ-MM-DD — rapport for en bestemt dato\n/report monthly — rapport for den aktuelle måned\n/goals — fremgang på dine opsparingsmål\n/networth — din aktuelle formue`,
  daily_header: '📅 Daglig rapport — {{date}}',
  income_line: '➕ Indtægter: {{amount}} ({{count}})',
  expense_line: '➖ Udgifter: {{amount}} ({{count}})',
  daily_total: '📊 Dagens total: {{amount}}',
  top_income_header: 'Største modparter efter indtægt:',
  top_expense_header: 'Største udgiftskategorier:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Rapport for {{period}}',
  monthly_income: '➕ Indtægter: {{amount}}',
  monthly_expense: '➖ Udgifter: {{amount}}',
  monthly_diff: '📊 Forskel: {{amount}} ({{count}} posteringer)',
  top_categories_header: 'Største udgiftskategorier:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Største modparter:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Opsparingsmål',
  goals_empty: `Ingen mål endnu. Opret et i ${APP_NAME}-webappen.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Formue: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) i perioden',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) i perioden',
  networth_change_no_percent: 'Ændring i perioden: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % af aktiverne er i mellem/høj risiko — over grænsen på {{threshold}} %',
  insight_digest_header: `🔔 Ny ${APP_NAME}-besked`,
  receipt_photo_received: '📷 Foto modtaget, læser kvitteringen…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Kvitteringen venter i gennemgangsindbakken (status: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Kvitteringen er gemt, men beløbet kunne ikke læses. Den venter i gennemgangsindbakken.',
  receipt_photo_failed: 'Fotoet kunne ikke behandles. Prøv igen, eller upload det i webappen.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} registreret. Vælg en kategori i gennemgangsindbakken.',
  expense_text_unparsed: 'Jeg kunne ikke finde et beløb. Prøv fx “kaffe 4.50” eller “taxa 15 EUR”.',
  expense_text_failed: 'Udgiften kunne ikke registreres. Prøv igen.',
  delete_button: '🗑 Slet',
  deleted: 'Slettet.',
  delete_failed: 'Kunne ikke slette.',
  inbound_help:
    'Du kan også:\n• sende et foto eller billede af en kvittering — jeg læser beløbet og lægger det i gennemgangsindbakken\n• skrive en udgift: “kaffe 4.50”, “taxa 15 EUR”\n• sende et kontoudtog som PDF — det går til import',
};

const nb: TranslationMap = {
  connected: '✅ Telegram tilkoblet. Vi sender rapporter til denne chatten.',
  link_expired: `⚠️ Lenken er utløpt eller allerede brukt. Trykk «Koble til» i ${APP_NAME} på nytt.`,
  start_greeting: `👋 Hei! Jeg er ${APP_NAME}-boten. For å koble til denne chatten, åpne Innstillinger → Varsler i ${APP_NAME} og trykk «Koble til» ved Telegram.`,
  unknown_command: 'Ukjent kommando. Bruk /help for å se listen over kommandoer.',
  telegram_id_unknown: 'Kunne ikke fastslå din Telegram-ID. Prøv igjen senere.',
  not_connected: `Denne chatten er ikke koblet til en ${APP_NAME}-konto ennå. Åpne Innstillinger → Varsler i ${APP_NAME} og trykk «Koble til» ved Telegram.`,
  report_failed: 'Kunne ikke sende rapporten. Prøv igjen senere.',
  document_telegram_id_unknown: '⚠️ Kunne ikke fastslå din Telegram-ID. Send /start og prøv igjen.',
  document_pdf_only: 'Bare PDF-kontoutskrifter støttes.',
  document_received: '📥 Fil mottatt, behandlingen har startet...',
  document_processed: `✅ Filen er godtatt og lagt i kø for behandling. Status: {{status}}. Se resultatet i ${APP_NAME}-webappen.`,
  document_failed: 'Kunne ikke behandle filen. Prøv igjen senere, eller last den opp via webappen.',
  help: `Tilgjengelige kommandoer:\n/start — slik kobler du denne chatten til ${APP_NAME}\n/help — denne hjelpen\n/report — dagens rapport\n/report ÅÅÅÅ-MM-DD — rapport for en bestemt dato\n/report monthly — rapport for inneværende måned\n/goals — framgang på sparemålene dine\n/networth — din nåværende nettoformue`,
  daily_header: '📅 Daglig rapport — {{date}}',
  income_line: '➕ Inntekter: {{amount}} ({{count}})',
  expense_line: '➖ Kostnader: {{amount}} ({{count}})',
  daily_total: '📊 Dagens sum: {{amount}}',
  top_income_header: 'Største motparter etter inntekt:',
  top_expense_header: 'Største utgiftskategorier:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Rapport for {{period}}',
  monthly_income: '➕ Inntekter: {{amount}}',
  monthly_expense: '➖ Kostnader: {{amount}}',
  monthly_diff: '📊 Differanse: {{amount}} ({{count}} transaksjoner)',
  top_categories_header: 'Største utgiftskategorier:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Største motparter:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Sparemål',
  goals_empty: `Ingen mål ennå. Opprett ett i ${APP_NAME}-webappen.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Nettoformue: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) i perioden',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) i perioden',
  networth_change_no_percent: 'Endring i perioden: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % av eiendelene er i middels/høy risiko — over terskelen på {{threshold}} %',
  insight_digest_header: `🔔 Ny ${APP_NAME}-varsling`,
  receipt_photo_received: '📷 Bilde mottatt, leser kvitteringen…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Kvitteringen venter i gjennomgangsinnboksen (status: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Kvitteringen er lagret, men beløpet kunne ikke leses. Den venter i gjennomgangsinnboksen.',
  receipt_photo_failed: 'Kunne ikke behandle bildet. Prøv igjen eller last det opp i webappen.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} registrert. Velg en kategori i gjennomgangsinnboksen.',
  expense_text_unparsed:
    'Jeg fant ikke noe beløp. Prøv for eksempel “kaffe 4.50” eller “taxi 15 EUR”.',
  expense_text_failed: 'Kunne ikke registrere utgiften. Prøv igjen.',
  delete_button: '🗑 Slett',
  deleted: 'Slettet.',
  delete_failed: 'Kunne ikke slette.',
  inbound_help:
    'Du kan også:\n• sende et bilde av en kvittering — jeg leser beløpet og legger det i gjennomgangsinnboksen\n• skrive en utgift: “kaffe 4.50”, “taxi 15 EUR”\n• sende et kontoutskrift som PDF — det går til import',
};

const nn: TranslationMap = {
  connected: '✅ Telegram tilkopla. Vi sender rapportar til denne chatten.',
  link_expired: `⚠️ Lenkja har gått ut eller er alt brukt. Trykk «Kople til» i ${APP_NAME} på nytt.`,
  start_greeting: `👋 Hei! Eg er ${APP_NAME}-boten. For å kople til denne chatten, opne Innstillingar → Varsel i ${APP_NAME} og trykk «Kople til» ved Telegram.`,
  unknown_command: 'Ukjend kommando. Bruk /help for å sjå lista over kommandoar.',
  telegram_id_unknown: 'Kunne ikkje fastslå din Telegram-ID. Prøv igjen seinare.',
  not_connected: `Denne chatten er ikkje kopla til ein ${APP_NAME}-konto enno. Opne Innstillingar → Varsel i ${APP_NAME} og trykk «Kople til» ved Telegram.`,
  report_failed: 'Kunne ikkje sende rapporten. Prøv igjen seinare.',
  document_telegram_id_unknown: '⚠️ Kunne ikkje fastslå din Telegram-ID. Send /start og prøv igjen.',
  document_pdf_only: 'Berre PDF-kontoutskrifter er støtta.',
  document_received: '📥 Fil motteken, handsaminga har starta...',
  document_processed: `✅ Fila er godteken og lagd i kø for handsaming. Status: {{status}}. Sjå resultatet i ${APP_NAME}-webappen.`,
  document_failed:
    'Kunne ikkje handsame fila. Prøv igjen seinare, eller last henne opp via webappen.',
  help: `Tilgjengelege kommandoar:\n/start — korleis du koplar denne chatten til ${APP_NAME}\n/help — denne hjelpa\n/report — rapporten for i dag\n/report ÅÅÅÅ-MM-DD — rapport for ein bestemt dato\n/report monthly — rapport for denne månaden\n/goals — framgang på sparemåla dine\n/networth — din noverande nettoformue`,
  daily_header: '📅 Dagleg rapport — {{date}}',
  income_line: '➕ Inntekter: {{amount}} ({{count}})',
  expense_line: '➖ Kostnader: {{amount}} ({{count}})',
  daily_total: '📊 Sum for dagen: {{amount}}',
  top_income_header: 'Største motpartar etter inntekt:',
  top_expense_header: 'Største utgiftskategoriar:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Rapport for {{period}}',
  monthly_income: '➕ Inntekter: {{amount}}',
  monthly_expense: '➖ Kostnader: {{amount}}',
  monthly_diff: '📊 Differanse: {{amount}} ({{count}} transaksjonar)',
  top_categories_header: 'Største utgiftskategoriar:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Største motpartar:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Sparemål',
  goals_empty: `Ingen mål enno. Opprett eitt i ${APP_NAME}-webappen.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Nettoformue: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) i perioden',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) i perioden',
  networth_change_no_percent: 'Endring i perioden: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % av eigedelane er i middels/høg risiko — over terskelen på {{threshold}} %',
  insight_digest_header: `🔔 Ny ${APP_NAME}-varsling`,
  receipt_photo_received: '📷 Bilete motteke, les kvitteringa…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Kvitteringa ventar i gjennomgangsinnboksen (status: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Kvitteringa er lagra, men beløpet kunne ikkje lesast. Ho ventar i gjennomgangsinnboksen.',
  receipt_photo_failed: 'Kunne ikkje handsame biletet. Prøv igjen eller last det opp i nettappen.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} registrert. Vel ein kategori i gjennomgangsinnboksen.',
  expense_text_unparsed:
    'Eg fann ikkje noko beløp. Prøv til dømes “kaffi 4.50” eller “taxi 15 EUR”.',
  expense_text_failed: 'Kunne ikkje registrere utgifta. Prøv igjen.',
  delete_button: '🗑 Slett',
  deleted: 'Sletta.',
  delete_failed: 'Kunne ikkje slette.',
  inbound_help:
    'Du kan òg:\n• sende eit bilete av ei kvittering — eg les beløpet og legg det i gjennomgangsinnboksen\n• skrive ei utgift: “kaffi 4.50”, “taxi 15 EUR”\n• sende eit kontoutdrag som PDF — det går til import',
};

const fi: TranslationMap = {
  connected: '✅ Telegram yhdistetty. Lähetämme raportit tähän keskusteluun.',
  link_expired: `⚠️ Linkki on vanhentunut tai jo käytetty. Paina ${APP_NAME}-sovelluksessa uudelleen ”Yhdistä”.`,
  start_greeting: `👋 Hei! Olen ${APP_NAME}-botti. Yhdistä tämä keskustelu avaamalla ${APP_NAME}-sovelluksessa Asetukset → Ilmoitukset ja painamalla Telegramin kohdalla ”Yhdistä”.`,
  unknown_command: 'Tuntematon komento. Käytä /help nähdäksesi komentojen luettelon.',
  telegram_id_unknown: 'Telegram-tunnustasi ei voitu määrittää. Yritä myöhemmin uudelleen.',
  not_connected: `Tätä keskustelua ei ole vielä yhdistetty ${APP_NAME}-tiliin. Avaa ${APP_NAME}-sovelluksessa Asetukset → Ilmoitukset ja paina Telegramin kohdalla ”Yhdistä”.`,
  report_failed: 'Raporttia ei voitu lähettää. Yritä myöhemmin uudelleen.',
  document_telegram_id_unknown:
    '⚠️ Telegram-tunnustasi ei voitu määrittää. Lähetä /start ja yritä uudelleen.',
  document_pdf_only: 'Vain PDF-muotoiset tiliotteet ovat tuettuja.',
  document_received: '📥 Tiedosto vastaanotettu, käsittely on aloitettu...',
  document_processed: `✅ Tiedosto hyväksyttiin ja asetettiin käsittelyjonoon. Tila: {{status}}. Katso tulos ${APP_NAME}-verkkosovelluksesta.`,
  document_failed:
    'Tiedostoa ei voitu käsitellä. Yritä myöhemmin uudelleen tai lataa se verkkosovelluksessa.',
  help: `Käytettävissä olevat komennot:\n/start — näin yhdistät tämän keskustelun ${APP_NAME}-sovellukseen\n/help — tämä ohje\n/report — tämän päivän raportti\n/report VVVV-KK-PP — raportti tietyltä päivältä\n/report monthly — kuluvan kuukauden raportti\n/goals — säästötavoitteidesi edistyminen\n/networth — nykyinen nettovarallisuutesi`,
  daily_header: '📅 Päivän raportti — {{date}}',
  income_line: '➕ Tulot: {{amount}} ({{count}})',
  expense_line: '➖ Menot: {{amount}} ({{count}})',
  daily_total: '📊 Päivän summa: {{amount}}',
  top_income_header: 'Suurimmat vastapuolet tulojen mukaan:',
  top_expense_header: 'Suurimmat kulukategoriat:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Raportti jaksolta {{period}}',
  monthly_income: '➕ Tulot: {{amount}}',
  monthly_expense: '➖ Menot: {{amount}}',
  monthly_diff: '📊 Ero: {{amount}} ({{count}} tapahtumaa)',
  top_categories_header: 'Suurimmat kulukategoriat:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Suurimmat vastapuolet:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Säästötavoitteet',
  goals_empty: `Ei vielä tavoitteita. Luo yksi ${APP_NAME}-verkkosovelluksessa.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Nettovarallisuus: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) jaksolla',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) jaksolla',
  networth_change_no_percent: 'Muutos jaksolla: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % varoista on keskisuuressa/korkeassa riskissä — yli {{threshold}} %:n rajan',
  insight_digest_header: `🔔 Uusi ${APP_NAME}-ilmoitus`,
  receipt_photo_received: '📷 Kuva vastaanotettu, luen kuittia…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Kuitti odottaa tarkistuslaatikossa (tila: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Kuitti tallennettiin, mutta summaa ei saatu luettua. Se odottaa tarkistuslaatikossa.',
  receipt_photo_failed:
    'Kuvaa ei voitu käsitellä. Yritä uudelleen tai lataa se verkkosovelluksessa.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} kirjattu. Valitse luokka tarkistuslaatikossa.',
  expense_text_unparsed: 'En löytänyt summaa. Kokeile esimerkiksi “kahvi 4.50” tai “taksi 15 EUR”.',
  expense_text_failed: 'Kulua ei voitu kirjata. Yritä uudelleen.',
  delete_button: '🗑 Poista',
  deleted: 'Poistettu.',
  delete_failed: 'Poisto epäonnistui.',
  inbound_help:
    'Voit myös:\n• lähettää kuvan kuitista — luen summan ja vien sen tarkistuslaatikkoon\n• kirjoittaa kulun: “kahvi 4.50”, “taksi 15 EUR”\n• lähettää tiliotteen PDF-muodossa — se menee tuontiin',
};

const is: TranslationMap = {
  connected: '✅ Telegram tengt. Við sendum skýrslur í þetta samtal.',
  link_expired: `⚠️ Þessi tengill er útrunninn eða hefur þegar verið notaður. Ýttu aftur á „Tengja“ í ${APP_NAME}.`,
  start_greeting: `👋 Hæ! Ég er ${APP_NAME}-þjarkinn. Til að tengja þetta samtal skaltu opna Stillingar → Tilkynningar í ${APP_NAME} og ýta á „Tengja“ við Telegram.`,
  unknown_command: 'Óþekkt skipun. Notaðu /help til að sjá lista yfir skipanir.',
  telegram_id_unknown: 'Ekki var unnt að greina Telegram-kennið þitt. Reyndu aftur síðar.',
  not_connected: `Þetta samtal er ekki enn tengt ${APP_NAME}-aðgangi. Opnaðu Stillingar → Tilkynningar í ${APP_NAME} og ýttu á „Tengja“ við Telegram.`,
  report_failed: 'Ekki var unnt að senda skýrsluna. Reyndu aftur síðar.',
  document_telegram_id_unknown:
    '⚠️ Ekki var unnt að greina Telegram-kennið þitt. Sendu /start og reyndu aftur.',
  document_pdf_only: 'Aðeins PDF-yfirlit eru studd.',
  document_received: '📥 Skrá móttekin, vinnsla er byrjuð...',
  document_processed: `✅ Skráin var tekin við og sett í vinnsluröð. Staða: {{status}}. Sjáðu útkomuna í ${APP_NAME}-vefappinu.`,
  document_failed:
    'Ekki var unnt að vinna úr skránni. Reyndu aftur síðar eða hlaðið henni upp í vefappinu.',
  help: `Tiltækar skipanir:\n/start — hvernig á að tengja þetta samtal við ${APP_NAME}\n/help — þessi hjálp\n/report — skýrsla dagsins\n/report ÁÁÁÁ-MM-DD — skýrsla fyrir tiltekna dagsetningu\n/report monthly — skýrsla fyrir yfirstandandi mánuð\n/goals — framgangur sparnaðarmarkmiða\n/networth — núverandi hrein eign`,
  daily_header: '📅 Dagsskýrsla — {{date}}',
  income_line: '➕ Tekjur: {{amount}} ({{count}})',
  expense_line: '➖ Gjöld: {{amount}} ({{count}})',
  daily_total: '📊 Samtala dagsins: {{amount}}',
  top_income_header: 'Helstu gagnaðilar eftir tekjum:',
  top_expense_header: 'Helstu útgjaldakategoríur:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Skýrsla fyrir {{period}}',
  monthly_income: '➕ Tekjur: {{amount}}',
  monthly_expense: '➖ Gjöld: {{amount}}',
  monthly_diff: '📊 Mismunur: {{amount}} ({{count}} færslur)',
  top_categories_header: 'Helstu útgjaldakategoríur:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Helstu gagnaðilar:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Sparnaðarmarkmið',
  goals_empty: `Engin markmið enn. Búðu til eitt í ${APP_NAME}-vefappinu.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Hrein eign: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) á tímabilinu',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) á tímabilinu',
  networth_change_no_percent: 'Breyting á tímabilinu: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % eigna eru í miðlungs/mikilli hættu — yfir markinu {{threshold}} %',
  insight_digest_header: `🔔 Ný ${APP_NAME}-tilkynning`,
  receipt_photo_received: '📷 Mynd móttekin, les kvittunina…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Kvittunin bíður í yfirferðarhólfinu (staða: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Kvittunin var vistuð en ekki tókst að lesa upphæðina. Hún bíður í yfirferðarhólfinu.',
  receipt_photo_failed:
    'Ekki tókst að vinna úr myndinni. Reyndu aftur eða hlaðaðu henni upp í vefforritinu.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} skráð. Veldu flokk í yfirferðarhólfinu.',
  expense_text_unparsed: 'Ég fann enga upphæð. Prófaðu t.d. „kaffi 4.50“ eða „leigubíll 15 EUR“.',
  expense_text_failed: 'Ekki tókst að skrá útgjöldin. Reyndu aftur.',
  delete_button: '🗑 Eyða',
  deleted: 'Eytt.',
  delete_failed: 'Ekki tókst að eyða.',
  inbound_help:
    'Þú getur líka:\n• sent mynd af kvittun — ég les upphæðina og set hana í yfirferðarhólfið\n• skrifað útgjöld: „kaffi 4.50“, „leigubíll 15 EUR“\n• sent bankayfirlit sem PDF — það fer í innflutning',
};

const fo: TranslationMap = {
  connected: '✅ Telegram knýtt. Vit senda frágreiðingar til hetta kjak.',
  link_expired: `⚠️ Hetta leinkið er útgingið ella longu brúkt. Trýst aftur á „Knýt“ í ${APP_NAME}.`,
  start_greeting: `👋 Hey! Eg eri ${APP_NAME}-bottin. Fyri at knýta hetta kjakið, lat upp Innstillingar → Fráboðanir í ${APP_NAME} og trýst á „Knýt“ við Telegram.`,
  unknown_command: 'Ókend stýriboð. Brúka /help fyri at síggja listan av stýriboðum.',
  telegram_id_unknown: 'Fekk ikki staðfest títt Telegram-ID. Royn aftur seinni.',
  not_connected: `Hetta kjakið er enn ikki knýtt at einari ${APP_NAME}-konto. Lat upp Innstillingar → Fráboðanir í ${APP_NAME} og trýst á „Knýt“ við Telegram.`,
  report_failed: 'Fekk ikki sent frágreiðingina. Royn aftur seinni.',
  document_telegram_id_unknown: '⚠️ Fekk ikki staðfest títt Telegram-ID. Send /start og royn aftur.',
  document_pdf_only: 'Bert PDF-kontoúrtøk eru stuðlað.',
  document_received: '📥 Fíla móttikin, viðgerðin er byrjað...',
  document_processed: `✅ Fílan er góðkend og sett í bíðirøð til viðgerð. Støða: {{status}}. Síggj úrslitið í ${APP_NAME}-vevappinum.`,
  document_failed:
    'Fekk ikki viðgjørt fíluna. Royn aftur seinni, ella legg hana upp gjøgnum vevappin.',
  help: `Tøk stýriboð:\n/start — soleiðis knýtir tú hetta kjakið at ${APP_NAME}\n/help — henda hjálp\n/report — frágreiðing fyri í dag\n/report ÁÁÁÁ-MM-DD — frágreiðing fyri ein ávísan dag\n/report monthly — frágreiðing fyri henda mánaðin\n/goals — framgongd á sparimálunum tínum\n/networth — tín verandi nettoogn`,
  daily_header: '📅 Daglig frágreiðing — {{date}}',
  income_line: '➕ Inntøkur: {{amount}} ({{count}})',
  expense_line: '➖ Útgjøld: {{amount}} ({{count}})',
  daily_total: '📊 Samlað fyri dagin: {{amount}}',
  top_income_header: 'Størstu mótpartar eftir inntøku:',
  top_expense_header: 'Størstu útgjaldsbólkar:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Frágreiðing fyri {{period}}',
  monthly_income: '➕ Inntøkur: {{amount}}',
  monthly_expense: '➖ Útgjøld: {{amount}}',
  monthly_diff: '📊 Munur: {{amount}} ({{count}} posteringar)',
  top_categories_header: 'Størstu útgjaldsbólkar:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Størstu mótpartar:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Sparimál',
  goals_empty: `Ongin mál enn. Stovna eitt í ${APP_NAME}-vevappinum.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Nettoogn: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) í tíðarskeiðinum',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) í tíðarskeiðinum',
  networth_change_no_percent: 'Broyting í tíðarskeiðinum: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % av eignunum eru í miðal/høgum vanda — yvir markinum {{threshold}} %',
  insight_digest_header: `🔔 Nýggj ${APP_NAME}-fráboðan`,
  receipt_photo_received: '📷 Mynd móttikin, lesi kvittanina…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Kvittanin bíðar í eftirkanningarinnbakkanum (støða: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Kvittanin er goymd, men upphæddin kundi ikki lesast. Hon bíðar í eftirkanningarinnbakkanum.',
  receipt_photo_failed: 'Myndin kundi ikki viðgerast. Royn aftur ella legg hana upp í vevappini.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} skrásett. Vel ein bólk í eftirkanningarinnbakkanum.',
  expense_text_unparsed: 'Eg fann onga upphædd. Royn t.d. “kaffi 4.50” ella “taksi 15 EUR”.',
  expense_text_failed: 'Útreiðslan kundi ikki skrásetast. Royn aftur.',
  delete_button: '🗑 Strika',
  deleted: 'Strikað.',
  delete_failed: 'Kundi ikki strika.',
  inbound_help:
    'Tú kanst eisini:\n• senda eina mynd av eini kvittan — eg lesi upphæddina og leggi hana í eftirkanningarinnbakkan\n• skriva eina útreiðslu: “kaffi 4.50”, “taksi 15 EUR”\n• senda eitt kontoyvirlit sum PDF — tað fer til innflutning',
};

const cs: TranslationMap = {
  connected: '✅ Telegram připojen. Reporty budeme posílat do tohoto chatu.',
  link_expired: `⚠️ Platnost odkazu vypršela nebo už byl použit. Klikněte v ${APP_NAME} znovu na „Připojit“.`,
  start_greeting: `👋 Ahoj! Jsem bot ${APP_NAME}. Chcete-li připojit tento chat, otevřete v ${APP_NAME} Nastavení → Oznámení a klikněte u Telegramu na „Připojit“.`,
  unknown_command: 'Neznámý příkaz. Seznam příkazů zobrazíte pomocí /help.',
  telegram_id_unknown: 'Vaše Telegram ID se nepodařilo zjistit. Zkuste to později.',
  not_connected: `Tento chat zatím není připojen k účtu ${APP_NAME}. Otevřete v ${APP_NAME} Nastavení → Oznámení a klikněte u Telegramu na „Připojit“.`,
  report_failed: 'Report se nepodařilo odeslat. Zkuste to později.',
  document_telegram_id_unknown:
    '⚠️ Vaše Telegram ID se nepodařilo zjistit. Pošlete /start a zkuste to znovu.',
  document_pdf_only: 'Podporovány jsou pouze výpisy ve formátu PDF.',
  document_received: '📥 Soubor přijat, zpracování začalo...',
  document_processed: `✅ Soubor přijat a zařazen ke zpracování. Stav: {{status}}. Výsledek najdete ve webové aplikaci ${APP_NAME}.`,
  document_failed:
    'Soubor se nepodařilo zpracovat. Zkuste to později nebo jej nahrajte ve webové aplikaci.',
  help: `Dostupné příkazy:\n/start — jak připojit tento chat k ${APP_NAME}\n/help — tato nápověda\n/report — dnešní denní report\n/report RRRR-MM-DD — report pro určité datum\n/report monthly — report za aktuální měsíc\n/goals — pokrok vašich spořicích cílů\n/networth — vaše aktuální čisté jmění`,
  daily_header: '📅 Denní report — {{date}}',
  income_line: '➕ Příjmy: {{amount}} ({{count}})',
  expense_line: '➖ Výdaje: {{amount}} ({{count}})',
  daily_total: '📊 Celkem za den: {{amount}}',
  top_income_header: 'Největší protistrany podle příjmu:',
  top_expense_header: 'Největší kategorie výdajů:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Report za {{period}}',
  monthly_income: '➕ Příjmy: {{amount}}',
  monthly_expense: '➖ Výdaje: {{amount}}',
  monthly_diff: '📊 Rozdíl: {{amount}} ({{count}} transakcí)',
  top_categories_header: 'Největší kategorie výdajů:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Největší protistrany:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Spořicí cíle',
  goals_empty: `Zatím žádné cíle. Vytvořte jeden ve webové aplikaci ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Čisté jmění: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) za období',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) za období',
  networth_change_no_percent: 'Změna za období: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % aktiv je ve středním/vysokém riziku — nad limitem {{threshold}} %',
  insight_digest_header: `🔔 Nové upozornění ${APP_NAME}`,
  receipt_photo_received: '📷 Fotka přijata, čtu účtenku…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Účtenka čeká ve schránce ke kontrole (stav: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Účtenka je uložená, ale částku se nepodařilo přečíst. Čeká ve schránce ke kontrole.',
  receipt_photo_failed:
    'Fotku se nepodařilo zpracovat. Zkuste to znovu nebo ji nahrajte ve webové aplikaci.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} zaznamenáno. Kategorii vyberte ve schránce ke kontrole.',
  expense_text_unparsed: 'Nenašel jsem částku. Zkuste třeba „káva 4.50“ nebo „taxi 15 EUR“.',
  expense_text_failed: 'Výdaj se nepodařilo zaznamenat. Zkuste to znovu.',
  delete_button: '🗑 Smazat',
  deleted: 'Smazáno.',
  delete_failed: 'Smazání se nezdařilo.',
  inbound_help:
    'Můžete také:\n• poslat fotku účtenky — přečtu částku a dám ji do schránky ke kontrole\n• napsat výdaj: „káva 4.50“, „taxi 15 EUR“\n• poslat výpis v PDF — půjde do importu',
};

const bg: TranslationMap = {
  connected: '✅ Telegram е свързан. Ще изпращаме отчети в този чат.',
  link_expired: `⚠️ Връзката е изтекла или вече е използвана. Натиснете „Свързване“ в ${APP_NAME} отново.`,
  start_greeting: `👋 Здравейте! Аз съм ботът на ${APP_NAME}. За да свържете този чат, отворете Настройки → Известия в ${APP_NAME} и натиснете „Свързване“ до Telegram.`,
  unknown_command: 'Неизвестна команда. Използвайте /help, за да видите списъка с команди.',
  telegram_id_unknown: 'Вашият Telegram ID не можа да бъде определен. Опитайте по-късно.',
  not_connected: `Този чат още не е свързан с акаунт в ${APP_NAME}. Отворете Настройки → Известия в ${APP_NAME} и натиснете „Свързване“ до Telegram.`,
  report_failed: 'Отчетът не можа да бъде изпратен. Опитайте по-късно.',
  document_telegram_id_unknown:
    '⚠️ Вашият Telegram ID не можа да бъде определен. Изпратете /start и опитайте отново.',
  document_pdf_only: 'Поддържат се само извлечения в PDF.',
  document_received: '📥 Файлът е получен, обработката започна...',
  document_processed: `✅ Файлът е приет и е в опашка за обработка. Статус: {{status}}. Вижте резултата в уеб приложението ${APP_NAME}.`,
  document_failed:
    'Файлът не можа да бъде обработен. Опитайте по-късно или го качете през уеб приложението.',
  help: `Налични команди:\n/start — как да свържете този чат с ${APP_NAME}\n/help — тази помощ\n/report — днешният дневен отчет\n/report ГГГГ-ММ-ДД — отчет за конкретна дата\n/report monthly — отчет за текущия месец\n/goals — напредък по вашите цели за спестяване\n/networth — вашата текуща нетна стойност`,
  daily_header: '📅 Дневен отчет — {{date}}',
  income_line: '➕ Приходи: {{amount}} ({{count}})',
  expense_line: '➖ Разходи: {{amount}} ({{count}})',
  daily_total: '📊 Общо за деня: {{amount}}',
  top_income_header: 'Най-големи контрагенти по приход:',
  top_expense_header: 'Най-големи категории разходи:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Отчет за {{period}}',
  monthly_income: '➕ Приходи: {{amount}}',
  monthly_expense: '➖ Разходи: {{amount}}',
  monthly_diff: '📊 Разлика: {{amount}} ({{count}} транзакции)',
  top_categories_header: 'Най-големи категории разходи:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Най-големи контрагенти:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Цели за спестяване',
  goals_empty: `Още няма цели. Създайте една в уеб приложението ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Нетна стойност: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) за периода',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) за периода',
  networth_change_no_percent: 'Промяна за периода: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % от активите са в среден/висок риск — над прага от {{threshold}} %',
  insight_digest_header: `🔔 Ново известие от ${APP_NAME}`,
  receipt_photo_received: '📷 Снимката е получена, чета касовата бележка…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Бележката чака в кутията за преглед (статус: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Бележката е запазена, но сумата не можа да бъде прочетена. Тя чака в кутията за преглед.',
  receipt_photo_failed:
    'Снимката не можа да бъде обработена. Опитайте отново или я качете в уеб приложението.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} записано. Изберете категория в кутията за преглед.',
  expense_text_unparsed: 'Не намерих сума. Опитайте например „кафе 4.50“ или „такси 15 EUR“.',
  expense_text_failed: 'Разходът не можа да бъде записан. Опитайте отново.',
  delete_button: '🗑 Изтрий',
  deleted: 'Изтрито.',
  delete_failed: 'Неуспешно изтриване.',
  inbound_help:
    'Можете също:\n• да изпратите снимка на касова бележка — ще прочета сумата и ще я сложа в кутията за преглед\n• да напишете разход: „кафе 4.50“, „такси 15 EUR“\n• да изпратите извлечение в PDF — то отива за импорт',
};

const hr: TranslationMap = {
  connected: '✅ Telegram je povezan. Izvještaje ćemo slati u ovaj razgovor.',
  link_expired:
    '⚠️ Poveznica je istekla ili je već iskorištena. Ponovno pritisnite „Poveži” u Lumiju.',
  start_greeting: `👋 Bok! Ja sam ${APP_NAME} bot. Da biste povezali ovaj razgovor, otvorite Postavke → Obavijesti u Lumiju i pritisnite „Poveži” pokraj Telegrama.`,
  unknown_command: 'Nepoznata naredba. Koristite /help za popis naredbi.',
  telegram_id_unknown: 'Vaš Telegram ID nije bilo moguće odrediti. Pokušajte kasnije.',
  not_connected: `Ovaj razgovor još nije povezan s ${APP_NAME} računom. Otvorite Postavke → Obavijesti u Lumiju i pritisnite „Poveži” pokraj Telegrama.`,
  report_failed: 'Izvještaj nije bilo moguće poslati. Pokušajte kasnije.',
  document_telegram_id_unknown:
    '⚠️ Vaš Telegram ID nije bilo moguće odrediti. Pošaljite /start i pokušajte ponovno.',
  document_pdf_only: 'Podržani su samo izvodi u PDF-u.',
  document_received: '📥 Datoteka primljena, obrada je počela...',
  document_processed: `✅ Datoteka je prihvaćena i u redu je za obradu. Status: {{status}}. Rezultat pogledajte u web aplikaciji ${APP_NAME}.`,
  document_failed:
    'Datoteku nije bilo moguće obraditi. Pokušajte kasnije ili je prenesite putem web aplikacije.',
  help: `Dostupne naredbe:\n/start — kako povezati ovaj razgovor s aplikacijom ${APP_NAME}\n/help — ova pomoć\n/report — današnji dnevni izvještaj\n/report GGGG-MM-DD — izvještaj za određeni datum\n/report monthly — izvještaj za tekući mjesec\n/goals — napredak vaših ciljeva štednje\n/networth — vaša trenutna neto vrijednost`,
  daily_header: '📅 Dnevni izvještaj — {{date}}',
  income_line: '➕ Prihodi: {{amount}} ({{count}})',
  expense_line: '➖ Troškovi: {{amount}} ({{count}})',
  daily_total: '📊 Ukupno za dan: {{amount}}',
  top_income_header: 'Najveće druge strane po prihodu:',
  top_expense_header: 'Najveće kategorije troškova:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Izvještaj za {{period}}',
  monthly_income: '➕ Prihodi: {{amount}}',
  monthly_expense: '➖ Troškovi: {{amount}}',
  monthly_diff: '📊 Razlika: {{amount}} ({{count}} transakcija)',
  top_categories_header: 'Najveće kategorije troškova:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Najveće druge strane:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Ciljevi štednje',
  goals_empty: `Još nema ciljeva. Napravite jedan u web aplikaciji ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Neto vrijednost: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) u razdoblju',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) u razdoblju',
  networth_change_no_percent: 'Promjena u razdoblju: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % imovine je u srednjem/visokom riziku — iznad praga od {{threshold}} %',
  insight_digest_header: '🔔 Nova obavijest Lumija',
  receipt_photo_received: '📷 Fotografija primljena, čitam račun…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Račun čeka u sandučiću za pregled (status: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Račun je spremljen, ali iznos nije bilo moguće pročitati. Čeka u sandučiću za pregled.',
  receipt_photo_failed:
    'Fotografiju nije bilo moguće obraditi. Pokušajte ponovno ili je učitajte u web-aplikaciji.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} zabilježeno. Odaberite kategoriju u sandučiću za pregled.',
  expense_text_unparsed: 'Nisam pronašao iznos. Pokušajte npr. „kava 4.50” ili „taksi 15 EUR”.',
  expense_text_failed: 'Trošak nije bilo moguće zabilježiti. Pokušajte ponovno.',
  delete_button: '🗑 Izbriši',
  deleted: 'Izbrisano.',
  delete_failed: 'Brisanje nije uspjelo.',
  inbound_help:
    'Možete i:\n• poslati fotografiju računa — pročitat ću iznos i staviti ga u sandučić za pregled\n• upisati trošak: „kava 4.50”, „taksi 15 EUR”\n• poslati izvod u PDF-u — ide na uvoz',
};

const sr: TranslationMap = {
  connected: '✅ Telegram је повезан. Извештаје ћемо слати у овај чет.',
  link_expired: `⚠️ Веза је истекла или је већ искоришћена. Поново притисните „Повежи” у ${APP_NAME}-у.`,
  start_greeting: `👋 Здраво! Ја сам ${APP_NAME} бот. Да бисте повезали овај чет, отворите Поставке → Обавештења у ${APP_NAME}-у и притисните „Повежи” поред Telegram-а.`,
  unknown_command: 'Непозната команда. Користите /help за списак команди.',
  telegram_id_unknown: 'Ваш Telegram ID није могуће одредити. Пробајте касније.',
  not_connected: `Овај чет још није повезан са ${APP_NAME} налогом. Отворите Поставке → Обавештења у ${APP_NAME}-у и притисните „Повежи” поред Telegram-а.`,
  report_failed: 'Извештај није могуће послати. Пробајте касније.',
  document_telegram_id_unknown:
    '⚠️ Ваш Telegram ID није могуће одредити. Пошаљите /start и пробајте поново.',
  document_pdf_only: 'Подржани су само изводи у PDF-у.',
  document_received: '📥 Датотека примљена, обрада је почела...',
  document_processed: `✅ Датотека је прихваћена и у реду је за обраду. Статус: {{status}}. Резултат погледајте у веб апликацији ${APP_NAME}.`,
  document_failed:
    'Датотеку није могуће обрадити. Пробајте касније или је пренесите преко веб апликације.',
  help: `Доступне команде:\n/start — како да повежете овај чет са ${APP_NAME}-ом\n/help — ова помоћ\n/report — данашњи дневни извештај\n/report ГГГГ-ММ-ДД — извештај за одређени датум\n/report monthly — извештај за текући месец\n/goals — напредак ваших циљева штедње\n/networth — ваша тренутна нето вредност`,
  daily_header: '📅 Дневни извештај — {{date}}',
  income_line: '➕ Приходи: {{amount}} ({{count}})',
  expense_line: '➖ Трошкови: {{amount}} ({{count}})',
  daily_total: '📊 Укупно за дан: {{amount}}',
  top_income_header: 'Највеће друге стране по приходу:',
  top_expense_header: 'Највеће категорије трошкова:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Извештај за {{period}}',
  monthly_income: '➕ Приходи: {{amount}}',
  monthly_expense: '➖ Трошкови: {{amount}}',
  monthly_diff: '📊 Разлика: {{amount}} ({{count}} трансакција)',
  top_categories_header: 'Највеће категорије трошкова:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Највеће друге стране:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Циљеви штедње',
  goals_empty: `Још нема циљева. Направите један у веб апликацији ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Нето вредност: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) у периоду',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) у периоду',
  networth_change_no_percent: 'Промена у периоду: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % активе је у средњем/високом ризику — изнад прага од {{threshold}} %',
  insight_digest_header: '🔔 Ново обавештење Lumija',
  receipt_photo_received: '📷 Фотографија примљена, читам рачун…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Рачун чека у сандучету за преглед (статус: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Рачун је сачуван, али износ није могао да се прочита. Чека у сандучету за преглед.',
  receipt_photo_failed:
    'Фотографија није могла да се обради. Покушајте поново или је отпремите у веб апликацији.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} забележено. Изаберите категорију у сандучету за преглед.',
  expense_text_unparsed: 'Нисам пронашао износ. Покушајте нпр. „кафа 4.50” или „такси 15 EUR”.',
  expense_text_failed: 'Трошак није могао да се забележи. Покушајте поново.',
  delete_button: '🗑 Обриши',
  deleted: 'Обрисано.',
  delete_failed: 'Брисање није успело.',
  inbound_help:
    'Можете и:\n• да пошаљете фотографију рачуна — прочитаћу износ и ставити га у сандуче за преглед\n• да упишете трошак: „кафа 4.50”, „такси 15 EUR”\n• да пошаљете извод у PDF-у — иде на увоз',
};

const sl: TranslationMap = {
  connected: '✅ Telegram je povezan. Poročila bomo pošiljali v ta klepet.',
  link_expired:
    '⚠️ Povezava je potekla ali je bila že uporabljena. V Lumiu znova pritisnite »Poveži«.',
  start_greeting: `👋 Živjo! Sem bot ${APP_NAME}. Če želite povezati ta klepet, v Lumiu odprite Nastavitve → Obvestila in pri Telegramu pritisnite »Poveži«.`,
  unknown_command: 'Neznan ukaz. Seznam ukazov prikažete z /help.',
  telegram_id_unknown: 'Vašega Telegram ID ni bilo mogoče določiti. Poskusite pozneje.',
  not_connected: `Ta klepet še ni povezan z računom ${APP_NAME}. V Lumiu odprite Nastavitve → Obvestila in pri Telegramu pritisnite »Poveži«.`,
  report_failed: 'Poročila ni bilo mogoče poslati. Poskusite pozneje.',
  document_telegram_id_unknown:
    '⚠️ Vašega Telegram ID ni bilo mogoče določiti. Pošljite /start in poskusite znova.',
  document_pdf_only: 'Podprti so samo izpiski v PDF.',
  document_received: '📥 Datoteka prejeta, obdelava se je začela...',
  document_processed: `✅ Datoteka je sprejeta in v vrsti za obdelavo. Stanje: {{status}}. Rezultat poglejte v spletni aplikaciji ${APP_NAME}.`,
  document_failed:
    'Datoteke ni bilo mogoče obdelati. Poskusite pozneje ali jo naložite v spletni aplikaciji.',
  help: `Razpoložljivi ukazi:\n/start — kako povezati ta klepet z aplikacijo ${APP_NAME}\n/help — ta pomoč\n/report — današnje dnevno poročilo\n/report LLLL-MM-DD — poročilo za določen datum\n/report monthly — poročilo za tekoči mesec\n/goals — napredek vaših ciljev varčevanja\n/networth — vaša trenutna neto vrednost`,
  daily_header: '📅 Dnevno poročilo — {{date}}',
  income_line: '➕ Prihodki: {{amount}} ({{count}})',
  expense_line: '➖ Stroški: {{amount}} ({{count}})',
  daily_total: '📊 Skupaj za dan: {{amount}}',
  top_income_header: 'Največje nasprotne stranke po prihodku:',
  top_expense_header: 'Največje kategorije stroškov:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Poročilo za {{period}}',
  monthly_income: '➕ Prihodki: {{amount}}',
  monthly_expense: '➖ Stroški: {{amount}}',
  monthly_diff: '📊 Razlika: {{amount}} ({{count}} transakcij)',
  top_categories_header: 'Največje kategorije stroškov:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Največje nasprotne stranke:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Cilji varčevanja',
  goals_empty: `Še ni ciljev. Ustvarite enega v spletni aplikaciji ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Neto vrednost: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) v obdobju',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) v obdobju',
  networth_change_no_percent: 'Sprememba v obdobju: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % sredstev je v srednjem/visokem tveganju — nad pragom {{threshold}} %',
  insight_digest_header: '🔔 Novo obvestilo Lumia',
  receipt_photo_received: '📷 Fotografija prejeta, berem račun…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Račun čaka v nabiralniku za pregled (stanje: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Račun je shranjen, vendar zneska ni bilo mogoče prebrati. Čaka v nabiralniku za pregled.',
  receipt_photo_failed:
    'Fotografije ni bilo mogoče obdelati. Poskusite znova ali jo naložite v spletni aplikaciji.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} zabeleženo. Izberite kategorijo v nabiralniku za pregled.',
  expense_text_unparsed: 'Zneska nisem našel. Poskusite npr. »kava 4.50« ali »taksi 15 EUR«.',
  expense_text_failed: 'Stroška ni bilo mogoče zabeležiti. Poskusite znova.',
  delete_button: '🗑 Izbriši',
  deleted: 'Izbrisano.',
  delete_failed: 'Brisanje ni uspelo.',
  inbound_help:
    'Lahko tudi:\n• pošljete fotografijo računa — preberem znesek in ga dam v nabiralnik za pregled\n• vpišete strošek: »kava 4.50«, »taksi 15 EUR«\n• pošljete izpisek v PDF — gre v uvoz',
};

const mk: TranslationMap = {
  connected: '✅ Telegram е поврзан. Извештаите ќе ги испраќаме во овој разговор.',
  link_expired: `⚠️ Врската е истечена или веќе е искористена. Притиснете „Поврзи“ во ${APP_NAME} повторно.`,
  start_greeting: `👋 Здраво! Јас сум ботот на ${APP_NAME}. За да го поврзете овој разговор, отворете Поставки → Известувања во ${APP_NAME} и притиснете „Поврзи“ до Telegram.`,
  unknown_command: 'Непозната команда. Користете /help за список на команди.',
  telegram_id_unknown: 'Вашиот Telegram ID не можеше да се определи. Обидете се подоцна.',
  not_connected: `Овој разговор сè уште не е поврзан со сметка во ${APP_NAME}. Отворете Поставки → Известувања во ${APP_NAME} и притиснете „Поврзи“ до Telegram.`,
  report_failed: 'Извештајот не можеше да се испрати. Обидете се подоцна.',
  document_telegram_id_unknown:
    '⚠️ Вашиот Telegram ID не можеше да се определи. Испратете /start и обидете се повторно.',
  document_pdf_only: 'Поддржани се само изводи во PDF.',
  document_received: '📥 Датотеката е примена, обработката започна...',
  document_processed: `✅ Датотеката е примена и е во редица за обработка. Статус: {{status}}. Резултатот погледнете го во веб апликацијата ${APP_NAME}.`,
  document_failed:
    'Датотеката не можеше да се обработи. Обидете се подоцна или прикачете ја преку веб апликацијата.',
  help: `Достапни команди:\n/start — како да го поврзете овој разговор со ${APP_NAME}\n/help — оваа помош\n/report — денешниот дневен извештај\n/report ГГГГ-ММ-ДД — извештај за одреден датум\n/report monthly — извештај за тековниот месец\n/goals — напредок на вашите цели за штедење\n/networth — вашата тековна нето вредност`,
  daily_header: '📅 Дневен извештај — {{date}}',
  income_line: '➕ Приходи: {{amount}} ({{count}})',
  expense_line: '➖ Трошоци: {{amount}} ({{count}})',
  daily_total: '📊 Вкупно за денот: {{amount}}',
  top_income_header: 'Најголеми други страни по приход:',
  top_expense_header: 'Најголеми категории трошоци:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Извештај за {{period}}',
  monthly_income: '➕ Приходи: {{amount}}',
  monthly_expense: '➖ Трошоци: {{amount}}',
  monthly_diff: '📊 Разлика: {{amount}} ({{count}} трансакции)',
  top_categories_header: 'Најголеми категории трошоци:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Најголеми други страни:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Цели за штедење',
  goals_empty: `Сè уште нема цели. Создајте една во веб апликацијата ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Нето вредност: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) во периодот',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) во периодот',
  networth_change_no_percent: 'Промена во периодот: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % од активата е во среден/висок риск — над прагот од {{threshold}} %',
  insight_digest_header: `🔔 Ново известување од ${APP_NAME}`,
  receipt_photo_received: '📷 Фотографијата е примена, ја читам сметката…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Сметката чека во сандачето за преглед (статус: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Сметката е зачувана, но износот не можеше да се прочита. Чека во сандачето за преглед.',
  receipt_photo_failed:
    'Фотографијата не можеше да се обработи. Обидете се повторно или прикачете ја во веб-апликацијата.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} евидентирано. Изберете категорија во сандачето за преглед.',
  expense_text_unparsed: 'Не најдов износ. Обидете се на пр. „кафе 4.50“ или „такси 15 EUR“.',
  expense_text_failed: 'Трошокот не можеше да се евидентира. Обидете се повторно.',
  delete_button: '🗑 Избриши',
  deleted: 'Избришано.',
  delete_failed: 'Бришењето не успеа.',
  inbound_help:
    'Можете и:\n• да испратите фотографија од сметка — ќе го прочитам износот и ќе ја ставам во сандачето за преглед\n• да напишете трошок: „кафе 4.50“, „такси 15 EUR“\n• да испратите извод во PDF — оди на увоз',
};

const be: TranslationMap = {
  connected: '✅ Telegram падключаны. Будзем дасылаць зветы ў гэты чат.',
  link_expired: `⚠️ Спасылка састарэла або ўжо выкарыстана. Націсніце «Падключыць» у ${APP_NAME} яшчэ раз.`,
  start_greeting: `👋 Прывітанне! Я бот ${APP_NAME}. Каб падключыць гэты чат, адкрыйце ў ${APP_NAME} Налады → Апавяшчэнні і націсніце «Падключыць» каля Telegram.`,
  unknown_command: 'Невядомая каманда. Скарыстайце /help, каб убачыць спіс камандаў.',
  telegram_id_unknown: 'Не ўдалося вызначыць ваш Telegram ID. Паспрабуйце пазней.',
  not_connected: `Гэты чат яшчэ не падключаны да акаўнта ${APP_NAME}. Адкрыйце ў ${APP_NAME} Налады → Апавяшчэнні і націсніце «Падключыць» каля Telegram.`,
  report_failed: 'Не ўдалося даслаць звет. Паспрабуйце пазней.',
  document_telegram_id_unknown:
    '⚠️ Не ўдалося вызначыць ваш Telegram ID. Дашліце /start і паспрабуйце зноў.',
  document_pdf_only: 'Падтрымліваюцца толькі выпіскі ў PDF.',
  document_received: '📥 Файл атрыманы, апрацоўка пачалася...',
  document_processed: `✅ Файл прыняты і стаў у чаргу на апрацоўку. Стан: {{status}}. Вынік гляньце ў вэб-дадатку ${APP_NAME}.`,
  document_failed:
    'Не ўдалося апрацаваць файл. Паспрабуйце пазней або загрузіце яго праз вэб-дадатак.',
  help: `Даступныя каманды:\n/start — як падключыць гэты чат да ${APP_NAME}\n/help — гэтая даведка\n/report — сённяшні дзённы звет\n/report ГГГГ-ММ-ДД — звет за пэўную дату\n/report monthly — звет за цяперашні месяц\n/goals — прагрэс вашых мэтаў заашчаджэння\n/networth — ваш цяперашні чысты капітал`,
  daily_header: '📅 Дзённы звет — {{date}}',
  income_line: '➕ Прыбыткі: {{amount}} ({{count}})',
  expense_line: '➖ Выдаткі: {{amount}} ({{count}})',
  daily_total: '📊 Разам за дзень: {{amount}}',
  top_income_header: 'Найбуйнейшыя кантрагенты па прыбытку:',
  top_expense_header: 'Найбуйнейшыя катэгорыі выдаткаў:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Звет за {{period}}',
  monthly_income: '➕ Прыбыткі: {{amount}}',
  monthly_expense: '➖ Выдаткі: {{amount}}',
  monthly_diff: '📊 Розніца: {{amount}} ({{count}} транзакцый)',
  top_categories_header: 'Найбуйнейшыя катэгорыі выдаткаў:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Найбуйнейшыя кантрагенты:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Мэты заашчаджэння',
  goals_empty: `Мэтаў пакуль няма. Створыце адну ў вэб-дадатку ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Чысты капітал: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) за перыяд',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) за перыяд',
  networth_change_no_percent: 'Змена за перыяд: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % актываў у сярэдняй/высокай рызыцы — вышэй за парог {{threshold}} %',
  insight_digest_header: `🔔 Новае апавяшчэнне ${APP_NAME}`,
  receipt_photo_received: '📷 Фота атрымана, чытаю чэк…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Чэк чакае ў скрыні праверкі (статус: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Чэк захаваны, але суму не ўдалося прачытаць. Ён чакае ў скрыні праверкі.',
  receipt_photo_failed:
    'Не ўдалося апрацаваць фота. Паспрабуйце яшчэ раз або загрузіце яго ў вэб-праграме.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} запісана. Выберыце катэгорыю ў скрыні праверкі.',
  expense_text_unparsed:
    'Я не знайшоў суму. Паспрабуйце, напрыклад, «кава 4.50» або «таксі 15 EUR».',
  expense_text_failed: 'Не ўдалося запісаць выдатак. Паспрабуйце яшчэ раз.',
  delete_button: '🗑 Выдаліць',
  deleted: 'Выдалена.',
  delete_failed: 'Не ўдалося выдаліць.',
  inbound_help:
    'Таксама можна:\n• даслаць фота чэка — я прачытаю суму і пакладу яго ў скрыню праверкі\n• напісаць выдатак: «кава 4.50», «таксі 15 EUR»\n• даслаць выпіску ў PDF — яна пойдзе ў імпарт',
};

const bs: TranslationMap = {
  connected: '✅ Telegram je povezan. Izvještaje ćemo slati u ovaj razgovor.',
  link_expired: '⚠️ Link je istekao ili je već iskorišten. Ponovo pritisnite „Poveži“ u Lumiju.',
  start_greeting: `👋 Zdravo! Ja sam ${APP_NAME} bot. Da biste povezali ovaj razgovor, otvorite Postavke → Obavještenja u Lumiju i pritisnite „Poveži“ pored Telegrama.`,
  unknown_command: 'Nepoznata komanda. Koristite /help za listu komandi.',
  telegram_id_unknown: 'Vaš Telegram ID nije moguće odrediti. Pokušajte kasnije.',
  not_connected: `Ovaj razgovor još nije povezan s ${APP_NAME} računom. Otvorite Postavke → Obavještenja u Lumiju i pritisnite „Poveži“ pored Telegrama.`,
  report_failed: 'Izvještaj nije moguće poslati. Pokušajte kasnije.',
  document_telegram_id_unknown:
    '⚠️ Vaš Telegram ID nije moguće odrediti. Pošaljite /start i pokušajte ponovo.',
  document_pdf_only: 'Podržani su samo izvodi u PDF-u.',
  document_received: '📥 Datoteka primljena, obrada je počela...',
  document_processed: `✅ Datoteka je prihvaćena i u redu je za obradu. Status: {{status}}. Rezultat pogledajte u web aplikaciji ${APP_NAME}.`,
  document_failed:
    'Datoteku nije moguće obraditi. Pokušajte kasnije ili je prenesite putem web aplikacije.',
  help: `Dostupne komande:\n/start — kako povezati ovaj razgovor s aplikacijom ${APP_NAME}\n/help — ova pomoć\n/report — današnji dnevni izvještaj\n/report GGGG-MM-DD — izvještaj za određeni datum\n/report monthly — izvještaj za tekući mjesec\n/goals — napredak vaših ciljeva štednje\n/networth — vaša trenutna neto vrijednost`,
  daily_header: '📅 Dnevni izvještaj — {{date}}',
  income_line: '➕ Prihodi: {{amount}} ({{count}})',
  expense_line: '➖ Troškovi: {{amount}} ({{count}})',
  daily_total: '📊 Ukupno za dan: {{amount}}',
  top_income_header: 'Najveće druge strane po prihodu:',
  top_expense_header: 'Najveće kategorije troškova:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Izvještaj za {{period}}',
  monthly_income: '➕ Prihodi: {{amount}}',
  monthly_expense: '➖ Troškovi: {{amount}}',
  monthly_diff: '📊 Razlika: {{amount}} ({{count}} transakcija)',
  top_categories_header: 'Najveće kategorije troškova:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Najveće druge strane:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Ciljevi štednje',
  goals_empty: `Još nema ciljeva. Napravite jedan u web aplikaciji ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Neto vrijednost: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) u periodu',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) u periodu',
  networth_change_no_percent: 'Promjena u periodu: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % imovine je u srednjem/visokom riziku — iznad praga od {{threshold}} %',
  insight_digest_header: '🔔 Nova obavijest Lumija',
  receipt_photo_received: '📷 Fotografija primljena, čitam račun…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Račun čeka u sandučetu za pregled (status: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Račun je sačuvan, ali iznos nije bilo moguće pročitati. Čeka u sandučetu za pregled.',
  receipt_photo_failed:
    'Fotografiju nije bilo moguće obraditi. Pokušajte ponovo ili je učitajte u web aplikaciji.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} zabilježeno. Odaberite kategoriju u sandučetu za pregled.',
  expense_text_unparsed: 'Nisam pronašao iznos. Pokušajte npr. „kafa 4.50” ili „taksi 15 EUR”.',
  expense_text_failed: 'Trošak nije bilo moguće zabilježiti. Pokušajte ponovo.',
  delete_button: '🗑 Izbriši',
  deleted: 'Izbrisano.',
  delete_failed: 'Brisanje nije uspjelo.',
  inbound_help:
    'Možete i:\n• poslati fotografiju računa — pročitat ću iznos i staviti ga u sanduče za pregled\n• upisati trošak: „kafa 4.50”, „taksi 15 EUR”\n• poslati izvod u PDF-u — ide na uvoz',
};

const hsb: TranslationMap = {
  connected: '✅ Telegram je zwjazany. Rozprawy pósćelemy do tutoho chata.',
  link_expired: `⚠️ Wotkaz je spadnjeny abo bu hižo wužity. Klikńće w ${APP_NAME} hišće raz na „Zwjazać“.`,
  start_greeting: `👋 Witaj! Sym bot ${APP_NAME}. Zo byšće tutón chat zwjazał, wočińće w ${APP_NAME} Nastajenja → Zdźělenki a klikńće pola Telegrama na „Zwjazać“.`,
  unknown_command: 'Njeznaty přikaz. Wužiwajće /help za lisćinu přikazow.',
  telegram_id_unknown: 'Waš Telegram-ID njeda so zwěsćić. Spytajće pozdźišo.',
  not_connected: `Tutón chat hišće njeje z kontom ${APP_NAME} zwjazany. Wočińće w ${APP_NAME} Nastajenja → Zdźělenki a klikńće pola Telegrama na „Zwjazać“.`,
  report_failed: 'Rozprawa njeda so pósłać. Spytajće pozdźišo.',
  document_telegram_id_unknown:
    '⚠️ Waš Telegram-ID njeda so zwěsćić. Pósćelće /start a spytajće hišće raz.',
  document_pdf_only: 'Podpěrane su jenož wupisy w PDF.',
  document_received: '📥 Dataja dóstata, předźěłanje je započało...',
  document_processed: `✅ Dataja je přiwzata a w rjedźe za předźěłanje. Status: {{status}}. Wuslědk sej wobhladajće we webappje ${APP_NAME}.`,
  document_failed: 'Dataja njeda so předźěłać. Spytajće pozdźišo abo nahrajće ju přez webapp.',
  help: `K dispoziciji stejace přikazy:\n/start — kak tutón chat z ${APP_NAME} zwjazać\n/help — tuta pomoc\n/report — dźensniša dnjowa rozprawa\n/report LLLL-MM-DD — rozprawa za wěsty datum\n/report monthly — rozprawa za nětčiši měsac\n/goals — postup wašich lutowanskich cilow\n/networth — waša nětčiša netto-hódnota`,
  daily_header: '📅 Dnjowa rozprawa — {{date}}',
  income_line: '➕ Dochody: {{amount}} ({{count}})',
  expense_line: '➖ Wudawki: {{amount}} ({{count}})',
  daily_total: '📊 Dohromady za dźeń: {{amount}}',
  top_income_header: 'Najwjetše přećiwne strony po dochodźe:',
  top_expense_header: 'Najwjetše kategorije wudawkow:',
  list_item: '{{index}}. {{name}} — {{amount}} ({{count}})',
  monthly_header: '🗓️ Rozprawa za {{period}}',
  monthly_income: '➕ Dochody: {{amount}}',
  monthly_expense: '➖ Wudawki: {{amount}}',
  monthly_diff: '📊 Rozdźěl: {{amount}} ({{count}} transakcijow)',
  top_categories_header: 'Najwjetše kategorije wudawkow:',
  category_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  top_counterparties_header: 'Najwjetše přećiwne strony:',
  counterparty_item: '{{index}}. {{name}} — {{amount}} ({{percent}} %)',
  goals_header: '🎯 Lutowanske cile',
  goals_empty: `Hišće žane cile. Załožće jedyn we webappje ${APP_NAME}.`,
  goal_item: '{{name}}: {{current}} / {{target}} {{currency}} ({{percent}} %)',
  networth_header: '📈 Netto-hódnota: {{value}} {{currency}}',
  networth_change_up: '▲ +{{amount}} {{currency}} (+{{percent}} %) w periodźe',
  networth_change_down: '▼ {{amount}} {{currency}} ({{percent}} %) w periodźe',
  networth_change_no_percent: 'Změna w periodźe: {{amount}} {{currency}}',
  networth_risky_warning:
    '⚠️ {{percent}} % aktiwow je w srjedźnym/wysokim riziku — nad pragom {{threshold}} %',
  insight_digest_header: `🔔 Nowe zdźělenje ${APP_NAME}`,
  receipt_photo_received: '📷 Foto dóstate, čitam kwitowanku…',
  receipt_photo_done:
    '🧾 {{vendor}} — {{amount}} {{currency}}. Kwitowanka čaka w kašćiku za přepruwowanje (status: {{status}}).',
  receipt_photo_unreadable:
    '🧾 Kwitowanka je składowana, ale sumy njeje so dało čitać. Čaka w kašćiku za přepruwowanje.',
  receipt_photo_failed:
    'Foto njeda so předźěłać. Spytajće hišće raz abo nahrajće jo we webowej aplikaciji.',
  expense_text_done:
    '✅ {{merchant}} — {{amount}} {{currency}} zapisane. Wubjerće kategoriju w kašćiku za přepruwowanje.',
  expense_text_unparsed: 'Njejsym sumu namakał. Spytajće na př. „kofej 4.50“ abo „taksi 15 EUR“.',
  expense_text_failed: 'Wudawk njeda so zapisać. Spytajće hišće raz.',
  delete_button: '🗑 Zhašeć',
  deleted: 'Zhašane.',
  delete_failed: 'Zhašenje njeje so poradźiło.',
  inbound_help:
    'Móžeće tež:\n• foto kwitowanki pósłać — čitam sumu a stajam ju do kašćika za přepruwowanje\n• wudawk napisać: „kofej 4.50“, „taksi 15 EUR“\n• wućah jako PDF pósłać — dźe do importa',
};

export const TELEGRAM_TRANSLATIONS: Record<string, TranslationMap> = {
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

/** Telegram's own per-user language_code, mapped down to a locale we ship. */
export function resolveTelegramLocale(languageCode?: string | null): string {
  const normalized = (languageCode ?? '').slice(0, 2).toLowerCase();
  return normalized in TELEGRAM_TRANSLATIONS ? normalized : 'en';
}

export function renderTelegramMessage(
  locale: string,
  key: TelegramMessageKey,
  params: Record<string, string | number> = {},
): string {
  const translations = TELEGRAM_TRANSLATIONS[locale] ?? TELEGRAM_TRANSLATIONS.en;
  const template = translations[key];
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ''));
}
