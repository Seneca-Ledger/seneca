# Банковская интеграция: на что жалуются в 2026 и можно ли сделать бесплатно

Дата: 2026-10-02. Статус: исследование, ничего не реализовано.
Дополняет `2026-10-01-user-expectations-2026-research-plan.md` (боль 3.1 и фаза 3.1) — там тема была закрыта одним абзацем, здесь разобрана до цен, лицензий и требований к коду.

## 1. Главный вывод

**Бесплатно — да, но только в одной форме: у каждого self-hosted пользователя своё личное приложение у провайдера, со своими ключами, на свои счета.** Все бесплатные тиры 2026 устроены одинаково, и это не совпадение: бесплатно = свои счета + один пользователь + приложение нельзя публиковать. Lumio self-hosted идеально попадает в эту рамку; Lumio как облачный мульти-тенант SaaS — не попадает ни в один бесплатный тир, там всегда контракт и KYB.

Три реально бесплатных варианта (0 €/$ и для нас, и для пользователя):

| Провайдер | Регион | Что бесплатно | Ограничение |
|---|---|---|---|
| Enable Banking «restricted production» | EU/EEA (**без UK**) | без контракта, свои счета | только счета, которые владелец аккаунта сам прилинковал в их панели; одно приложение = один человек |
| Akahu «Personal App» (Tier 0) | NZ | свои данные бесплатно | 1 пользователь, только свой аккаунт Akahu |
| Teller free developer tier | US | 100 **живых** подключений | US-банки; порог rate limit не документирован |

Почти бесплатные — платит пользователь, не мы:

| Провайдер | Регион | Цена пользователю |
|---|---|---|
| SimpleFIN Bridge | US/Canada | $1.50/мес или **$15/год**, до 25 институтов и 25 приложений |
| LunchFlow | 30+ стран (GoCardless, Finicity, MX, Akahu, SnapTrade под капотом) | $2.92/мес или **$34.99/год** за 2 подключения, +$10 за каждое следующее |

Чего больше нет и не будет: **GoCardless Bank Account Data (бывший Nordigen) закрыт для новых аккаунтов** — тот самый бесплатный EU-тир, на котором держался весь инди-сегмент. Существующие аккаунты работают, новые не выдают. Plaid бесплатен только как «Limited Production»: 200 вызовов API на продукт с живыми данными — на продукт не годится, публичных цен Plaid не печатает вообще.

**Наши родные регионы не покрыты никем.** Израиль: доступ к банковским данным требует лицензии поставщика услуг финансовой информации, регулятор — ISA; обязательства для платёжных компаний вступают в силу 2026-06-06, с обсуждаемым трёхлетним исключением. Казахстан: Open API существует (NBK/НПКК, концепция 2023–2025, продуктовые API «к 2026»), но self-serve доступа для сторонних разработчиков нет — это инфраструктура банк-к-банку. Для KZ/IL остаётся файловый импорт, и это надо писать прямо, а не оставлять надеяться.

## 2. На что жалуются в 2026 (свежий срез)

Собрано из r/MonarchMoney, r/ynab, r/copilotmoney, r/selfhosted, r/eupersonalfinance, r/UKPersonalFinance, r/budget за 2026-06-01 … 2026-10-01 (1365 постов, 169 про синхронизацию) + открытые issues `actualbudget/actual`. Срез дополняет прошлый, не повторяет его.

### 2.1 Отвалы и реавторизация — всё ещё причина №1 уходить
«These broken connections are killing me!!!» (48↑/40 комм.). Топ-комментарий: отвалы как таковые терпимы, непереносимо другое — «The duplication when certain accounts are reconnected … is where it goes from an annoyance to "now my data is effed up"». Второй по голосам: «mine will say the connection is fine yet hasn't synced in 4 days». Отдельная механика: слияние Capital One/Discover выбило постоянные дисконнекты в YNAB — консолидация банков ломает коннекторы, и приложение за это не отвечает, но отвечает перед пользователем.

### 2.2 Дубли при переподключении и при смене провайдера
Это не теория: после UI смены провайдера в Monarch пользователь получил «well over 100+ duplicate transactions, including some that are parsed differently (i.e. came through as a day later, but are clearly still the same transaction)». Ответ команды Monarch честный и важный для нас: «Each data provider can send the same data in different ways, which tbh, is a bit maddening… if the data providers send data in different ways or with different dates, it'll be a merge of old data with new data which could look different». Отдельно подтверждён сдвиг дат между провайдерами: MX и Finicity на одной и той же карте дают даты, отличающиеся на день.

Практическое следствие: **дедуп по id провайдера недостаточен в принципе.** Нужен fuzzy-матч (дата ±N дней, сумма, похожесть описания), иначе смена провайдера или переподключение = порча данных.

