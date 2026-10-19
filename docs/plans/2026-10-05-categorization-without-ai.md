# Авто-категоризация без ИИ и без затрат: аудит, сравнение с рынком, план

Дата: 2026-10-05. Статус: исследование + план, код не менялся.
Повод: авто-категоризация в Lumio фактически выключена, потому что давала неверные срабатывания.
Вопрос: можно ли сделать нормальное определение категории без ИИ и без денежных затрат.

## 1. Вывод

**Да, можно — но «нормально» нужно определить честно.**

Детерминированный движок способен уверенно закрывать *подмножество* строк и
**отказываться** от остальных. Правильная цель не «100 % строк с категорией», а:

- **precision ≥ 98 %** среди авто-проставленных категорий,
- **recall 40–75 %** в зависимости от источника данных (см. §7: с MCC от банка — верх диапазона, из PDF/CSV без кодов — низ),
- всё остальное → «Uncategorized» + очередь Review, которая у нас уже есть.

Главный аргумент в пользу «без ИИ»: **у лидера по удовлетворённости категоризацией (YNAB) никакого ИИ
нет** — это история по payee плюс правило «2 из 3». А те, кто вкрутил ИИ (Monarch, Copilot),
собирают ровно те жалобы, из-за которых мы свою категоризацию и выключили (§5).

Второй аргумент: **мы сейчас выбрасываем бесплатные детерминированные сигналы** — MCC/SIC,
ISO 20022 `BkTxCd`, категорию из QIF и из CSV-экспортов (§7). Это не «сделать ИИ дешевле»,
это «перестать терять то, что банк уже прислал».

Чего детерминированный движок не сделает никогда — в §10. Там же показано, что ИИ эти кейсы тоже не решает.

## 2. Что в коде сейчас

Цепочка существует и описана: `manual → rule → keyword → learned → history → ai → default`
(`transactions.category_source`, `category_reason`, фаза 0.3 от 2026-10-01).
Точка входа — `ClassificationService.classifyTransaction`, авто-часть — `autoClassifyCategory`
(`backend/src/modules/classification/services/classification.service.ts:275`).

Что из этого реально работает без ИИ:

| Шаг | Где | Что делает | Состояние |
|---|---|---|---|
| rule | `:511` `getClassificationRules` | правила пользователя + **12 зашитых шаблонов Kaspi/RU** | шаблоны вредны вне KZ (§3.3) |
| keyword | `:695` `matchWorkspaceCategories` | сопоставляет **имя категории** с текстом дескриптора | генератор ложных срабатываний (§3.1) |
| keyword | `:301` зашитые regex | 22 паттерна на русском (`зарплат`, `аренд`, `налог`…) | работает только для RU/KZ B2B |
| learned | `:1111` `matchByLearnedPatterns` | Жаккар по сырому тексту, порог 0.7, **`take: 100`** | почти не срабатывает (§3.2) |
| history | `:402` `findCategoryByHistory` | **точное равенство** `counterparty_name` | почти не срабатывает (§3.2) |
| ai | `classifyTransactionsBatch` | внешняя LLM | требует ключа; у self-hosted обычно нет |

Что выключено сознательно и правильно:

- **Скан чека больше не угадывает категорию.** В `receipt-statement.service.ts` убран fallback
  «взять первую включённую расходную категорию»: он подшивал несвязанные сканы под случайную
  категорию, а Review показывал это так, будто категорию выбрал человек. (Изменение в дереве, не закоммичено.)
- **Ничего не считается, пока человек не подтвердил** (`is_verified`, `counted-transactions.util.ts`).
  Это правильная страховка, но она же и прячет проблему: неверные категории не видны в отчётах,
  зато очередь Review растёт.

Чего нет вообще:

- нормализации дескриптора (`SQ *BLUE BOTTLE 8821` → `blue bottle`) — её делает только LLM в `ai-category-classifier.helper.ts`, заполняя `vendor_normalized`;
- использования MCC / SIC / `BkTxCd` / категории из QIF и CSV (§7);
- справочника брендов (план есть: `docs/plans/2026-10-03-brand-detection-and-logos.md`, не реализован);
- переопределения на уровне мерчанта («для этого payee всегда X» / «никогда не угадывай»);
- массовой переклассификации и «применить правило к прошлому»;
- **любых измерений**: нет золотого набора, нет метрики precision/recall. Фичу выключили по ощущениям,
  потому что измерить было нечем.

