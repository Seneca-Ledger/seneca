# Налоговый движок с юрисдикциями (вариант C)

Ветка: `feat/tax-engine` (worktree `/home/symonb/Projects/lumio-tax-engine`, от main @ 7fbd2021)

## Цель

Workspace выбирает налоговую юрисдикцию → система сама подставляет ставку на каждую
транзакцию, считает сумму налога, формирует декларацию за период и следит за порогом
регистрации.

## Что уже есть в коде (не строим заново)

| Есть | Файл |
|---|---|
| `tax_rates` — per-workspace, `rate`, `isDefault`, `isEnabled` | `backend/src/entities/tax-rate.entity.ts` |
| CRUD + permissions (`CATEGORY_*`) | `backend/src/modules/tax-rates/tax-rates.controller.ts` |
| `Transaction.taxRateId` (FK) + `Transaction.taxDetected` | `backend/src/entities/transaction.entity.ts:98-135` |
| Резолв ставки при ручном расходе (явная → `isDefault`) | `backend/src/modules/statements/statements.service.ts:361-384` |
| Сидинг при создании workspace | `backend/src/modules/workspaces/workspaces.service.ts:101,792` |
| `Receipt.taxAmount` из парсера | `backend/src/modules/receipts/services/receipt-processor.service.ts:95` |
| Исторический курс валют `getRate(from,to,date)` | `backend/src/modules/exchange-rates/exchange-rates.service.ts:31` |
| UI выбора ставки | `frontend/app/(main)/statements/components/CreateExpenseDrawer.tsx:1066` |

**Чего нет:** юрисдикции, историчности ставок, правил, вычисления суммы налога (ставка
хранится и нигде не применяется), декларации, порога.

## Три решения, которые определяют всё остальное

### 1. Gross vs net

Банковская выписка даёт **gross** (налог внутри суммы). Чек — тоже. Ручной ввод может
быть любым. Поэтому у ставки флаг `is_inclusive`:

```
inclusive:  tax = gross × rate / (100 + rate);  net = gross − tax
exclusive:  tax = net × rate / 100;             gross = net + tax
```

### 2. Инвариант округления

`net + tax === gross` обязан выполняться **после** округления. Единственный способ:
округлить одну величину и вывести вторую вычитанием. Никогда не округлять обе независимо
— на 12% и сумме 100.00 это даёт расхождение в копейку, которое накапливается по декларации.

В проекте **нет** decimal-библиотеки и нет money-утилиты (`backend/src/common/utils` пуст
на этот счёт), суммы — `decimal(15,2)` в БД и `number` в JS. Для налогов float
неприемлем. Фаза 3 вводит `backend/src/common/utils/money.util.ts` на целых минорных
единицах (копейки как `number`, безопасно до 2^53). Новая зависимость не нужна.

### 3. Налог хранится, а не вычисляется на лету

В варианте A я предлагал вычислять. Для compliance-движка — наоборот: сумма налога
фиксируется в момент проведения. Изменение ставки задним числом **не должно**
переписывать уже поданную декларацию. Поэтому `transactions.tax_amount` — хранимая
колонка, а `tax_rate_id` указывает на **конкретную версию** ставки.

---

## Модель данных

### Справочник (глобальный, не workspace-scoped)

Исключение из правила изоляции `.claude/rules/security.md` — это reference data, читается
всеми, пишется только миграцией. Записать это исключение в правило явно.

**`tax_jurisdictions`**

| Колонка | Тип | Смысл |
|---|---|---|
| `id` | uuid PK | |
| `code` | varchar(2) UNIQUE | ISO-3166 alpha-2 (`KZ`, `DE`) |
| `name` | varchar(120) | |
| `tax_name` | varchar(40) | «НДС», «USt», «VAT» — для UI |
| `currency` | varchar(3) | валюта декларации |
| `scheme` | enum | `vat` \| `gst` \| `sales_tax` \| `none` |
| `is_eu` | bool | нужен для reverse charge |
| `registration_threshold` | decimal(15,2) null | |
| `threshold_period` | enum null | `calendar_year` \| `rolling_12m` |
| `filing_period` | enum | `monthly` \| `quarterly` \| `annual` |

**`tax_jurisdiction_rates`** — эталонные ставки с историей

