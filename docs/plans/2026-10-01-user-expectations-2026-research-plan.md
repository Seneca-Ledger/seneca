# Ожидания пользователей финансовых приложений в 2026 и план для Lumio

Дата: 2026-10-01. Статус: исследование + план, ничего не реализовано.

## 1. Резюме

Главные боли пользователей в 2026 году не про «ещё одну фичу», а про **доверие и усилие**: сломанная синхронизация, ИИ-категоризация, которая портит данные и которую нельзя выключить, дубли и переводы, посчитанные как расходы, усталость от ручной разборки транзакций, подписки с растущей ценой, тиры и реклама внутри оплаченного продукта, постоянная смена UI. Параллельно рынок (Monarch, YNAB, Copilot, Actual, Sure) за год стандартизировал набор: ИИ-ассистент поверх данных, MCP-доступ для внешних агентов, скан чеков с разбивкой по позициям, прогноз кэшфлоу со сценариями, цели с гибким фондированием, публичный roadmap и release notes.

У Lumio сильная база: импорт файлов, OCR чеков, правила + ИИ + обучение, дедуп, подписки, цели, бюджеты, инвойсы, леджер, VAT/подоходный налог, MCP-сервер, локальная LLM, 21 локаль, self-hosting. Дыры ровно там, где у людей болит сильнее всего: нет сопоставления переводов между счетами, нет «входящей очереди» с быстрой разборкой, нет rollover в бюджетах, нет прогноза кэшфлоу, нет инвестиций вне крипты, нет push/offline, нет захвата расходов через Telegram, нет варианта банковской синхронизации даже как опции, и интерфейс показывает 16 разделов всем сразу.

План ниже разбит на четыре фазы. Фаза 0 (3–4 недели) закрывает «доверие к данным» и ничего не ломает в позиционировании. Фаза 1 (6–8 недель) снимает усталость от ручной работы. Фаза 2 (8–10 недель) добавляет планирование вперёд. Фаза 3 (по решению) открывает опциональную синхронизацию с банками и мобильный слой.

## 2. Метод и источники

Reddit напрямую закрыт для инструментов (WebFetch, встроенный браузер), Pullpush прямо запрещает агентский доступ. Данные взяты из архива Arctic Shift (публичный API), затем вручную отобраны треды и прочитаны топовые комментарии.

| Источник | Объём |
|---|---|
| Посты за 12 месяцев (окт 2025 – сен 2026) | 11 356 постов: r/ynab 4000, r/MonarchMoney 3000, r/budget 2000, r/copilotmoney 684, r/smallbusiness 500, r/Bookkeeping 300, r/personalfinance 300, r/selfhosted 233, r/eupersonalfinance 162, r/povertyfinance 100, r/UKPersonalFinance 57, r/Fire 20 |
| Треды с прочитанными комментариями | 21 тред (топ-комментарии по score) |
| GitHub issues по +1 | actualbudget/actual, firefly-iii/firefly-iii, we-promise/sure (топ-40 каждого) |
| Hacker News 2025–2026 | 40 тредов о personal finance apps, 5 прочитаны |
| Прочее | Trustpilot Monarch, release notes Monarch/YNAB/Actual 2026, обзоры «что рекомендует Reddit», EU-обзоры, провайдеры open banking |

Ограничения. r/actualbudget в архиве отсутствует (покрыт GitHub issues). Поиск по r/personalfinance частично упёрся в таймауты API. r/ynab и r/MonarchMoney — самые громкие сообщества, поэтому часть тем (тиры, реклама) там перепредставлена. Ссылки на посты ниже — на reddit.com, читать через браузер.

Сырые данные: `scratchpad/posts.jsonl` (временная папка сессии), скрипт сбора `collect_reddit.sh`.

## 3. Что болит у пользователей в 2026 (ранжировано)

### 3.1 Синхронизация с банком ненадёжна, а без неё приложение «не живёт»

Самая частая тема во всех сообществах, при этом никто не доволен ни одним провайдером.