Дублирование: у чеков свой независимый словарь ключевых слов
(`receipts/services/receipt-category.service.ts:17` и `:80`), ru/en/kk, не связанный с цепочкой выше.

## 3. Дефекты, воспроизведённые на нашем же коде

Функции `tokenizeForCategoryMatch`/`categoryWordsMatch` (`:952`) и `calculateTextSimilarity` (`:1278`)
скопированы дословно в отдельный скрипт и прогнаны по реальному списку системных категорий из dev-БД
(`Advertising, …, Rent, Sales, Services, Taxes, Travel, Vehicle expenses`) и по типичным дескрипторам.

### 3.1 Шаг «keyword» уверенно врёт

```
HIT   ENTERPRISE RENT-A-CAR 4471  -> Advertising, Insurance, Maintenance and repairs,
                                     Materials, Meals and entertainment, Payroll,
                                     Rent, Sales, Taxes, Travel        (10 категорий!)
HIT   DELTA INTERNET DELTA.COM    -> Interest, Interest income
HIT   TRANSFERWISE SERVICES LTD   -> Services
HIT   SALESFORCE.COM INC          -> Sales
HIT   TRAVELODGE LONDON           -> Travel
HIT   RENTOKIL INITIAL PLC        -> Rent
HIT   MATERIALSCIENCE GMBH        -> Materials
HIT   PAYPAL *TAXESFREE           -> Taxes
```

Две причины, обе в `categoryWordsMatch`:

1. `categoryWord.includes(searchWord)` — **токен из одной буквы матчит почти любую категорию**.
   `RENT-A-CAR` токенизируется в `rent a car`; токен `a` содержится в `advertising`, `payroll`, `taxes`… Длина токена поиска нигде не проверяется (проверяется только длина слова категории, `>= 3`).
2. Сравнение по префиксу в 4 символа: `travel`↔`travelodge`, `rent`↔`rentokil`, `sales`↔`salesforce`,
   `materials`↔`materialscience`.

Побеждает первая подошедшая категория в порядке выборки — то есть результат ещё и недетерминирован
относительно порядка категорий в БД.

Это ровно тот класс ошибок, на который жалуются у Monarch («Delta Internet Delta.com» → Internet, §5).

### 3.2 Шаги «learned» и «history» почти не срабатывают

Жаккар по сырому тексту при пороге 0.7:

```
0.67  silent | sq *blue bottle coffee 8821 …   VS   sq *blue bottle coffee 9113 …
0.67  silent | rewe sagt danke 6334 //berlin   VS   rewe sagt danke 1182 //berlin
0.50  silent | amzn mktp de*2r45t9sk3          VS   amzn mktp de*7k12p0qd8
0.50  silent | оплата услуг по договору 17 …   VS   оплата услуг по договору 42 …
```

Тот же магазин во второй раз **не узнаётся**, потому что номер терминала/заказа меняет один токен из трёх.
Зато две разные транзакции с одинаковой канцелярской шапкой («оплата услуг по договору…») при более
длинной шапке легко перевалят порог и дадут **чужую** категорию.

`findCategoryByHistory` сравнивает `counterparty_name` **на точное равенство** — для карточных
дескрипторов это почти никогда не истина.

Итог: слой обучения молчит там, где должен срабатывать, и срабатывает там, где не должен. Добавить
нормализацию дескриптора — и обе проблемы исчезают *без* смены алгоритма.

### 3.3 Зашитые шаблоны Kaspi создают русские категории в любом воркспейсе

`getClassificationRules` (`:511`) для каждого из 12 шаблонов вызывает `ensureCategory` с литеральной
русской строкой: `'Платежи Kaspi Red'`, `'Зарплаты сотрудникам'`, `'Аренда'`, `'Комиссии Kaspi'`…
`ensureCategory` создаёт отсутствующую категорию (`source = 'parsing'`). То есть первый же импорт в
немецком или испанском воркспейсе засеивает его русскими категориями, даже если ни одно правило не сработает.
Плюс 12 запросов `ensureCategory` на каждый вызов классификации.