### 2.3 Pending → booked меняет id
Самый коварный класс. В Actual по Enable Banking: у части банков `entry_reference` (наш `document_number`) у транзакции в статусе pending один, а после проводки — другой, то есть одна покупка приезжает дважды с разными «стабильными» ключами. Enable Banking прямо отвечает: «We don't influence or manipulate the data, so it comes from the bank». Плюс: pending-транзакции импортируются даже при выключенной настройке (банк не отдаёт статус), приезжают помеченными как cleared, с payee «Pending transaction» и неверной датой.

### 2.4 Тихие ошибки — отдельная боль, не подвид отвалов
- SimpleFIN держал счёт в состоянии «We are upgrading this connection» **шесть недель**, Actual всё это время показывал зелёную точку синхронизации: «I wasn't aware of this because Actual does not surface an error».
- Enable Banking: booked-транзакция молча пропущена при импорте, в логах только `POST 200`, баланс разошёлся ровно на 5.00 EUR. Автор issue: «no error in the UI… that is part of the problem».
- Баг пагинации: страница добавлялась в результат **до** проверки повторяющегося `continuation_key` → каждая транзакция создавалась дважды при первом же импорте в пустой счёт.

Вывод: «синк прошёл» и «данные полные» — разные утверждения, и UI обязан различать их.

### 2.5 Лимиты запросов и срок согласия
- «I get an error if I try to sync more than four times for a certain bank, and then the only option Actual gives me is to unlink and relink» — лимит провайдера превращается в требование полной перелинковки.
- Срок согласия: потолок RTS PSD2 — 180 дней (продлён с 90), но банки по умолчанию ставят 90. У GoCardless есть «consent reconfirmation» с `max_access_valid_for_days_reconfirmation` до 730 дней, но клиент должен запросить именно это поле. Цена ошибки в цифрах из issue: «Across three banks and two budgets in my household that is about 24 re-authentications a year, and a lapse is silent until the nightly sync starts failing».
- FIDA (регулирование open finance в EU), которое должно было это упростить, с начала 2026 застряло: трилоги приостановлены, реалистичная дата — 2027.

### 2.6 Агрегатор — это политический риск, а не только технический
Copilot запустил MCP-бету и **потерял доступ к данным Plaid-подключений внутри неё**. Ответ команды Copilot: «I can't share details, but this isn't a change we wanted to make». Пользователи: «Almost all my accounts are via plaid, i was really excited for this but now it's basically pointless». Параллельно в r/MonarchMoney: «the data aggregators prevented monarch from creating the mcp».
Фон: 2026-05-15 OpenAI выпустил персональные финансы в ChatGPT (preview, Pro, US) — подключение счетов именно через Plaid, 12 000+ институтов, дашборд расходов/подписок/портфеля. Часть пользователей Monarch ушла туда. Их главная претензия к ChatGPT Finance и есть наше преимущество: «there's no way to correct it in any sort of permanent log, unlike with Monarch» — то есть исправленная категория никуда не запоминается.

### 2.7 Бесплатные тиры подкидывают сюрпризы при онбординге
Реальные грабли self-hosted пользователей Enable Banking за сентябрь 2026:
- UK-банки в бесплатном тире **не поддерживаются** — узнают после настройки, в селекторе страны просто пусто. «I thought they did support UK based on their website».
- Счета надо **сначала прилинковать в панели провайдера**, иначе приложение «думает», что настроено, и ничего не видит. Несколько человек потеряли на этом дни.
- Пара с общим бюджетом не может работать на одном приложении: «Enable Banking's personal/restricted mode only allows an application to access accounts that belong to the Control Panel user who linked them» — у каждого свой национальный ID (MitID), значит нужно N приложений на один workspace.
- Исходящий firewall на сервере даёт точно ту же картину, что и неправильная настройка.
- Качество покрытия неровное: кредитки не отдаются как счёт (Banca Sella, Италия), знак суммы перевёрнут (Zagrebačka banka, Хорватия), payee для карточных платежей = сам владелец счёта, когда `creditor` пуст (CBC/KBC, Бельгия), Trade Republic отдаёт суммы без payee.

### 2.8 Файловый импорт перестал быть «для отстающих»
YNAB в сентябре 2026 выкатил встроенный CSV-маппинг, очистку payee и категоризацию при импорте файлов — и получил 78↑ с благодарностями именно за это. Главный запрос в комментариях: «I would love if the import would use the transaction date, rather than the posting date». Это прямо наша поляна, и это подтверждает, что ставка на импорт — не компромисс.

## 3. Три модели и что выбрать