- «Account syncing is the product» — семья уходит из Monarch из-за отвалов, топ-ответ: все сидят на Plaid/MX/Finicity, бежать некуда. [r/MonarchMoney, 143↑/72 комм.](https://www.reddit.com/r/MonarchMoney/comments/1vujxdx/account_syncing_is_the_product/)
- Trustpilot Monarch (2.3★): «accounts disconnect every 3–4 weeks», «transactions missing and never recorded», «silent failures of incorrect data».
- Copilot: мелкие банки и кредитные союзы отваливаются, нужен ручной reconnect.
- UK: «Importing via Open Banking needs servers… even Actual Budget can no longer provide import as no one is prepared to provide it for free». GoCardless Bank Account Data закрыт для новых аккаунтов. [r/UKPersonalFinance, 47↑/92](https://www.reddit.com/r/UKPersonalFinance/comments/1sww8oq/alternatives_to_emma_budgeting_app/)
- HN: «the moat that I can't cross is the integration with my bank accounts»; Plaid pay-as-you-go ≈ $0.30/подключение/мес, SimpleFIN Bridge $15/год, Enable Banking бесплатен в «restricted production» для своих счетов.
- Положительный пример: Monarch «switch provider without starting over» — выбор провайдера на уровне аккаунта. [181↑/47](https://www.reddit.com/r/MonarchMoney/comments/1wsfbv1/now_live_get_the_best_connection_for_your_bank/)

Lumio: банковских API нет по дизайну (README «What Lumio is NOT»). Это осознанная позиция, но она должна быть компенсирована лучшим в классе файловым импортом и, как минимум, обсуждена опциональная «bring your own provider» синхронизация (раздел 6, фаза 3).

### 3.2 ИИ-категоризация и переименование мерчантов портят данные, и их нельзя выключить

- «Automatic categorization keeps getting worse… AI slop that can't be turned off. I already set up rules myself so why are you bypassing them». [r/MonarchMoney, 118↑/53](https://www.reddit.com/r/MonarchMoney/comments/1tch4tb/automatic_categorization_keeps_getting_worse/)
- «McDonald's Los Angeles CA» переименован в «Los Angeles CA»; просят опцию отключить переименование и всегда хранить оригинальную строку. [90↑/62](https://www.reddit.com/r/MonarchMoney/comments/1uq0hl4/why_is_merchant_renaming_so_bad_option_to_disable/)
- YNAB публично поменял алгоритм: одно разовое исключение больше не переопределяет категорию payee, нужно 2 из 3 последних транзакций. [372↑/66](https://www.reddit.com/r/ynab/comments/1vrt3ac/update_were_adjusting_how_autocategorization_works/)
- Copilot: правила нельзя увидеть и отредактировать в UI, только через поддержку.
- Ожидание: правила детерминированы и первичны, ИИ — fallback, виден ответ «почему так категоризовано», есть глобальный выключатель, оригинал мерчанта сохраняется.

Lumio: есть правила, ИИ-классификатор, обучение по мерчанту (`category-learning`), эмбеддинги. Нет: явного порядка приоритетов в UI, объяснения «почему», глобального переключателя ИИ на категоризацию, защиты обучения от разовых исключений, массовой переклассификации (TODO в `backend/src/modules/classification/services/classification.service.ts:658`).

### 3.3 Дубли и переводы между своими счетами считаются расходами

- Monarch: «duplicate transaction bug with shared cards», отдельный пост продакта об исчезающих правках и дублях. [100↑/47](https://www.reddit.com/r/MonarchMoney/comments/1uqy1ey/disappearing_edits_and_duplicate_transactions/)
- Dollarwise «double or triple counts expenditures… counts everything leaving an account as expenditure». [r/povertyfinance, 43↑](https://www.reddit.com/r/povertyfinance/comments/1t1j7j7/if_you_are_here_please_dont_fall_into_trash/)
- YNAB: перевод на брокерский счёт показан как трата, отчёт «income vs expense» бесполезен. [311↑/79](https://www.reddit.com/r/ynab/comments/1t3orb1/thank_you_ynab_for_this_extremely_unhelpful_chart/)
- Sure issues: «Expenses doubling (transfers to a credit account counted as expenses)», «Treat investment contributions as transfers». Firefly: «Money Transfer Fees».
- YNAB: «pair transactions for reimbursements» (я заплатил, партнёр вернул половину). [32↑/45](https://www.reddit.com/r/ynab/comments/1q49vl9/wishlist_of_features_for_2026/)

Lumio: дедуп по fingerprint и между выписками есть. Нет парного сопоставления переводов между счетами (поиск по `transfer` в `modules/transactions` пуст), нет связки «расход ↔ возмещение».

### 3.4 Усталость от ручной разборки: «keeping everything categorized feels like work»

- HN: «I usually quit after a few months because keeping everything categorized and up to date feels like work, not help… the only features that mattered were reliable import, simple rules, and a clean mobile UI».
- r/ynab «You ever just… let yourself go?» — 151 неразобранная транзакция, выгорание после 17 лет. Лайфхаки из комментариев: сортировать по payee и массово назначать, в отпуске всё в одну категорию «Vacation». [209↑/72](https://www.reddit.com/r/ynab/comments/1u2hcnr/you_ever_justlet_yourself_go/)
- r/personalfinance: «the ones that expect constant manual input tend to get abandoned». [27↑/113](https://www.reddit.com/r/personalfinance/comments/1v6d2jj/if_you_actually_stuck_with_a_budgeting_app_what/)
- Ответ рынка: YNAB Card Mode (свайп approve/skip), bulk-select на экране approve. [157↑/77](https://www.reddit.com/r/ynab/comments/1wivgst/introducing_card_mode_an_additional_way_to_review/)

Lumio: стадии statement/receipt на сервере есть («Needs review»). Нет единого inbox-а с клавиатурной/свайп-разборкой, массовых действий по payee, auto-approve по уверенности и дайджеста «N ждут разбора».

### 3.5 Чеки, сплиты и семейные покупки

- «Pour one out for all of those trying to split and categorize your spouse's Target and Walmart purchases». Amazon разбивает заказ на 3 списания. [202↑/30](https://www.reddit.com/r/ynab/comments/1uk9tdx/its_the_end_of_the_month/)
- Monarch Receipt Scanner: фото → матч к транзакции → разбивка по позициям на категории. Copilot переделал split на web.
- r/Bookkeeping: инвойсы, вставленные в тело письма, а не вложением. [12↑](https://www.reddit.com/r/Bookkeeping/comments/1tdz2c2/best_way_to_extract_invoices_embedded_in_email/)
- r/selfhosted: ищут tool, который из чека вытащит позиции и посчитает расходы на продукты по категориям (29↑).

Lumio: чеки с позициями, GPS, Gmail/IMAP, `receipt.transactionId`. Нужно проверить, что матч чека к транзакции и авто-сплит по категориям позиций работают end-to-end, и что HTML-тело письма парсится как чек.

### 3.6 Подписки, годовые счета и рост цен

- «Budgeting yearly subscriptions is maddening» — цена растёт каждый год, люди держат «bills buffer» и надбавку 5–10%. [200↑/47](https://www.reddit.com/r/ynab/comments/1tddcxi/budgeting_yearly_subscriptions_is_maddening/)
- Monarch recurring: «so bad even for identical monthly charges», просят выключить назойливые предложения «review as recurring». [86↑](https://www.reddit.com/r/MonarchMoney/comments/1vtntd8/how_is_the_recurring_merchants_feature_so_bad/), [89↑/52](https://www.reddit.com/r/MonarchMoney/comments/1v5eibr/can_recurring_just_be_turned_off/)
- «Стоимость подписки за одно использование» зашла лучше, чем «отмените Netflix». [r/budget, 191↑](https://www.reddit.com/r/budget/comments/1uepobi/instead_of_monthly_price_i_worked_out_what_each/)
- Бизнес: «paid for the same software twice» — два человека продлили одну подписку разными способами. [r/Bookkeeping, 109↑](https://www.reddit.com/r/Bookkeeping/comments/1of1x8l/boss_said_we_need_to_communicate_more_after_we/)
- Нерегулярные крупные счета ломают месячный бюджет; UK-ответ — «pots» и ежемесячное накопление. [r/budget, 106↑/84](https://www.reddit.com/r/budget/comments/1wghyuv/how_do_you_budget_for_the_huge_expenses_that_only/), [r/UKPF](https://www.reddit.com/r/UKPersonalFinance/comments/1rnws4f/how_do_people_deal_with_bills_that_all_fall_on/)
- Хотят календарь предстоящих списаний. [r/ynab, 60↑/34](https://www.reddit.com/r/ynab/comments/1shkqxe/calendar_feature/)

Lumio: детекция подписок и статус `price_changed` есть. Нет: уведомления о дельте и годовом эффекте, детекции дублей подписок, «стоимости за использование», накопительного («sinking fund») бюджета, календаря списаний, выключателя подсказок.

### 3.7 Механика бюджета

- Rollover перерасхода в следующий месяц — «my only complaint». [57↑/67](https://www.reddit.com/r/ynab/comments/1pzrlz0/my_only_complaint_with_ynab_is_the_inability_to/); Sure issue «carry overspend forward».
- Цель типа «пополнять по X до Y, при тратах начинать снова» — самый популярный пункт wishlist (65↑ в комментариях).
- Подкатегории/подцели. [155↑/66](https://www.reddit.com/r/ynab/comments/1pjga6j/feature_request_subcategories/)
- «Vacation mode», категория-«буфер», предупреждение, что операция уведёт счёт в минус.

Lumio: лимиты по категории на период с алертами 80/100%, цели с планом. Нет rollover, нет «refill up to» цели, подкатегории в сущности есть (`category.parentId`), но в бюджетах не используются.

### 3.8 Планирование вперёд: прогноз, пенсия, net worth

- «I would love to see what my expenses would look like next month at current trajectory». [29↑/62](https://www.reddit.com/r/ynab/comments/1p10yz0/i_love_some_ynab_but_i_would_love_to_see_what_my/)
- Monarch: Forecasting со сценариями, пенсионное планирование как core-ожидание (360↑/56), пользователи сами пишут net worth projection и FIRE-движки поверх данных (199↑, 132↑). Self-hosted: Ignidash (ProjectionLab alternative, 159↑), Wealthfolio (789↑), Assets.
- Net worth: диапазоны дат между 1Y и All (248↑/50), all-time-high (90↑/38), «Mint-style история».
- UK: «model my known future cashflows and play with scenarios» перед пенсией.

Lumio: net worth по balance-счетам, тренды и «commitments» на дашборде, план цели. Нет прогноза кэшфлоу, сценариев, инвестиций вне крипты, диапазонов/ATH на графике net worth.

### 3.9 Партнёр/семья

- «Wife approved finance app»: партнёр перегружен Actual; работающие ответы — ежемесячная «финансовая встреча» с 10–15 транзакциями на разбор, и Telegram-бот, куда жена пересылает чеки и скриншоты (42↑). [r/selfhosted, 132↑/84](https://www.reddit.com/r/selfhosted/comments/1uv0pze/)
- r/personalfinance: «app I can use with my wife, both phones synced». Monarch family sharing даёт дубли по общим картам.

Lumio: воркспейсы, роли, инвайты есть. Telegram только отдаёт отчёты, не принимает расходы. Нет «простого режима» для второго участника.

### 3.10 Доверие: тиры, реклама, UI-чехарда, прозрачность

- YNAB: реклама книги/мерча внутри оплаченного приложения, увольнения, T&C — крупнейшие треды года (683↑/307, 421↑, 406↑, 240↑, 221↑). [пример](https://www.reddit.com/r/ynab/comments/1tx8296/between_firing_half_their_marketing_staff_the_ad/)
- Monarch Plus за $299: «withholding features for more money» (460↑/174), «upsell ad in the middle of transaction view» (362↑/68), «It should be Home and Business, not Core and Plus» (212↑). [1](https://www.reddit.com/r/MonarchMoney/comments/1sr0abo/withholding_features_for_more_money/), [2](https://www.reddit.com/r/MonarchMoney/comments/1sray6s/upsell_ad_in_the_middle_of_transaction_view/), [3](https://www.reddit.com/r/MonarchMoney/comments/1stkav9/it_shouldnt_be_core_and_plus_it_should_be_home/)
- YNAB UI: «stop needlessly changing the UI», рутинное действие «Clear» спрятано за «Show more», просят отключить анимации. [205↑/128](https://www.reddit.com/r/ynab/comments/1uvq4ec/when_will_ynab_stop_needlessly_changing_the_ui/)
- Что ценят: подробные release notes (194↑), публичный roadmap (182↑), активность команды в сообществе.
- Copilot: год без заметных фич → отток.

Для self-hosted OSS это преимущество по умолчанию, но его надо проговаривать: changelog в приложении, roadmap, принципы стабильности UI.

### 3.11 Приватность, local-first, ИИ с доступом к деньгам

- HN за год: волна «local-first», «E2E encrypted», «no cloud», «MCP server only», «no AI features, just an MCP server» финансовых приложений.
- Monarch MCP + Claude: восторг (142↑/90, 107↑/81) и беспокойство («AI guessing numbers», «can't undo changes»), затем MCP поставлен на паузу (271↑/71). Copilot запустил MCP, появился неофициальный MCP. [1](https://www.reddit.com/r/MonarchMoney/comments/1u3yv9u/i_have_claude_connected_to_my_account/), [2](https://www.reddit.com/r/MonarchMoney/comments/1vsrcyg/mcp_update_still_paused/)
- r/personalfinance: «budgeting app that does not sell data?». r/selfhosted жёстко отвергает «vibe-coded» финансовые приложения после ревью кода аутентификации (Monize, 204 комм.).

Lumio: MCP-сервер, локальная LLM в браузере, egress guard, шифрование секретов, экспорт/удаление аккаунта. Нужно: документированный MCP со scopes read/write, аудит действий ИИ с откатом, «ИИ не выдумывает цифры» как явное свойство, публичная страница security posture.

### 3.12 Отчёты

- «Analytics are lacking… I'd appreciate Sankeys» (38↑), «Sankey diagram plz» (31↑), Actual Sankey feedback (11 +1). Monarch добавил treemap и cash flow home. Виджеты сравнения доходов (112↑). Фильтры «select all/none» (35↑). Исключение переводов и инвестиций из income vs expense.

Lumio: отчёты, spend-over-time, Sankey есть для целей (plan-vs-actual). Нет Sankey по кэшфлоу, treemap, сравнения периодов, тумблера «без переводов».

### 3.13 Малый бизнес и бухгалтерия

- QuickBooks: рост цен на 30%/год, Desktop умирает, ищут альтернативы (Wave, Zoho, GnuCash). [40↑/73](https://www.reddit.com/r/smallbusiness/comments/1usxd7g/i_need_to_change_my_bookkeeping_software/)
- Сверка банка 3 часа/мес → bank feeds + правила + матч к инвойсам/счетам. [19↑/32](https://www.reddit.com/r/Bookkeeping/comments/1rli6vj/reducing_bank_reconciliation_time_from_3_hours_to/)
- «Revenue up, bank account empty» — AR aging, cash vs accrual, runway. [38↑/82](https://www.reddit.com/r/smallbusiness/comments/1sl6m0a/how_does_revenue_keep_going_up_but_my_bank/)
- «Recurring vendors mess my cash flow», «how many subscriptions to run a business», двойные оплаты.
- Пятничный админ занимает 3,5 часа вместо «часа»: сбор данных из CRM/инвойсов/банка.

Lumio: инвойсы, payables/receivables, VAT, леджер. Нет экрана сверки (строка выписки ↔ инвойс/счёт), AR aging, runway, детекции дублей payables.

### 3.14 Простота и мобильность

- «almost all budgeting apps are super complicated», «beginner free simple». Firefly: «painful to maintain», Actual: «fast, clean, intuitive». Actual на мобильном — только PWA, у Firefly нет официального приложения, Copilot без Android.
- Ответ Monarch на тиры: разделить Home и Business.

Lumio: 16 пунктов навигации для всех, нет service worker/offline/push, `electron/` пуст.

## 4. Куда идёт рынок (релизы 2026)

| Игрок | Что выпустил за год |
|---|---|
| Monarch | AI Assistant с weekly recap, Contextual Insights, Goals 3.0 (гибкое фондирование, spend from goals, avalanche/snowball), Forecasting со сценариями, Receipt Scanner с line items и email forwarding, treemap/cash flow reports, equity compensation, выбор провайдера синка, MCP (beta → пауза), SOC 2 Type II, тир Plus $299 |
| YNAB | Plan Reset, Card Mode, CSV-конвертер в file import, авто-категоризация «2 из 3», матч платежей по кредитке, Hide Amounts, редизайн редактора транзакций; параллельно — реклама внутри, рост цены |
| Copilot | Web-приложение, Money Assistant (beta), MCP (beta), 2FA, split на web; жалобы на темп |
| Actual | Age of Money/Payee Locations stable, провайдеры SimpleFIN/Enable Banking/Akahu/Pluggy, SSRF-защита синка, плагины фронтенда (feedback) |
| Sure (форк Maybe) | SimpleFIN/Enable Banking/SnapTrade, запросы: rollover, курсы вручную, sub-accounts, несколько ledger на пользователя |
| Indie/HN | local-first, E2E, MCP-only, «forecast instead of track», no-subscription |

## 5. Карта «ожидание → Lumio → действие»

| # | Ожидание | Lumio сейчас | Действие (фаза) |
|---|---|---|---|
| 1 | Переводы между счетами не являются расходом | нет парного матча | Transfer pairing (F0) |
| 2 | Правила первичны, ИИ выключаем, видно «почему» | есть компоненты, нет порядка/объяснения/выключателя | Categorization trust (F0) |
| 3 | Оригинал мерчанта сохраняется | проверить `transaction.rawDescription`‑аналог | F0 |
| 4 | Нет тихих дублей, правки не исчезают | дедуп есть | Регрессионные тесты + UI «почему дубликат» (F0) |
| 5 | Changelog, roadmap, стабильный UI | нет in-app changelog | F0 (дёшево) |
| 6 | Быстрая разборка очереди, bulk по payee, auto-approve | стадии есть, inbox нет | Review inbox (F1) |
| 7 | Чек → транзакция → сплит по позициям | частично | Receipt match + auto-split (F1) |
| 8 | Telegram-захват расходов/чеков | только отчёты | Telegram inbound (F1) |
| 9 | Подписки: дельта цены, дубли, календарь, cost per use, тишина | `price_changed` есть | Subscriptions 2.0 (F1) |
| 10 | Rollover, «refill up to», подкатегории в бюджете | нет | Budget mechanics (F1) |
| 11 | Простой режим / Home vs Business | 16 разделов всем | Workspace profile (F1) |
| 12 | Прогноз кэшфлоу 30/90/365, safe-to-spend, сценарии | commitments horizon | Forecast (F2) |
| 13 | Инвестиции и пенсионные счета в net worth, диапазоны, ATH | только крипта | Investments v1 (F2) |
| 14 | Sankey/treemap, сравнение периодов, «без переводов» | частично | Reports (F2) |
| 15 | MCP со scopes, аудит ИИ, undo | MCP есть, scopes/аудит нет | MCP/AI trust (F2) |
| 16 | Сверка банка, AR aging, runway, дубли payables | инвойсы/payables есть | SMB pack (F2) |
| 17 | Опциональная синхронизация с банком | нет по дизайну | Provider plugin (F3, решение владельца) |
| 18 | PWA offline + push, мобильный захват | нет SW | Mobile layer (F3) |
| 19 | Мультивалюта: исходная валюта + база, курсы вручную | FX есть | Аудит, точечные фиксы (F3) |
| 20 | Форматы OFX/QIF/CAMT.053/MT940 | нет | Import formats (F3) |

## 6. План по фазам

Оценки: S ≤ 3 дня, M ≤ 2 недели, L > 2 недель. Каждый пункт: зачем (ссылка на раздел 3), что, где, как проверить. Домены с правилами в `.claude/rules/*` (security, database, idempotency, api-standards) обязательны для всех пунктов.

### Фаза 0. Доверие к данным (3–4 недели)

**0.1 Сопоставление переводов между счетами (M).** Боль 3.3.
Что: сервис, который по workspace ищет пары транзакций противоположного знака с равной суммой (для разных валют — по курсу дня ± 2%) в окне ±3 дня на разных счетах/выписках и помечает их `transferPairId`; тип → `transfer`; исключение из расходов/доходов во всех агрегатах (dashboard, reports, budgets, insights); ручное «связать/развязать» в UI транзакции; плата за перевод (разница сумм) — отдельная строка категории «Fees» (Firefly-кейс).
Где: `backend/src/modules/transactions/services/` (новый `transfer-pairing.service.ts`), миграция колонки, фильтры в `dashboard.service.ts`, `reports`, `budgets`, `insights`; UI в `frontend/app/(main)/statements/transactions`.
Проверка: unit на пары (одинаковая валюта, FX, окно дат, отказ при трёх кандидатах), e2e: две выписки с переводом → спенд не растёт; отчёт income vs expense не меняется от перевода на брокерский счёт.

**0.2 Связка «расход ↔ возмещение» (S).** Боль 3.3.
Что: `reimbursementOfId` на транзакции, в отчётах показывать нетто; UI «отметить как возврат за…».
Проверка: unit + e2e на нетто в spend-over-time.

**0.3 Прозрачная категоризация (M).** Боль 3.2.
Что: (а) фиксированный порядок: ручная категория > правило > обучение по мерчанту > ИИ, порядок показан в настройках; (б) на транзакции поле `categorySource` + «почему» (какое правило/какой прецедент); (в) переключатели на уровне workspace: «ИИ-категоризация», «ИИ-переименование мерчанта», «обучение»; (г) обучение по мерчанту принимает новую категорию только при 2 из 3 последних подтверждений (правило YNAB); (д) `rawDescription` всегда сохраняется и показывается по hover; (е) массовая переклассификация — закрыть TODO в `classification.service.ts:658` с идемпотентностью и аудитом.
Где: `backend/src/modules/classification/`, `entities/category-learning.entity.ts`, `entities/transaction.entity.ts`, настройки workspace.
Проверка: unit: разовое исключение не меняет дефолт; правило побеждает ИИ; выключенный ИИ не вызывается (мок клиента). UI-тест: «почему» отображается.

**0.4 Регрессии дублей (S).** Боль 3.3.
Что: golden-кейсы: Amazon split-shipment (3 списания на один заказ не схлопываются), повторная загрузка той же выписки (схлопываются), одинаковые суммы в один день на разных картах (не схлопываются). В UI дубликатов показывать причину (fingerprint/cross-statement/confidence).
Где: `backend/src/modules/parsing/services/intelligent-deduplication.service.ts`, `transactions/services/cross-statement-deduplication.service.ts`, `frontend/app/transactions/duplicates/`.

**0.5 Changelog и принципы (S).** Боль 3.10.
Что: `CHANGELOG.md` + страница «Что нового» в приложении (markdown из репо), публичный roadmap как `docs/ROADMAP.md`; документ «UI stability principles»: рутинные действия не прячутся за дополнительный тап, есть «reduce motion/density» настройка, никаких upsell-блоков.
Где: `website/`, `frontend/app/settings`.

### Фаза 1. Меньше ручной работы (6–8 недель)

**1.1 Review inbox (L).** Боль 3.4.
Что: единая очередь «Needs review» (транзакции без категории/с низкой уверенностью, чеки без суммы, подозрения на дубли, предложенные подписки), клавиатурная разборка (j/k, цифры для категорий, Enter approve), на мобильном — карточки со свайпом (аналог Card Mode), bulk по payee («все 7-Eleven → Fast food»), «режим отпуска» (всё за даты X–Y → категория), auto-approve при `categorySource ∈ {rule, manual-learning≥N}` и уверенность ≥ порога, еженедельный дайджест «N ждут разбора» (уже есть digest-инфраструктура).
Где: новая страница `frontend/app/(main)/review`, бэкенд `statements/stage` + новый endpoint списка очереди, `notifications` digest.
Проверка: e2e: 20 транзакций разбираются с клавиатуры без мыши; дайджест содержит счётчик.

**1.2 Чек → транзакция → сплит (M).** Боль 3.5.
Что: автоматический матч чека к транзакции (сумма ± 1%, дата ± 3 дня, мерчант по нормализованному имени), при наличии позиций — предложение split по категориям позиций одним кликом; матч нескольких списаний Amazon к одному заказу из письма; парсинг HTML-тела письма как чека (не только вложений) в Gmail/IMAP.
Где: `modules/receipts/services/receipt-processor.service.ts`, `receipt-category.service.ts`, `transactions/dto/split-transaction.dto.ts`, `modules/gmail`, `open-protocol-integrations` (IMAP).
Проверка: golden-тесты на 5 форматах писем; e2e «чек Target с 3 категориями → 3 сплита».

**1.3 Telegram inbound (M).** Боль 3.9.
Что: бот принимает фото чека, PDF, текст «кофе 4.50» и пересланный скриншот; создаёт receipt/manual expense в Needs review с привязкой к пользователю workspace; ответ с распознанной суммой и кнопками «ок/категория/удалить». Это же даёт «простой режим» для партнёра.
Где: `backend/src/modules/telegram/` (сейчас только команды отчётов), переиспользовать `receipts` pipeline и `data-entry`.
Проверка: интеграционный тест с моком Telegram API; идемпотентность по `message_id`.

**1.4 Subscriptions 2.0 (M).** Боль 3.6.
Что: уведомление о смене цены с дельтой и годовым эффектом; детекция дублей (один вендор, два источника оплаты / два члена workspace); «стоимость за использование» (ручной счётчик использований или привязка к тегу); календарь предстоящих списаний (месяц/неделя) с payables и инвойсами; тумблер «не предлагать recurring»; рекомендация sinking fund: годовой счёт → ежемесячное накопление в бюджете.
Где: `modules/subscriptions`, `notifications`, новая страница календаря (или вкладка в `subscriptions`).

**1.5 Механика бюджета (M).** Боль 3.7.
Что: опция rollover (перенос недоиспользованного/перерасхода) per budget; тип цели «refill up to Y по X в период»; бюджет на родительскую категорию агрегирует детей (`category.parentId` уже есть); предупреждение «операция уведёт счёт в минус» при ручном вводе.
Где: `entities/budget.entity.ts`, `modules/budgets`, `modules/goals/goal-plan.service.ts`.
Проверка: unit на rollover по месяцам, на refill-цель после траты.

**1.6 Профиль workspace: Home / Business (M).** Боль 3.14, 3.10.
Что: при создании workspace выбирается профиль; Home скрывает invoices, payables, ledger, tax, custom tables, roi; Business показывает всё; переключение в настройках без потери данных; в онбординге для Home — 5 экранов максимум.
Где: `frontend/app/components/navigation/helpers/navigation-config.ts` (уже есть флаг `experimental`), `entities/workspace.entity.ts`.

### Фаза 2. Планирование вперёд (8–10 недель)

**2.1 Прогноз кэшфлоу (L).** Боль 3.8.
Что: проекция баланса на 30/90/365 дней из подписок, payables/receivables, инвойсов, целей, бюджетов и средних по категориям; «safe to spend до зарплаты»; сценарии («если уберу X», «если доход −20%»); минимум-баланс и дата кассового разрыва; для бизнеса — runway.
Где: новый модуль `forecast` (чистая функция над данными, чтобы тестировать без БД), виджет на dashboard, страница в `budgets` или отдельная.
Проверка: unit на детерминированные сценарии; snapshot-тесты.

**2.2 Investments v1 (L).** Боль 3.8.
Что: счета типа investment/retirement с ручными позициями (тикер, количество, цена) и ручными/импортированными оценками; цены из бесплатного источника с кэшем и egress guard; взносы на такие счета = переводы; net worth: диапазоны 1M/3M/6M/1Y/3Y/5Y/All, ATH с датой, разбивка по классам активов. Без брокерских API.
Где: `modules/balance`, `modules/net-worth`, расширение `balance-account.entity.ts`.

**2.3 Отчёты (M).** Боль 3.12.
Что: Sankey кэшфлоу (доход → категории → подкатегории), treemap, сравнение периодов, тумблер «исключить переводы и инвестиции», фильтры select all/none, экспорт.
Где: `modules/reports`, `frontend/app/(main)/reports`; переиспользовать Sankey из goals.

**2.4 MCP и ИИ как доверенный агент (M).** Боль 3.11.
Что: API-ключи и MCP со scopes (`read:transactions`, `write:categories`, ...), каждое действие ИИ/MCP — событие аудита с откатом (`modules/audit/rollback` уже есть), документация MCP на сайте с примерами Claude Code/Desktop, страница security posture (threat model, что шифруется, что уходит наружу, как отключить ИИ целиком). Принцип в чате: цифры только из tool-результатов, никаких оценок «на глаз».
Где: `modules/api-keys`, `mcp-server/`, `modules/audit`, `website/`.

**2.5 SMB pack (L).** Боль 3.13.
Что: экран сверки: строки выписки ↔ инвойсы/payables с авто-матчем по сумме/дате/контрагенту и ручным подтверждением; AR/AP aging (0–30/31–60/61–90/90+); напоминания должникам по инвойсам (dunning) с шаблонами; детекция дублей payables (один контрагент, сумма, ±7 дней); отчёт «бизнес-подписки» по вендорам.
Где: `modules/invoices`, `modules/payables`, `modules/ledger`, новая страница `statements/reconcile`.

### Фаза 3. По решению владельца

**3.1 Опциональная синхронизация с банком через провайдер пользователя (L).** Боль 3.1.
Это противоречит текущему README. Предлагаемая формулировка: «Lumio не держит собственную интеграцию с банками; вы можете подключить свой аккаунт провайдера». Интерфейс `BankSyncProvider` с первой реализацией SimpleFIN (открытый протокол, $15/год, Северная Америка, уже стандарт для Actual/Sure) и второй Enable Banking (EU/UK, бесплатный restricted production на свои счета, ключи пользователя). Импорт идёт через существующий `import` pipeline как «виртуальная выписка», значит дедуп/правила/стадии переиспользуются. Выбор провайдера на уровне счёта (как в Monarch). Обязательно: SSRF-защита (Actual получил такой баг), ключи в encrypted settings, отключаемость.
Где: новый `modules/bank-sync`, `modules/import`.

**3.2 Мобильный слой (M).** Боль 3.14.
Что: service worker с кэшем app shell и офлайн-очередью для ручного расхода и фото чека (синхронизация при появлении сети); Web Push для алертов бюджета, price change, «N ждут разбора»; ярлык «добавить расход» на домашнем экране. Нативная обёртка (Capacitor) — только если PWA не хватит.
Где: `frontend/app/manifest.ts` (там же комментарий «add a worker only once there is a real offline story»), `modules/notifications` (новый канал `push`).

**3.3 Форматы импорта (M).** Боль 3.1 (для тех, кто без синка).
Что: парсеры OFX/QFX, QIF, CAMT.053, MT940; пресеты CSV для 20 популярных банков EU/UK/US с автоопределением по заголовкам; «переслать выписку на адрес import@…» через IMAP.
Где: `modules/parsing/parsers/`.

**3.4 Мультивалюта (S).** 
Аудит: исходная сумма/валюта хранится на транзакции и видна в UI; базовая валюта workspace для роллапов; ручная правка курса; отсутствие курса не конвертирует по 1.0 молча (баг Sure). Точечные фиксы.

## 7. Чего не делать (анти-паттерны из жалоб)

- Не включать ИИ-переименование мерчантов по умолчанию и не терять исходную строку.
- Не делать recurring/insight-подсказки, которые нельзя выключить.
- Не прятать рутинные действия (approve, clear, категория) за дополнительный тап ради «чистоты».
- Не менять расположение базовых элементов без release notes и периода «старый вид».
- Не вводить тиры «фичи за дополнительную плату» и любые upsell-блоки внутри рабочих экранов.
- Не считать переводы/инвестиции расходом ни в одном отчёте «по умолчанию».
- Не давать ИИ писать в данные без аудита и отката.

## 8. Открытые вопросы для владельца

1. Позиционирование: остаёмся «файлы и чеки» или допускаем опциональный bank sync через провайдер пользователя (фаза 3.1)? От этого зависит приоритет 3.3.
2. Целевой сегмент фазы 1: Home-профиль (пары, self-hosted энтузиасты) или Business (фрилансеры/микробизнес)? План сделан так, что фаза 0–1 полезны обоим, фаза 2.5 — только бизнесу.
3. Регионы: сейчас нативные парсеры KZ/IL. Если цель EU/UK, формат-пак (3.3) и Enable Banking важнее SimpleFIN.
4. Инвестиции: достаточно ли ручных позиций + цен (2.2), или нужна брокерская интеграция (не рекомендую до фазы 3).

## 9. Источники

Reddit (через архив Arctic Shift, ссылки на оригиналы в тексте), GitHub issues: [actualbudget/actual](https://github.com/actualbudget/actual/issues), [firefly-iii/firefly-iii](https://github.com/firefly-iii/firefly-iii/issues), [we-promise/sure](https://github.com/we-promise/sure/issues). Hacker News: [Ask HN: What frustrates you most about personal finance apps?](https://news.ycombinator.com/item?id=46566663), [Trackm thread о провайдерах](https://news.ycombinator.com/item?id=47406569), [Cadence Money: no AI, just MCP](https://news.ycombinator.com/item?id=49097110). Релизы: [Monarch Winter Release](https://www.monarch.com/blog/winter-release), [Monarch release notes 2026](https://releasebot.io/updates/monarch), [YNAB What's New](https://www.ynab.com/whats-new), [Actual 26.8.0](https://actualbudget.org/blog/release-26.8.0/). Обзоры и отзывы: [Trustpilot Monarch](https://www.trustpilot.com/review/www.monarchmoney.com), [Budget apps Reddit recommends 2026](https://getfinny.app/blog/best-budget-apps-reddit-recommends-2026), [Best budgeting apps Europe 2026](https://getfinny.app/blog/best-budgeting-apps-europe-2026), [Free & indie open banking APIs 2026](https://www.openbankingtracker.com/guides/free-open-banking-apis), [GoCardless alternatives when signups are disabled](https://dev.to/johnfrandsen/gocardless-bank-account-data-alternatives-what-to-use-when-signups-are-disabled-326d), [Copilot review 2026](https://pocketclear.app/blog/copilot-money-review-2026.html), [Firefly III review](https://www.expensesorted.com/blog/147_firefly_iii).