`id`, `jurisdiction_id` FK, `code` varchar(40) (`KZ_STANDARD`), `name`, `rate` decimal(5,2),
`kind` enum (`standard`\|`reduced`\|`zero`\|`exempt`), `valid_from` date, `valid_to` date null.

Пример строк: `KZ_STANDARD` 12% с `1900-01-01` по `2025-12-31`, и 16% с `2026-01-01`.
Ровно ради этого нужна историчность — иначе декларация за 2025 пересчитается по ставке 2026.

### Workspace-scoped

**`workspaces`** — одна колонка: `tax_jurisdiction_id` uuid null FK.

Не `varchar(2)` — FK даёт целостность и убирает джойн по строке.

**`tax_rates`** (существующая, расширяем):

| Добавить | Зачем |
|---|---|
| `jurisdiction_id` uuid null FK | откуда пришла ставка |
| `code` varchar(40) null | **стабильный идентификатор поверх версий** |
| `kind` enum default `standard` | |
| `valid_from` date default `1900-01-01` | |
| `valid_to` date null | |
| `is_inclusive` bool default `true` | gross/net |
| `is_reverse_charge` bool default `false` | |

Уникальность: `UNIQUE (workspace_id, code, valid_from) WHERE code IS NOT NULL` —
частичный индекс, чтобы ручные ставки без `code` не ломались.

`is_default` остаётся, но резолвится **на дату**: `is_default = true AND valid_from <= :date
AND (valid_to IS NULL OR valid_to >= :date)`. Существующая проверка «сбросить чужой
is_default» в `tax-rates.service.ts:38` должна учитывать пересечение периодов, а не просто
занулять всё.

**`tax_rules`** — категория → ставка

`id`, `workspace_id`, `category_id` uuid null FK, `tax_rate_code` varchar(40),
`priority` int default 0, `direction` enum (`expense`\|`income`\|`both`),
`counterparty_type` enum (`b2b`\|`b2c`\|`any`), `counterparty_country` varchar(2) null,
`is_enabled` bool.

Резолв: все включённые правила workspace, отфильтровать по совпадению, взять
`ORDER BY priority DESC, category_id NULLS LAST` — первое. Правило без `category_id` =
fallback для всего.

**`transactions`** — добавить:

`tax_amount` decimal(15,2) null, `tax_net_amount` decimal(15,2) null,
`tax_source` enum (`manual`\|`rule`\|`default`\|`parsed`) null,
`tax_rule_id` uuid null FK (провенанс — почему выбрана эта ставка),
`tax_reverse_charge` bool default false,
`tax_locked` bool default false (транзакция попала в поданную декларацию).

**`tax_returns`** — декларация

`id`, `workspace_id`, `jurisdiction_id`, `period_start` date, `period_end` date,
`status` enum (`draft`\|`filed`\|`locked`), `output_tax`/`input_tax`/`net_payable` decimal(15,2),
`currency` varchar(3), `filed_at` timestamptz null, `snapshot` jsonb null,
`created_at`/`updated_at`.

`UNIQUE (workspace_id, jurisdiction_id, period_start, period_end)`.

`snapshot` — построчная выгрузка на момент подачи. Без неё «декларация от 3 марта» через
полгода покажет другие цифры, и это провал аудита.

---

## Структура модулей

Существующий `modules/tax-rates/` переименовать в `modules/tax/` — консолидация владения.
Правки импортов механические: `statements.service.ts`, `statements/services/receipt-statement.service.ts`,
`transactions.service.ts`, `workspaces.module.ts`, `app.module.ts`.

```
backend/src/modules/tax/
  tax.module.ts
  jurisdictions.controller.ts        GET /tax/jurisdictions, GET /tax/jurisdictions/:code/rates
  jurisdictions.service.ts           read-only, кэш в память (справочник не меняется в рантайме)
  tax-rates.controller.ts            существующий, без изменений API
  tax-rates.service.ts               + resolveForDate(), + adoptFromJurisdiction()
  tax-rules.controller.ts            CRUD правил
  tax-rules.service.ts               extends WorkspaceCrudBaseService
  tax-calculation.service.ts         ЯДРО — чистые функции, без БД
  tax-assignment.service.ts          применяет правила к транзакции, пишет tax_* колонки
  tax-returns.controller.ts          GET/POST /tax/returns, POST /tax/returns/:id/file
  tax-returns.service.ts             агрегация + snapshot + lock
  tax-threshold.service.ts           мониторинг порога → notifications
  jurisdictions.seed.ts              данные для миграции
```