**A. Bring-your-own personal app (бесплатно для всех).** Пользователь сам регистрируется у провайдера, создаёт личное приложение, вставляет ключи в Lumio. Enable Banking (EU), Akahu (NZ), Teller (US). Стоимость для нас — 0, юридически чисто: регулируемое лицо — провайдер, данные пользователь берёт свои. Цена — онбординг, и он тяжёлый: судя по разделу 2.7, именно здесь теряются люди.

**B. Bring-your-own paid account (платит пользователь).** SimpleFIN $15/год (NA, уже стандарт для Actual/Sure), LunchFlow $34.99/год (30+ стран, под капотом GoCardless/Finicity/MX/Akahu/SnapTrade, есть REST API и MCP). Онбординг в разы проще — один токен. Для нас тоже 0.

**C. Мы платим и ставим свой аккаунт.** Enable Banking/Plaid/Salt Edge по контракту, цены sales-gated, у Enable Banking с апреля 2026 даже прайс-лист снят в «Get a Quote», минимальный месячный инвойс. Для self-hosted продукта бессмысленно, для облака — отдельный бизнес с KYB и минимумами.

**Рекомендация: A + B, выбор провайдера на уровне счёта, строго как опция.** Это ровно то, что сделал Monarch («Now live: Get the best connection for your bank, without starting over» — 181↑, и отдельный тред «Blown away by how easy it was to switch providers» — 107↑). Позиционирование из фазы 3.1 («Lumio не держит собственную интеграцию с банками; вы подключаете свой аккаунт провайдера») остаётся верным и, что важнее, оказывается не оправданием, а единственной конфигурацией, в которой это бесплатно.

Порядок реализации по соотношению «польза/онбординг»: **SimpleFIN → LunchFlow → Enable Banking → Teller**. SimpleFIN уже написан. LunchFlow даёт 30+ стран за один токен и ближе всего к нашим пользователям вне US. Enable Banking — бесплатно, но самый дорогой онбординг. Teller закрывает US бесплатно, если его ToS допускает не-прототип (проверить до работы: на сайте формулировка «free for independent developers and teams prototyping ideas»).

Алгоритм смены провайдера без дублей — забрать у Monarch, он описан их же инженером: для каждого счёта найти последнюю транзакцию и сказать новому подключению синхронизироваться со следующего дня; новый провайдер всё равно отдаст полную историю, но всё старше этой даты отбрасывается на входе. **Per account, не per connection.**

## 4. Что это значит для нашего кода

На `feat/phase3-mobile-bank` уже есть `backend/src/modules/bank-sync/` (интерфейс `BankSyncProvider`, `SimpleFinProvider`, сборка OFX и прогон через `statementsService.create`, `BANK_SYNC_FETCH` как DI-токен, кредами в `encryptedSecrets`). Архитектура правильная: синк входит в обычный pipeline импорта, значит правила, стадии и аудит переиспользуются. Проверенные дыры относительно раздела 2:

1. **Дедуп только по id.** `bank-sync.service.ts:357-365` фильтрует по `transactions.document_number`. Fuzzy-дедуп (дата ±3 дня, сумма ±2 %, похожесть текста ≥0.75) существует в `IntelligentDeduplicationService` и подключён к пути import-session, а не к `statements.create`, которым ходит синк. Это ровно механика 2.2/2.3: смена провайдера или pending→booked даст дубли. Чинить до того, как появится второй провайдер.
2. **Pending.** Сейчас pending-строки отфильтрованы на входе. Это безопасно, но тогда нельзя обещать «видно сразу» — и нужен тест на банк, который не отдаёт статус вовсе (случай 2.3).
3. **Тихие ошибки.** `BankSyncAuthError` → `NEEDS_REAUTH` есть, но нет состояния «провайдер ответил 200, данные неполные» (случай SimpleFIN «upgrading connection» и молча пропущенной booked-транзакции). Нужны: сверка баланса провайдера с суммой импортированного и видимый «данные могут быть неполными», а не зелёная точка.
4. **Rate limit.** Нет обработки лимита провайдера; по 2.5 это не должно приводить к перелинковке — нужен backoff и внятное «попробуйте позже».
5. **Срок согласия.** Нет отслеживания истечения; для EU-провайдеров нужны дата истечения на счёте, предупреждение заранее и запрос более долгого согласия там, где провайдер его поддерживает.
6. **Один workspace — несколько приложений провайдера.** По 2.7 для пар это обязательное требование, а не роскошь: конфиг должен допускать N наборов ключей на workspace, а не один.
7. **Пагинация.** Проверить порядок «push страницы» против «проверка повторного курсора» — на этом Actual получил удвоение всех транзакций.

## 5. Открытые вопросы