## 4. На что жалуются пользователи похожих приложений

Данные: архив Arctic Shift (reddit.com из этой среды недоступен, см. `reddit-research-recipe`),
HN Algolia, GitHub. Проверено 700 постов r/MonarchMoney и 600 постов r/ynab за 2025–2026.

**Т1. ИИ-переименование мерчанта ломает правила.** `Merchant Renaming — Is this ever getting fixed?`
(44↑/28 комм., 2026-08). Цитаты: «rules became USELESS with their garbage AI renaming merchants»;
«I had transactions being changed from "Fidelity" to "Wells Fargo"»; регистрация ACEP → переименована в
«Enterprise» (пользователь едва не оспорил транзакцию в банке). Рабочий обход, найденный сообществом:
**строить правила только по сырому полю Original Statement**, потому что нормализованное имя нестабильно.

**Т2. ИИ-категоризация, которую нельзя выключить.** `Automatic categorization keeps getting worse`
(118↑/53). «This AI slop that can't be turned off… I already set up rules myself so why are you bypassing
that for your shitty inaccurate AI»; «one investment transaction categorized as "rent"»; «Home Depot
charge was assigned to Apple (cuz I used my watch)»; «Delta Internet Delta.com» → Internet.
Побочный эффект: «constant budget overage notifications because the transactions are categorized wrong».

**Т3. Одно разовое исключение портит категорию payee навсегда.** Официальный пост YNAB
`[Update] We're adjusting how auto-categorization works` (372↑/66, 2026-08): раньше категория payee
= последняя использованная, из-за чего одна покупка подарочной карты в продуктовом переводила весь
payee в «Gifts». Новое правило: **категория по умолчанию меняется, только если 2 из 3 последних
транзакций согласны**. Топ-комментарий (196↑): «I very, very much prefer this».

**Т4. Нет ручки «не угадывай».** `Is it possible to disable auto-categorization?` (r/CopilotMoney):
нельзя; пользователь идёт на костыли через смарт-фильтры. Пользователь там же формулирует потолок
любой автоматики: «I categorize based on intention, not on simple things like name. A coffee shop might
be a personal drink, a drink with friends, a networking chat… There's no way I would expect Copilot to
tell which is which».

**Т5. Переводы между своими счетами считаются тратами.** `App keeps categorizing random charges as
internal transfers instead of regular transactions`. У нас это уже закрыто парностью переводов (фаза 0.1).

**Т6. Правила не применяются к прошлому / не перезапускаются.** `Create a rule without updating past
transactions?`, и у Monarch: изменение merchant вручную **не** перезапускает правила.

**Т7. Усталость от ручной разборки.** HN: «I usually quit after a few months because keeping everything
categorized and up to date feels like work, not help». HN же формулирует требование к продукту:
«Intelligent categorization from "STBCKS3134" to "Starbucks [Dining]"» — то есть **нормализация
дескриптора это и есть задача**, а не побочная деталь.

## 5. Как устроено у тех, у кого это не горит