`tax-calculation.service.ts` не трогает БД вообще — вход/выход чистые объекты. Это то, что
покроется unit-тестами на 100%, всё остальное — интеграция.

Декларацию **не** класть в `reports.service.ts` — там уже 1500+ строк и другая
ответственность (произвольные отчёты по транзакциям). Декларация — отдельный домен со
своим жизненным циклом (draft → filed → locked).

---

## Фазы

Каждая фаза — отдельный коммит, зелёный `typecheck` + `test` на выходе.

### Фаза 0 — консолидация модуля

- `git mv backend/src/modules/tax-rates backend/src/modules/tax`, переименовать
  `TaxRatesModule` → `TaxModule`, починить импорты.
- **Verify:** `npm --prefix backend run typecheck` и `test:e2e` зелёные, диффа в поведении нет.

### Фаза 1 — справочник юрисдикций

- Сущности `TaxJurisdiction`, `TaxJurisdictionRate`.
- Миграция `AddTaxJurisdictions` + сид. Стартовый набор — только те страны, где есть
  пользователи: `KZ`, `DE`, `PL`, `US`, `GB`, `AE`. Расширять по запросу, не выдумывать 190 стран.
- `jurisdictions.service.ts` + read-only контроллер.
- **Verify:** `GET /tax/jurisdictions` возвращает 6 стран; `GET /tax/jurisdictions/KZ/rates?date=2026-06-01`
  возвращает 16%, а с `date=2025-06-01` — 12%.

### Фаза 2 — привязка к workspace + принятие ставок

- Миграция: `workspaces.tax_jurisdiction_id`, расширение `tax_rates`.
- Бэкфилл: существующим `tax_rates` проставить `valid_from = '1900-01-01'`, `is_inclusive = true`,
  `code = NULL` (остаются ручными). Ничего не ломается.
- ~~`PATCH /workspaces/:id` принимает `taxJurisdictionId`~~ → **сделано иначе:** отдельный
  `PUT /tax/settings/jurisdiction` в tax-модуле (permission `WORKSPACE_SETTINGS_MANAGE`).
  Причина: у смены юрисдикции крупный побочный эффект (принятие и закрытие ставок), а
  общий audit-diff воркспейса его не фиксирует. Плюс `GET /tax/settings` и
  `GET /tax/settings/rates?date=`.
- `adoptFromJurisdiction(workspaceId, jurisdictionId)`: копирует эталонные ставки в
  `tax_rates` workspace'а со всеми версиями. Идемпотентно по `(workspace_id, code, valid_from)`.
- `createDefaultTaxRates` получает необязательный `jurisdictionId`; при его наличии сеет из
  справочника вместо «Tax exempt (0%)».
- **Смена юрисдикции у живого workspace:** старые ставки не удалять, закрыть `valid_to =
  вчера`, новые открыть с сегодня. Транзакции прошлого сохраняют свои ставки.
- **Verify:** тест — workspace с KZ получает 4 строки ставок; смена на DE не осиротила
  ни одной транзакции (`SELECT count(*) FROM transactions t LEFT JOIN tax_rates r ON ... WHERE r.id IS NULL` = 0).

### Фаза 3 — ядро вычисления

- `backend/src/common/utils/money.util.ts`: `toMinor`, `fromMinor`, `roundHalfUp`.
- `tax-calculation.service.ts`:
  ```ts
  computeTax(input: { grossMinor?: number; netMinor?: number; rate: number;
                      isInclusive: boolean; reverseCharge: boolean }): TaxBreakdown
  ```
  Возвращает `{ netMinor, taxMinor, grossMinor, notionalTaxMinor }`. Инвариант
  `net + tax === gross` — через вычитание, не через двойное округление.
  `reverseCharge` → `taxMinor = 0`, но `notionalTaxMinor` заполнен (нужен в декларации
  с обеих сторон).
- Миграция: `tax_*` колонки в `transactions`.
- **Verify:** unit-тест `tax-calculation.service.spec.ts` — таблица кейсов, включая
  «100.00 @ 12% inclusive → net 89.29 + tax 10.71 = 100.00» и ставку 0, и отрицательную
  сумму (возврат покупки), и reverse charge.