1. Облако: если у Lumio появится хостед-вариант, бесплатных тиров там нет вообще. Остаёмся ли self-hosted-only для bank sync и пишем это в UI?
2. Teller: допускает ли их ToS продакшн-использование free dev tier не-прототипом? Без этого «US бесплатно» превращается в «US за $0.30 с подключения в месяц».
3. LunchFlow: даёт ли индивидуальный план ($34.99/год) персональный API-ключ, или REST API только в плане для разработчиков? Их док этого не говорит, вопрос в hello@lunchflow.app / Discord.
4. KZ/IL: подтверждаем ли официально «только файлы» в README и доках, чтобы не создавать ложных ожиданий?

## 6. Источники

Первичные: [Enable Banking FAQ](https://enablebanking.com/docs/faq/), [Actual Budget: Bank Sync](https://actualbudget.org/docs/advanced/bank-sync/), [SimpleFIN Bridge](https://beta-bridge.simplefin.org/), [Teller](https://teller.io/), [Teller API docs](https://teller.io/docs/api), [Plaid Pricing (US/CA)](https://plaid.com/pricing/), [LunchFlow](https://www.lunchflow.app/), [Akahu Personal Apps](https://developers.akahu.nz/docs/personal-apps), [Akahu App Accreditation](https://developers.akahu.nz/docs/app-accreditation), [NBK: Open API, Open Banking](https://nationalbank.kz/en/page/Digital-Financial-Infrastructure), [НПКК: Open banking system](https://npck.kz/en/open-banking-system/).

Issues (первичные): [actual #8846 дубли на continuation_key](https://github.com/actualbudget/actual/issues/8846), [#9063 молча пропущенная booked-транзакция](https://github.com/actualbudget/actual/issues/9063), [#7333 SimpleFIN «upgrading connection»](https://github.com/actualbudget/actual/issues/7333), [#9006 730-дневное согласие вместо 90](https://github.com/actualbudget/actual/issues/9006), [#9005 порядок кандидатов при fuzzy-матче](https://github.com/actualbudget/actual/issues/9005), [#7799 фидбек по Enable Banking (167 комм.)](https://github.com/actualbudget/actual/issues/7799), [sure #2530 про UK в бесплатном тире](https://github.com/we-promise/sure/discussions/2530).

Reddit (через архив Arctic Shift, ссылки на оригиналы): [These broken connections are killing me](https://www.reddit.com/r/MonarchMoney/comments/1wp1y1e/), [Now live: get the best connection for your bank](https://www.reddit.com/r/MonarchMoney/comments/1wsfbv1/), [Blown away by how easy it was to switch providers](https://www.reddit.com/r/MonarchMoney/comments/1wospde/), [Upgraded to Pro for the MCP… ChatGPT launched its own finance product](https://www.reddit.com/r/MonarchMoney/comments/1wb1sgy/), [Just focus on the Connectors](https://www.reddit.com/r/MonarchMoney/comments/1wk3jwk/), [Copilot MCP beta dropping Plaid-connected accounts](https://www.reddit.com/r/copilotmoney/comments/1ueh4lv/), [YNAB: Improvements to File Import](https://www.reddit.com/r/ynab/comments/1wh3mqr/), [Capital One / Discover merger → constant reauthorization](https://www.reddit.com/r/ynab/comments/1wlp3e5/).

Рынок и регулирование: [TechCrunch: OpenAI launches ChatGPT for personal finance](https://techcrunch.com/2026/05/15/openai-launches-chatgpt-for-personal-finance-will-let-you-connect-bank-accounts/), [Projective Group: период аутентификации AIS продлён до 180 дней](https://www.projectivegroup.com/psd2-alert-authentication-period-for-account-information-services-extended-to-180-days/), [Plaid: 180 days of connectivity in Europe](https://plaid.com/blog/eu-reauth-update/), [Times of Israel: Israel's open banking reform](https://www.timesofisrael.com/spotlight/israels-open-banking-reform-kicks-off-in-june/), [Herzog: директива для платёжных компаний (вступление 2026-06-06)](https://herzoglaw.co.il/en/news-and-insights/draft-directive-for-payment-companies-regarding-the-implementation-of-an-open-banking-standard-published-for-public-comments/), [Konsentus: FIDA readiness](https://www.konsentus.com/fida-readiness-series-how-fida-transforms-data-access/).

Вторичные (обзорный кластер, цифры оттуда не брал без первичного подтверждения): [Free & Indie Open Banking APIs 2026](https://www.openbankingtracker.com/guides/free-open-banking-apis), [GoCardless Bank Account Data alternatives](https://dev.to/johnfrandsen/gocardless-bank-account-data-alternatives-what-to-use-when-signups-are-disabled-326d), [Salt Edge на Open Banking Tracker](https://www.openbankingtracker.com/salt-edge).