| Продукт | Движок категоризации | ИИ | Жалобы |
|---|---|---|---|
| **YNAB** | история по payee + правило «2 из 3»; в `Manage Payees` три режима: авто / всегда моя категория / не категоризировать | нет | Т3 закрыт официально, пост собрал 372↑ одобрения |
| **Copilot** | (1) категория от агрегатора, отображённая в их список; (2) обучение на правках пользователя, применяется **только при высокой уверенности** и помечается звёздочкой в чипе; (3) правила по имени | «Intelligence», не LLM | Т4: нет выключателя |
| **Monarch** | ИИ-переименование + ИИ-категоризация | да | Т1, Т2 — самые злые треды в сабреддите |
| **Actual Budget** | только правила | нет | PR «Add Transaction Categorization with an ML Model» (#7657) и issue «integrate with a categorization API» (#4449) — оба закрыты, не влиты |
| **Digits** (профильная ML-команда) | своя модель | да | их собственный заявленный потолок — **93,5 %** accuracy |

Выводы, которые отсюда следуют для нас:

1. Ни один признанно-хорошо-работающий движок не строится на LLM. YNAB — вообще на одном payee-history.
2. Самый ценный бесплатный сигнал — **категория/код от источника данных** (Copilot ставит его первым шагом).
3. Нормализованное имя мерчанта **нельзя** делать базой для правил. Правила — по сырой строке.
4. Автоматика обязана уметь молчать и показывать, **почему** она так решила. 93,5 % у профильной ML-команды
   означает: 1 ошибка на 15 строк даже у лучших — значит нужен не «более умный угадыватель», а отказ от угадывания
   при низкой уверенности.

## 6. Карта дыр: мы против рынка

| Что | Рынок | Lumio сейчас | Дыра |
|---|---|---|---|
| сырой дескриптор неизменяем и доступен для правил | YNAB, Monarch (Original Statement) | `counterparty_name`/`payment_purpose` сырые, но `vendor_normalized` пишет LLM | формально ок, но нет гарантии «правила только по сырому» |
| нормализация дескриптора → ключ payee | все | **нет** (только LLM) | **главная дыра**, из-за неё молчат learned и history |
| категория/код от источника (MCC, BkTxCd, QIF `L`, CSV Category) | Copilot, Monarch, Actual (QIF) | **выбрасывается при парсинге** | **вторая главная дыра** |
| справочник брендов | у всех через платные API | нет (есть план на NSI) | закрывается бесплатно |
| история по payee | YNAB (2 из 3) | Жаккар по сырому тексту, `take: 100` | срабатывает редко и наугад |
| защита от разового исключения | YNAB «2 из 3» | есть, в виде `ESTABLISHED_OCCURRENCES = 2` | ок |
| режим payee «всегда X / не угадывай» | YNAB | нет | нужно |
| провенанс «почему эта категория» | Copilot (звёздочка) | `category_source` + `category_reason`, показывается в Review и в карточке | **ок, лучше рынка** |
| выключатели ИИ | требуют (Т2, Т4) | есть на уровне воркспейса | **ок** |
| применить правило к прошлому / массовая переклассификация | требуют (Т6) | `POST /classification/bulk` есть, UI и «apply to past» нет | частично |
| измеримость (golden set, precision) | — | **нет** | нужно, иначе нечем принять работу |

## 7. Бесплатные детерминированные сигналы, которые мы сейчас выбрасываем

Проверено по коду парсеров (`backend/src/modules/parsing/parsers/statement-formats.util.ts`):

| Формат | Что в файле есть | Что мы берём | Что теряем |
|---|---|---|---|
| **OFX** (`parseOfx`, `:62`) | `NAME`, `MEMO`, `TRNTYPE`, **`SIC`** | name, memo, FITID | **`SIC`** (отраслевой код мерчанта), `TRNTYPE` (`FEE`, `INT`, `DIV`, `XFER`, `ATM`…) |
| **QIF** (`parseQif`, `:147`) | `P`, `M`, **`L` = категория из приложения-источника** | P, M, N | **`L` целиком.** Это экспорт из другого бюджетника — там категория уже проставлена человеком |
| **camt.053** (`parseCamt053`, `:217`) | `RmtInf`, `Cdtr/Nm`, **`BkTxCd` (Domn/Fmly/SubFmly)**, `Purp/Cd`, у карточных — `MCRD` + детали карты | имя, назначение, ссылка | **`BkTxCd`** (ISO 20022: домен/семейство/подсемейство — комиссия, проценты, карта, зарплата, налог), **`Purp/Cd`** (ISO ExternalPurpose: `SALA`, `TAXS`, `RENT`, `INSU`…) |
| **MT940** | `:61:` код типа операции (`NTRF`, `NCHG`, `NINT`, `NDIV`…), `:86:` структурированные подполя | дата/сумма/описание | коды типа операции |
| **CSV-пресеты** (`csv-presets.ts`) | у N26, Monzo, Revolut есть колонка Category/Type | тип маппинга не содержит `category` вовсе | **категорию из экспорта банка** |
| **SimpleFIN** (`simplefin.provider.ts`) | `description`, `payee`, `memo` | всё | ничего (MCC там нет — честно) |
| **Enable Banking** (есть на неслитой ветке) | `merchant_category_code` (ISO 18245), `bank_transaction_code` (ISO 20022) — оба опциональные | — | **MCC и BkTxCd** |

Справочники для расшифровки — публичные стандарты, не вендорские данные:
ISO 18245 (MCC, ~1000 строк), ISO 20022 ExternalPurposeCode и BankTransactionCode (ExternalCodeSets,
публикуются ISO 20022 как бесплатный Excel/JSON), SIC-коды. Всё это статические таблицы на десятки
килобайт в репозитории. Ноль сетевых вызовов, ноль денег.

Отдельно: `openenrichment` (CC0, ~550 мерчантов) даёт готовые `transaction_text_examples` — это
бесплатный тестовый материал для очистителя дескрипторов.

## 8. Архитектура: слои, по убыванию точности

Принцип: **каждый слой либо отвечает уверенно, либо молчит**. Первый ответивший побеждает,
`category_source` записывает, кто именно ответил. Ни один слой не создаёт категорий.

```
L0  сырая строка неизменяема; все правила и обучение матчатся по ней
L1  manual          — человек поставил руками                       (есть)
L2  rule            — правило пользователя по сырой строке           (есть, вычистить шаблоны)
L3  payee override  — «для этого payee всегда X» / «не угадывай»      (новое)
L4  source code     — MCC / SIC / BkTxCd / Purp / QIF L / CSV Category (новое, §7)
L5  payee history   — ключ payee + правило «2 из 3»                   (переписать L-learned/L-history)
L6  brand index     — NSI: бренд → OSM-тег → категория                (план от 2026-10-03)
L7  structural      — перевод/комиссия/подписка/чек/счёт              (частично есть)
--  abstain         — Uncategorized + Review                          (есть)
```

Ключевой новый примитив — **нормализатор дескриптора** (`descriptor-normalizer.ts`, чистый модуль):

```
вход:  "SQ *BLUE BOTTLE COFFEE 8821  OAKLAND CA   AUTH 004512"
выход: { payeeKey: "blue bottle coffee",
         acquirer: "square",
         location: "oakland ca",
         stripped: ["8821", "auth 004512"] }
```

Что он снимает (всё — таблицами, не эвристиками «на глаз»):
префиксы эквайеров и платёжных посредников (`SQ *`, `TST*`, `SP `, `PAYPAL *`, `IZ *`, `SumUp`, `Zettle`,
`PP*`, `WPY*`), хвосты «город/страна», номера терминалов/заказов/договоров, даты, маски карт, коды
авторизации, `//`-разделители банков, многократные пробелы, регистр, диакритику.
`payeeKey` — то, на чём строятся L5 и L6; он **никогда не показывается вместо сырой строки** и
**никогда не используется в правилах пользователя** (урок Т1).

## 9. План реализации

Пять фаз. Каждая самостоятельна и проверяема; после F0 можно остановиться и уже получить пользу.

### F0. Измеримость и обезвреживание (обязательно первым)

Без этого нельзя ни принять работу, ни доказать, что стало лучше.

1. **Золотой набор.** `backend/@tests/golden/categorization/*.jsonl`: ≥ 300 строк
   (`rawDescription`, `amount`, `currency`, `countryHint`, `expectedCategory | "unknown"`).
   Источники: обезличенные строки из наших же парсерных фикстур, `transaction_text_examples`
   из openenrichment (CC0), синтетика по форматам эквайеров. Отдельный раздел — **ловушки из §3**
   (`ENTERPRISE RENT-A-CAR`, `SALESFORCE`, `TRAVELODGE`, `RENTOKIL`, `DELTA INTERNET`) с
   ожидаемым `unknown`.
   → Проверка: `npm --prefix backend run test:golden` по образцу `parsing.golden.spec.ts`
   печатает precision / recall / abstain. Baseline фиксируется в файле.
2. **Чинить `categoryWordsMatch`** (`:952`): требовать длину токена поиска ≥ 4 и **полное равенство
   токена**, убрать `includes` и префиксное сравнение. Либо — предпочтительно — **удалить шаг
   `matchWorkspaceCategories` целиком**: после F2 он не нужен, а его вклад в precision отрицательный.
   → Проверка: все 5 ловушек из п. 1 дают `unknown`; precision на baseline не падает.
3. **Убрать зашитые Kaspi/RU-шаблоны** из `getClassificationRules` (`:511`) и regex-блок (`:301`)
   из кода в данные: `bank-profile`/локаль воркспейса (у нас уже есть `bank-profile.service.ts`).
   Ни один шаблон больше не вызывает `ensureCategory` — правило без существующей категории просто не грузится.
   → Проверка: e2e — импорт в воркспейс с английскими категориями не создаёт ни одной категории
   с `source = 'parsing'`; дев-БД: `select count(*) from categories where source='parsing'` не растёт.
4. **Склеить словарь чеков с общей цепочкой**: `receipt-category.service.ts` перестаёт иметь свои
   таблицы (`:17`, `:80`) и зовёт тот же движок.
   → Проверка: существующие unit-тесты чеков зелёные, дубля словарей в репозитории нет (`grep`).

Объём: ~1,5 дня. Риск низкий, миграций нет.

### F1. Нормализатор дескриптора

1. `backend/src/modules/classification/descriptor/descriptor-normalizer.ts` — чистый модуль без
   зависимостей от Nest и БД, таблицы префиксов/суффиксов рядом в `descriptor-rules.ts`.
2. Колонки `transactions.payee_key` (varchar, индекс) и `transactions.raw_description`
   (если сырой строки где-то нет — проверить, что все парсеры её сохраняют). **Нужна метка `db-approved`.**
   Заполнение при импорте; существующие данные не трогаем (как и в прошлый раз — без бэкфилла,
   решение Symon'а от 2026-10-04), но `payee_key` считается на лету для старых строк в момент чтения истории.
3. `vendor_normalized` остаётся отдельным полем LLM — мы его не трогаем и на него не опираемся.
   → Проверка: unit-таблица «вход → payeeKey» на ≥ 60 строках, включая `transaction_text_examples`;
   метрика «одинаковый магазин дважды даёт одинаковый ключ» на золотом наборе ≥ 95 %;
   отдельный тест, что `payeeKey` **не** попадает ни в одно пользовательское правило.

Объём: ~2 дня. Одна миграция.

### F2. Сигналы от источника (L4)

1. Парсеры перестают выбрасывать: `parseOfx` → `SIC`, `TRNTYPE`; `parseQif` → `L`;
   `parseCamt053` → `BkTxCd` (Domn/Fmly/SubFmly), `Purp/Cd`, `MrchntCtgyCd` где банк его даёт;
   MT940 → код из `:61:`. Складываются в `ParsedTransaction.sourceCodes` и далее в
   `transactions.source_codes jsonb` (**`db-approved`**).
2. `csv-presets.ts`: в union типов маппинга добавить `'category'`; прописать колонку Category
   у N26 и Monzo, Type у Revolut.
3. Справочники `backend/src/modules/classification/codes/`: `mcc.json` (ISO 18245),
   `iso20022-purpose.json`, `iso20022-btc.json`, `sic.json` — каждый отображается в **наш семантический
   тип категории**, а не в имя категории, и потом сопоставляется с категориями воркспейса по
   `category.type`/иконке (имена у пользователя могут быть любые и на любом языке).
4. Категория из QIF/CSV = категория **человека из другого приложения**: ставим её как
   `category_source = 'source'` и, если имя не совпало ни с одной существующей, кладём в Review
   как предложение «создать категорию X» — но **не создаём молча**.
   → Проверка: golden-набор пополняется 3 файлами (OFX с `SIC`, QIF с `L`, camt.053 с `BkTxCd`);
   e2e импорта проверяет `category_source='source'` и что ни одна категория не создана без подтверждения.

Объём: ~3 дня. Одна миграция. **Самая высокая отдача на единицу работы.**

### F3. История по payee (L5) и переопределения (L3)

1. Выбросить Жаккар (`:1278`) и `take: 100` (`:1131`). Вместо `category_learning` «как есть» —
   агрегат по `(workspace_id, payee_key, category_id)` с счётчиком и датой последней транзакции
   (материализованная таблица `payee_category_stats`, **`db-approved`**).
2. Правило YNAB: категория payee по умолчанию меняется, только когда **2 из 3 последних** транзакций
   этого payee согласны; при < 3 транзакциях — последняя. Существующий
   `ESTABLISHED_OCCURRENCES = 2` ложится сюда естественно.
3. `findCategoryByHistory` (`:402`) матчится по `payee_key`, а не по точному `counterparty_name`.
4. Таблица `payee_overrides`: режим `auto | always:<categoryId> | never` (три режима YNAB), UI —
   в карточке транзакции и в новом экране «Мерчанты».
   → Проверка: unit на правиле «2 из 3» (включая кейс YNAB с подарочной картой в продуктовом);
   на золотом наборе recall шага history вырастает с ~0 до ≥ 40 % при precision ≥ 99 %;
   e2e: `never` для payee → строка приходит в Review без категории.

Объём: ~3 дня. Одна-две миграции.

### F4. Справочник брендов (L6) и доведение

1. Реализовать `docs/plans/2026-10-03-brand-detection-and-logos.md` (таблицы `brands`/`brand_names`,
   скрипт сборки индекса из NSI, матч по границам токенов, фильтр по стране).
2. **Новое по сравнению с тем планом:** OSM-тег бренда (`shop=supermarket`, `amenity=fuel`,
   `amenity=pharmacy`, `amenity=cafe`…) — это **готовая таксономия**. Таблица `osm_tag → наш тип категории`
   на ~120 строк закрывает merchant → category для всех сетевых брендов бесплатно и офлайн.
3. «Применить к прошлому» для правил и переопределений поверх существующего `POST /classification/bulk`
   (идемпотентно, с аудитом и откатом — инфраструктура `modules/audit/rollback` уже есть),
   плюс предпросмотр «затронет N строк» (у нас уже есть `POST /categorization-rules/test`).
   → Проверка: precision ≥ 98 % среди авто-применённых на золотом наборе, ноль матчей из списка
   ложных срабатываний NSI (§3 того плана); «применить к прошлому» дважды не меняет результат.

Объём: ~4 дня (из них 3 — по уже написанному плану). Одна миграция.

### Порядок и критерий приёмки

F0 → F2 → F1 → F3 → F4 тоже допустим (F2 не зависит от нормализатора), но F0 строго первая.
Фича включается обратно только когда на золотом наборе: **precision ≥ 98 %, abstain честно
показывается в Review, и ни один тест из списка ловушек §3 не даёт категорию.**

## 10. Чего это не решит (и ИИ тоже не решает)

1. **Независимые кафе, мастерские, частники.** Их нет ни в NSI, ни в MCC-разрезе (MCC скажет
   «ресторан», но не какой). Закрывается только гео-путём для чеков (`captureLocation` + Nominatim
   `/reverse`), и только там, где есть координаты.
2. **Категория по намерению.** «Кофе с клиентом» против «кофе себе» — одна и та же строка.
   Это принципиально нерешаемо без ввода человека (цитата пользователя Copilot, Т4). Правильный ответ
   продукта — быстрый разбор в Review и теги, а не более умный угадыватель.
3. **Маркетплейсы.** Amazon/Wildberries одной строкой на корзину из пяти категорий. Решается только
   чеком/письмом о заказе (у нас есть IMAP и Gmail-чеки) либо сплитом вручную.
4. **Свободный текст назначения платежа в B2B** на флективных языках. Правила возьмут частотные формы
   («аренда», «зарплата», «налог»), остальное — в Review. Это ровно то, что сейчас делают зашитые
   regex — их нужно не удалить, а вынести в данные и включать по локали/банк-профилю.
5. **Потолок точности.** Профильная ML-команда (Digits) заявляет 93,5 %. Детерминированный движок с
   правом молчать даст меньше покрытия, но выше точность — а именно точность определяет доверие:
   одна ошибка в бюджете порождает ложный алерт «перерасход» (Т2).

## 11. Ловушки

- **Нельзя строить правила пользователя по нормализованному имени.** Это дословно убило правила у
  Monarch (Т1). Правила — только по сырой строке; `payee_key` — внутренний ключ движка.
- **Нельзя молча создавать категории.** Сейчас `ensureCategory` это делает (§3.3). Любой новый слой
  обязан выбирать только из существующих категорий воркспейса.
- **Нельзя сравнивать имена категорий с текстом транзакции.** Имя категории — произвольная строка
  пользователя на любом языке; §3.1 показывает, во что это превращается.
- **MCC не универсален.** SimpleFIN его не отдаёт, у Enable Banking он опционален, в camt.053 зависит
  от банка. Поэтому L4 — не фундамент, а слой: без него должны работать L5/L6.
- **Порядок категорий в выборке влиял на результат** — любой новый матчер обязан быть детерминированным
  (явный приоритет, а не «первая подошедшая из `findAll`»).
- Миграции требуют метки `db-approved` (их в плане 4).
- Жаккар/Левенштейн (`string-similarity.util.ts`) после F3 остаются только у сопоставления чеков —
  не тащить их в категоризацию обратно.

## 12. Источники

Reddit (архив Arctic Shift, проверено 2026-10-05):
- [r/MonarchMoney — Automatic categorization keeps getting worse (118↑/53)](https://www.reddit.com/r/MonarchMoney/comments/1tch4tb/)
- [r/MonarchMoney — Merchant Renaming: Is this ever getting fixed? (44↑/28)](https://www.reddit.com/r/MonarchMoney/comments/1vi1ad3/)
- [r/MonarchMoney — categorization is significantly worse](https://www.reddit.com/r/MonarchMoney/comments/1wi7eir/)
- [r/MonarchMoney — How is the recurring merchants feature so bad? (86↑/24)](https://www.reddit.com/r/MonarchMoney/comments/1vtntd8/)
- [r/ynab — [Update] We're adjusting how auto-categorization works (372↑/66)](https://www.reddit.com/r/ynab/comments/1vrt3ac/)
- [r/ynab — Payee management: what upgrades do you want to see?](https://www.reddit.com/r/ynab/comments/1wj58h1/)
- [r/CopilotMoney — Is it possible to disable auto-categorization?](https://www.reddit.com/r/CopilotMoney/comments/1ic0qhb/)
- [r/CopilotMoney — App keeps categorizing random charges as internal transfers](https://www.reddit.com/r/CopilotMoney/comments/1httncb/)

Hacker News:
- [«Intelligent categorization from STBCKS3134 to Starbucks [Dining]»](https://news.ycombinator.com/item?id=6606855)
- [Digits: 93,5 % accuracy в категоризации транзакций](https://news.ycombinator.com/item?id=43337351)
- [beancount-import: decision-tree классификатор, обучающийся по ходу](https://news.ycombinator.com/item?id=20120787)

GitHub:
- [actualbudget/actual#7657 — Add Transaction Categorization with an ML Model (закрыт)](https://github.com/actualbudget/actual/pull/7657)
- [actualbudget/actual#4449 — integrate with a categorization API (закрыт)](https://github.com/actualbudget/actual/issues/4449)

Стандарты и данные:
- ISO 18245 (MCC) — [обзор](https://en.wikipedia.org/wiki/Merchant_category_code); ISO 20022 External Code Sets (BankTransactionCode, ExternalPurposeCode)
- [Enable Banking API reference](https://enablebanking.com/docs/api/reference/) — `merchant_category_code`, `bank_transaction_code`
- [osmlab/name-suggestion-index](https://github.com/osmlab/name-suggestion-index) (BSD-3)

Внутренние:
- `docs/plans/2026-10-01-user-expectations-2026-research-plan.md` (§F0 Categorization trust)
- `docs/plans/2026-10-03-brand-detection-and-logos.md`