### Фаза 4 — движок правил и авто-назначение

- `tax_rules` + CRUD.
- `tax-assignment.service.ts`:
  ```
  resolve(tx) → { rate, rule, source }
    1. tx.taxRateId задан явно      → source='manual', выход
    2. подходящее tax_rule          → source='rule'
    3. is_default на дату tx        → source='default'
    4. ничего                       → tax_amount = null
  ```
  Дата резолва — **дата транзакции**, не сегодня.
- **Исключения (обязательно, иначе движок испортит данные):** переводы между
  счетами, зарплата, погашение кредита не облагаются. Фильтр по
  `transaction.transactionNature` / типу категории — поля уже есть в сущности.
- Точки подключения — **все подключены**: ручной расход (`statements.service.ts`),
  чеки (`receipt-statement.service.ts`), парсинг выписок
  (`statement-processing.service.ts`) и разбиение (`transactions.service.ts`).
- **Разбиение оказалось не «ещё одной проводкой».** Копировать налог в части нельзя —
  он умножился бы на их число. Части пересчитываются каждая от своей суммы **после**
  переопределения категории, поскольку часть, перенесённая в другую категорию, может
  попасть под другое правило. Ручную ставку части наследуют, авто-назначенную —
  выводят заново. Разбиение строки с `tax_locked = true` запрещено: пересчёт изменил бы
  уже поданные цифры.
- Сумма налога частей может отличаться от доналоговой на ~копейку на часть. Это
  неизбежно: каждая часть — самостоятельная строка, и её `net + tax` обязан сходиться
  с её собственной суммой. Раскладывать родительский налог по частям означало бы
  сломать это равенство построчно — худший размен.
- Транзакции с `tax_locked = true` пропускаются.
- **Verify:** e2e — создать правило «категория食品 → reduced», завести расход,
  проверить `tax_amount`; завести перевод между счетами — `tax_amount` остался null.

### Фаза 5 — reverse charge ✅

- Нужен контрагент со страной. `vendor_normalized` есть, страны нет. Добавить
  `transactions.counterparty_country` varchar(2) null и `counterparty_vat_id` varchar(32) null;
  заполнять из парсера чеков/выписок где доступно, иначе — вручную.
- Правило срабатывает когда: юрисдикция workspace `is_eu`, страна контрагента `is_eu`,
  страны разные, `counterparty_type = b2b` (наличие VAT ID).
- Результат: ставка 0, `tax_reverse_charge = true`, `notionalTax` идёт в декларацию
  **и в output, и в input** (взаимозачёт).
- **Verify:** unit — DE workspace, поставщик PL с VAT ID, 1000 EUR @ 19% →
  `taxAmount = 0`, в декларации `+190` output и `+190` input, `net_payable` не изменился.

> Риск: без надёжного источника страны и VAT ID контрагента фаза даёт мало пользы.
> Если поле некому заполнять — фазу отложить, движок от этого не страдает.

### Фаза 6 — декларация ✅

> Отклонения от плана: статусов два (`draft` | `filed`), а не три — «filed» и «locked»
> означали бы одно и то же, подача и есть блокировка. Экспорт PDF/XLSX не сделан.
> Reverse-charge строки пока дают ноль в обе стороны: `netPayable` от этого верен (записи
> взаимно гасятся), но валовые output/input занижены — для корректного отражения нужна
> сохранённая notional-сумма, а это фаза 5.


- `tax_returns` + сервис.
- Агрегация за период: `output_tax` = налог по доходным транзакциям, `input_tax` = по
  расходным, `net_payable = output − input`.
- **Мультивалютность:** транзакции в валюте ≠ валюты юрисдикции конвертируются
  `exchangeRatesService.getRate(txCurrency, jurisdictionCurrency, tx.date)` — по курсу
  **на дату транзакции**, не на сегодня. API уже есть.
- `POST /tax/returns/:id/file` → `status = filed`, пишет `snapshot` jsonb,
  проставляет `tax_locked = true` всем вошедшим транзакциям, в одной транзакции БД.
- Экспорт PDF/XLSX — переиспользовать `reports/report-document.util.ts`.
- **Verify:** e2e — период с транзакциями в KZT и USD, декларация в KZT сходится с
  ручным расчётом; после `file` попытка изменить ставку у вошедшей транзакции → 409.

### Фаза 7 — порог регистрации ✅

- `tax-threshold.service.ts`: сумма облагаемого оборота за `threshold_period`,
  сравнение с `registration_threshold`.
- Уведомления на 80% и 100% через существующий `notifications` модуль. Идемпотентность —
  по `.claude/rules/idempotency.md`, чтобы не слать одно и то же каждый прогон.
- Хук — на существующий крон (`exchange-rates-sync.service.ts` как образец).
- **Verify:** unit — оборот 79% порога молчит, 81% шлёт одно уведомление, повторный
  прогон второе не шлёт.

### Фаза 8 — фронтенд ✅

1. `frontend/app/settings/workspace/page.tsx` — селект юрисдикции + предпросмотр ставок,
   которые будут приняты. Предупреждение при смене на живом workspace.
2. Новая страница `frontend/app/settings/tax/` — таблица ставок (с колонкой периода
   действия) и правил.
3. `CreateExpenseDrawer.tsx:1066` — рядом с выбором ставки показывать разбивку
   net/tax/gross. Сейчас ставка выбирается «вслепую».
4. Декларация — `frontend/app/(main)/reports/` новая вкладка.
5. Локализация через intlayer (`*.content.ts` рядом со страницей — как в
   `settings/workspace/page.content.ts`).
- **Verify:** `npm --prefix frontend run lint:fix` — **Biome И ESLint оба** (см. CLAUDE.md),
  `type-check`, ручная проверка через preview.

---

## Порядок миграций

```
1786050000000-AddTaxJurisdictions          фаза 1  (справочник + сид)
1786060000000-AddWorkspaceTaxJurisdiction  фаза 2  (workspaces + tax_rates)
1786070000000-AddTransactionTaxColumns     фаза 3
1786080000000-CreateTaxRules               фаза 4
1786090000000-AddCounterpartyTaxFields     фаза 5
1786100000000-CreateTaxReturns             фаза 6
```

Все — через `npm run migration:generate`, накат только `npm run migration:run` (лок).
Каждая обратима: `down()` дропает добавленное, справочник — truncate.

## Открытые вопросы

1. **Кто ведёт справочник ставок.** Ставки меняются законом (KZ 12→16% с 2026). Правка
   миграцией = релиз на каждое изменение. Альтернатива — админский эндпоинт. Пока
   миграция; вынести в админку когда стран станет > 10.
2. **US sales tax не влезает в эту модель.** Там ставка зависит от штата и округа
   покупателя, а не от юрисдикции продавца, и это не VAT (нет входящего зачёта).
   Предлагаю `scheme = 'sales_tax'` в фазе 1 завести, но движок под него не строить —
   иначе фаза 4 удваивается. Решить до фазы 4.
3. **Ретроактивная смена ставки.** Если пользователь исправил ставку задним числом,
   пересчитывать незалоченные транзакции автоматически или показывать «пересчитать N
   транзакций?» Склоняюсь ко второму — тихий пересчёт денег пугает.

## Оценка

Фазы 0–4 (движок работает, налог считается) — основной объём.
Фазы 6–8 — примерно столько же.
Фазы 5 и 7 — небольшие, и обе можно отложить без ущерба для остального.

Минимально полезный срез: **0 → 1 → 2 → 3 → 4 → 8(частично)**. Декларация без него
бессмысленна, а он без декларации уже даёт пользу.


---

## Итог по варианту C

Закрыто: фазы 0–8. Движок замкнут от выбора страны до подачи декларации с блокировкой
транзакций.

**Осталось за рамками:** прямой прогон UI в браузере ни разу не удался —
`NEXT_PUBLIC_API_URL` не инлайнится в клиентский бандл при запуске dev-сервера через
превью-харнесс; вместо этого поведение закрыто компонентными тестами.

**Требует внимания перед продом:** ставки в `jurisdictions.seed.ts` и тексты дисклеймеров
должны быть проверены бухгалтером и юристом; `NEXT_PUBLIC_SUPPORT_EMAIL` задан в `.env.example`
(`peterbaikob12@proton.me`) — проверьте написание адреса перед выкаткой.
