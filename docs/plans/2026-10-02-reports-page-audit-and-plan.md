# Страница Reports: аудит против ожиданий пользователей финтех-приложений и план

Дата: 2026-10-02. Статус: исследование + план. Код не менялся.
Базис для анализа — `origin/main` (`121104df`), а не рабочая ветка (см. §1.1).

## 1. Резюме

Страница `/reports` в Lumio — это **генератор документов**, а не место, где смотрят на деньги. Шесть шаблонов → PDF/Excel/CSV, превью, расписания по почте, история файлов, налоговая декларация. В `main` к ним добавлена вкладка **Cash flow** (Sankey + treemap + таблица сравнения с прошлым периодом) — она закрывает примерно половину того, что у Monarch называется «Reports».

Данные с Reddit за 12 месяцев говорят жёстко: **в приложениях этого класса экран «куда ушли деньги в этом месяце по категориям, и как это по сравнению с прошлым» — самый используемый экран продукта**. Формулировки дословно: «Cash flow tab is the reason I pay for Monarch», «my most used page across the entire platform», «I literally ONLY use the Cashflow screen». И столь же жёстко — за что ругают: **нельзя провалиться из графика в транзакции**, **состояние не сохраняется и не шарится ссылкой**, **дефолт «за всё время» вместо текущего месяца**, **нет сравнения YoY/YTD и бюджет-vs-факт**, **переводы и инвестиции попадают в расходы** (у нас это уже решено правильно — главное не сломать).

Что у нас объективно сильно: переводы и взносы в инвестиции исключены из агрегатов по умолчанию, есть тумблер «включить переводы», есть сравнение с прошлым периодом, select all/none по категориям, CSV, расписания с отправкой с SMTP пользователя, налоговый блок, 21 локаль.

Что критично не хватает (в порядке важности):

1. **Drill-down.** Ни один график в Lumio не ведёт в транзакции. Это ломает основной сценарий: «увидел аномалию → провалился → поправил категорию».
2. **Reports не является местом аналитики.** Инсайты живут в сайд-панели `/statements` (Spend over time, Top spenders/merchants/categories), тренды — на дашборде, net worth и forecast — на своих страницах. У пользователя нет одного места, куда идти с вопросом «что происходит с деньгами».
3. **Состояние Cash flow не в URL** — нельзя дать ссылку, нельзя положить в закладку, теряется при уходе со страницы. Это дословная жалоба №1 на новый Reports у Monarch.
4. **Нет сравнения периодов глубже «предыдущий период»**: нет YoY, YTD vs YTD, двух произвольных окон, нет бюджет-vs-факт.
5. **Экспортируемые документы не локализованы** — всегда английские, при 21 локали в интерфейсе (§6, B1). Это баг, а не фича-реквест.
6. **Отсутствующий курс валюты молча искажает отчёт**: во вкладке Cash flow сумма превращается в 0, а в выгружаемых документах — конвертируется по курсу 1.0 (1 000 USD = 1 000 KZT в PDF для бухгалтера). Соседние модули такие случаи честно показывают (§6, B2).
7. **Возврат от магазина выглядит как доход**, пока его вручную не связали с расходом (§6, B10).

План ниже: фаза R0 (неделя) чинит баги доверия и дешёвый паритет, R1 (2–3 недели) превращает Reports в рабочее место с drill-down, R2 (2–3 недели) добавляет сравнения и бюджет-vs-факт, R3 (1–2 недели) — сохранённые отчёты, доставка, итоги года.

### 1.1 Важное замечание про ветки

Текущая рабочая ветка `feat/smart-import-formulas-entity-imports` **отстаёт от `main` на 59 коммитов**. На ней в `backend/src/modules/reports/` лежат `spend-flow.service.ts` / `spend-flow.util.ts` (незакоммиченный «Top spenders Sankey»), а вкладки Cash flow нет вообще. На скриншоте, с которого начался разговор, видно четыре вкладки — значит, стенд поднят с этой ветки, а не с `main`, и вкладки Cash flow там нет. Весь аудит ниже — по `main`; перед любой работой ветку нужно подтянуть.

## 2. Что такое Reports сейчас (по коду)

Файлы: `frontend/app/(main)/reports/`, `backend/src/modules/reports/`.

### Вкладка Templates
[page.tsx](../../frontend/app/%28main%29/reports/page.tsx) собирает шесть шаблонов: P&L, Balance Sheet, Cash Flow Statement, Expense by Category, Transaction Register, Monthly Summary. Карточка раскрывает [ReportGenerator.tsx](../../frontend/app/%28main%29/reports/components/ReportGenerator.tsx): пресеты периода, две даты, формат (excel/pdf/csv), фильтры по кошелькам и категориям ([ReportScopeFilters.tsx](../../frontend/app/%28main%29/reports/components/ReportScopeFilters.tsx)), для Cash Flow — группировка день/неделя/месяц, кнопки «Preview» и «Generate & Download». Превью — табличное ([ReportPreview.tsx](../../frontend/app/%28main%29/reports/components/ReportPreview.tsx)), строится тем же `buildParams`, что и файл, то есть не может разойтись с загрузкой. Balance Sheet — не документ, а отдельный интерактивный экран ([BalanceSheet.tsx](../../frontend/app/%28main%29/reports/components/BalanceSheet.tsx), 749 строк).

Данные документов: `loadReportRows` (`backend/src/modules/reports/reports.service.ts:2952`) — транзакции за период, `isDuplicate: false`, **`transferPairId: IsNull()`** (строка 2973), конвертация в валюту воркспейса по карте курсов.

### Вкладка Cash flow (только в `main`)
[CashFlowView.tsx](../../frontend/app/%28main%29/reports/components/cash-flow/CashFlowView.tsx) + `GET /reports/cash-flow-map` ([cash-flow-map.service.ts](../../backend/src/modules/reports/cash-flow-map.service.ts), чистая часть в [cash-flow-map.util.ts](../../backend/src/modules/reports/cash-flow-map.util.ts)).

Есть: период (4 пресета + две даты), тумблер «Compare with the period before», тумблер «Include transfers and investments», чипы корневых категорий с кнопками All/None, экспорт CSV. Карточки Income / Spending / Net (+ Transfers). Sankey «Where the money went» (источники дохода → итог → категории → подкатегории), treemap «Spending by size» с раскрытием подкатегорий по клику, таблица «By category» с колонками «этот период / прошлый период / изменение».

Нет: фильтра по счетам, группировки по мерчанту, списка транзакций, drill-down, savings rate, состояния в URL, графика по времени (столбцы по месяцам).

### Вкладки Schedules / History / Tax return
[report-schedules.service.ts](../../backend/src/modules/reports/report-schedules.service.ts): cadence daily/weekly/monthly, период — всегда **последний завершённый** (на 1-е число приходит весь прошлый месяц, не кусок текущего), следующий запуск — ближайшие **06:00 UTC** (строка 68), отправка письма через SMTP воркспейса с вложением. История — список + повторное скачивание ([ReportHistory.tsx](../../frontend/app/%28main%29/reports/components/ReportHistory.tsx)). Tax return — отдельный большой блок ([TaxReturnView.tsx](../../frontend/app/%28main%29/reports/components/TaxReturnView.tsx)).

### Где ещё живёт аналитика
`/statements` сайд-панель: Spend over time (календарь), Top spenders, Top merchants, Top categories, Tables reports. Дашборд: Trends tab (дневной тренд + донат категорий за выбранный месяц), CashFlowCard, MonthlyHistoryCard. Отдельные страницы: `/net-worth` (свои диапазоны 1M/3M/6M/1Y/all + ATH), `/forecast`, `/budgets`, `/advice`, `/roi`. Итого — **минимум четыре разных контрола периода** на разных экранах и ни одного общего входа «аналитика».

## 3. Метод и источники

Reddit напрямую недоступен (см. `reddit-research-recipe`), данные взяты из архива Arctic Shift, затем вручную прочитаны топ-комментарии по тредам.

| Источник | Объём |
|---|---|
| r/MonarchMoney | 4000 постов (2025-11-24 → 2026-10-02), прочитаны комментарии 6 тредов |
| r/ynab | 4000 постов, прочитаны комментарии 5 тредов |
| r/copilotmoney | 687 постов |
| r/budget | 4000 постов |
| GitHub issues по `reactions-+1` | actualbudget/actual, firefly-iii/firefly-iii, we-promise/sure — выборка по словам report/chart/sankey/analytics/dashboard |
| Документация Monarch | «Using Reports» (обновлена 2026-09-22), раздел Cash Flow |
| Сторонние расширения | MM-Tweaks for Monarch Money (что люди докупают сбоку) |

Ограничение: для крупных сабов 4000 постов — это потолок пагинации в моём скрипте, то есть окно примерно 10 месяцев, а не 12. Сырые данные — в scratchpad сессии, не в репозитории.

## 4. Чего ждут пользователи

### 4.1 Один клик до «текущий месяц по категориям + сравнение»
Monarch сделал Cash Flow вкладкой внутри Reports (отдельная страница формально осталась) — и получил два самых болезненных по продукту треда за год ([«Why removing cash flow tab?»](https://www.reddit.com/r/MonarchMoney/comments/1vksxn1/), 67↑/64, [«Cash flow Reports — Monarch is officially losing it's mind»](https://www.reddit.com/r/MonarchMoney/comments/1vohjqo/), 110↑/44). Ругали не сам перенос, а потерю привычек: дефолтный период, сохранение состояния, один клик до нужного вида.

Дословно из топ-комментариев:
- «I use the cashflow function all the time over any other Monarch feature… not being able to filter on the current month and see months over time like cashflow» (86↑)
- «Under reports it starts with the stupid Sankey with 20 years data… useless» (51↑)
- «It's insane to take away functionality and then tell users they can create a custom report to get it back» (38↑)
- «Cash flow tab is the reason I pay for Monarch. Remove it, and I am out» (13↑)
- «I'm a busy mom and not going to go through the hassle of learning how to create some kind of custom view!» (8↑)

Вывод: встроенный, открывающийся сразу вид бьёт конструктор. Дефолт — текущий месяц, а не «за всё время».

### 4.2 Drill-down из графика в транзакции
У Monarch это основной механизм: «Click a bar, slice, or block. Selecting part of any chart filters the page to the transactions that make it up», плюс переключатель под графиком **Breakdown | Transactions**. Firefly — issue «Clicking on report graphs should show the transactions behind». MM-Tweaks продаёт «drill into the transactions behind every total» как фичу.

Отдельный мотив: отчёт используют **как инструмент чистки данных**. «I use cash flow quite often. It also helps me spot some incorrect categorizations» (11↑), «I use it daily (to find MM errors in classifying transaction)» (51↑). Значит, из drill-down нужно уметь поправить категорию на месте.

### 4.3 Состояние: ссылка, закладка, возврат «назад»
- «The back button resetting the selected month (and going back to all time totals) is incredibly frustrating» (27↑)
- «if I can't access it on mobile or via a bookmark this is going to be a massive downgrade» (11↑)
- «report settings aren't retained across different tabs and browser sessions» (9↑)

При этом у Monarch обратная крайность: фильтры «липнут» между вкладками и сессиями, и их собственная статья по траблшутингу начинается с «the cause is almost always a filter that's still applied». Правильный ответ: состояние в URL + видимая строка активных фильтров + сброс одной кнопкой.

### 4.4 Сравнение периодов: MoM, YoY, YTD, бюджет-vs-факт
[«YoY reporting is severely lacking»](https://www.reddit.com/r/ynab/comments/1q0e3n5/) (59↑): «Compare YTD actuals plus budget to full year budget to see how you are tracking for the year» (32↑), «Jan 1 I laid out a budget for the year, now on Dec 31 I want to compare how I did» (8↑), «ability to choose two time windows… and see how each category changed on both a percentage and numerical basis» (2↑, но это самая точная формулировка запроса).

Actual Budget по плюсам: «Custom Reports» (163 👍), «Projected Balances Report» (140), «report on category balance» (61), «Annual Budget vs. Spend Report for Enhanced Variance Analysis» (24), «Add "Budgeted" type to Custom Report generator» (25).

MM-Tweaks, первый же пункт: «Trends Report — compare months, quarters, and years, and separate fixed from flexible spending».

### 4.5 Выбор типа графика и измерения группировки
Monarch: селектор графика (Sankey / Trend Bars / Pie / Breakdown / Treemap) и отдельный селектор группировки (Category / Group / Category & Group / Merchant / owner / business entity / Fixed-Flexible). У Copilot самый популярный запрос — [«Sankey diagram plz»](https://www.reddit.com/r/copilotmoney/comments/1pw0f2j/) (31↑). У YNAB — «percentage of income, not just percentage of spend» (94↑/30).

### 4.6 Одинаковые фильтры и диапазоны на всех графиках
- «The fact that they made changes to add the 'standard' filters used everywhere else but didn't include a date range option or the ability to save views sums up how I feel about Monarch» (19↑)
- «Breakdown chart only has options for Monthly, Quarterly, and Annually. Weird. They should just give them the same time options» (17↑)
- YNAB: два отдельных поста «Request to allow filtering of accounts/categories like other graphs for new Income vs. Spending graph».
- [Пост про диапазоны net worth](https://www.reddit.com/r/MonarchMoney/comments/1vfhz6b/) — 248↑/50, «This is my number 1 request» (88↑).

### 4.7 Цифры должны сходиться
Самая массовая претензия к отчётам вообще — переводы и взносы в инвестиции, посчитанные расходом: [«Thank you YNAB for this extremely unhelpful chart»](https://www.reddit.com/r/ynab/comments/1t3orb1/) (311↑/79), «sending money to tracking accounts for investing makes this pretty crazy» (110↑), «my investments are counted as spending!!! I wish I could toggle what is counted as 'spending'» (4↑).

Sure (форк Maybe) собрал весь набор граблей, которые нам нужно не повторить: «Discrepancy in totals between Transactions list and Expenses/Sankey charts», «Expense pie chart omits categories where net amount is positive (income transactions offset expenses)», «Category chart deep-links filter by name, not ID», «Treat investment contributions as transfers instead of expenses».

**Здесь мы в хорошей форме**: `transferPairId IS NULL` в обоих источниках данных отчётов, взносы в инвестиции помечаются `TransferPairKind.INVESTMENT` и тоже выпадают (`investments.service.ts:296`), полные возвраты оформляются парой и выпадают, частичные честно считаются gross. Это нужно зафиксировать тестами, а не потерять.

### 4.8 Базовая гигиена графиков
[«New Features are Great, but Please Fix the Charts!»](https://www.reddit.com/r/MonarchMoney/comments/1t650yq/) (59↑/27): «minimum 20-25% empty space above the largest plotted point», «Label the charts with meaningful dollar figure and time chunk. Charting 101», «putting notes/milestones into chart», «allow the x axis to be $0 like Empower does».

### 4.9 Итоги года и шеринг
«Do you ever do a "year in review" of your finances?» (26↑/24), запрос продакту Monarch про «wrapped»-формат: «highlights from the year, most common merchants, categories… make it fun, make it shareable». Monarch умеет выгружать график картинкой (Download PNG) и шарить через системный share sheet.

### 4.10 Отчёты в ИИ-чате
Copilot в 2026 запустил бету «see charts, right in the Money Assistant» (21↑). Обходной путь, который люди используют уже сейчас: «download the csv… copy/paste both files into Claude/ChatGPT and ask it what you want to know» (6↑). У нас есть и чат, и MCP, и локальная LLM — это направление, где мы можем быть не догоняющими.

## 5. Карта «ожидание → Lumio → вердикт»

| # | Ожидание | Lumio сейчас | Вердикт |
|---|---|---|---|
| 1 | Встроенный вид «текущий месяц по категориям» в один клик | Cash flow открывается на «этот месяц», но скрыт во второй вкладке Reports | частично |
| 2 | Клик по графику → транзакции | нет нигде | **нет** |
| 3 | Переключатель Breakdown ↔ Transactions под графиком | нет | **нет** |
| 4 | Состояние в URL, закладка, возврат «назад» | `useState` в `useCashFlowMap` | **нет** |
| 5 | Сравнение с прошлым периодом | есть (тумблер + колонка Δ) | **есть** |
| 6 | YoY / YTD / две произвольные даты | нет | **нет** |
| 7 | Бюджет vs факт | нет в отчётах (бюджеты — отдельная страница) | **нет** |
| 8 | Выбор типа графика (pie/bars/treemap/sankey) | Sankey + treemap, без выбора | частично |
| 9 | Группировка: категория / группа / мерчант | только категория→подкатегория; доход — по контрагенту top-N | частично |
| 10 | Вкладки Spending и Income отдельно | нет | **нет** |
| 11 | Столбцы по времени (тренд по месяцам) | есть на дашборде, нет в Reports | частично |
| 12 | Фильтр по счетам/кошелькам в аналитике | есть в шаблонах, нет в Cash flow | частично |
| 13 | Фильтр по мерчанту / тегу / сумме | нет | **нет** |
| 14 | Единый набор пресетов периода | три разных контрола на трёх экранах | **нет** |
| 15 | Savings rate на экране | только в Excel-шаблоне Monthly Summary | частично |
| 16 | Переводы и инвестиции не расход | да, по умолчанию, с тумблером | **есть, лучше рынка** |
| 17 | Сохранённые отчёты | нет | **нет** |
| 18 | Расписание по произвольному отчёту | только по 6 шаблонам, только почта | частично |
| 19 | Экспорт картинки графика | нет (CSV есть) | **нет** |
| 20 | Локализованные выгружаемые документы | только Balance Sheet (ru/en/kk) | **баг** |
| 21 | Видно, что часть сумм не сконвертирована | нет: Cash flow считает их нулём, документы — по курсу 1.0 | **баг** |
| 21a | Возврат от магазина не считается доходом | считается доходом, пока не связан вручную | **баг** |
| 21b | Доход в разрезе категорий | только top-6 контрагентов | частично |
| 22 | Итоги года / wrapped | нет | нет |
| 23 | Графики в ИИ-чате | нет | нет |

## 6. Баги и дыры, найденные в коде

**B1. Выгружаемые документы всегда на английском.** `GenerateReportDto.locale` ограничен `@IsIn(['ru','en','kk'])` ([generate-report.dto.ts:36](../../backend/src/modules/reports/dto/generate-report.dto.ts#L36)) и в комментарии честно написано «Only Balance Sheet uses this». `ReportGenerator` вообще не передаёт локаль, `ReportSchedules` — тоже. Заголовки и шапки таблиц захардкожены: `title: 'Profit & Loss (P&L)'` (`reports.service.ts:3036`), `'Revenue'`, `'Expenses'`, `'Metric'`, `'Value'`, `'Savings rate, %'`, `'Uncategorized'` (строка 2993). При этом словарь на все 21 локаль уже существует — [report-export.translations.ts](../../backend/src/modules/reports/report-export.translations.ts) — но используется только старым `/reports/export`. Немецкий или японский пользователь получает на почту английский PDF.

**B2. Отсутствующий курс валюты молча портит цифры — двумя разными способами.**

- Вкладка Cash flow: `cash-flow-map.service.ts:185–193` — `getRateOrNull(...) ?? 0`, дальше `amount * rate`. Сумма **исчезает** из Sankey, treemap и таблицы, ничем не отмеченная.
- Документы: `buildRateMap` зовёт `exchangeRatesService.getRate`, а тот при отсутствии курса пишет warning в лог и **возвращает 1** ([exchange-rates.service.ts:66-71](../../backend/src/modules/exchange-rates/exchange-rates.service.ts#L66)). То есть 1 000 USD превращаются в 1 000 KZT в PDF, который пользователь отправляет бухгалтеру. В самом коде рядом стоит комментарий, объясняющий, почему так делать нельзя («a silent 1 turns 1,000 USD into 1,000 EUR on a declaration»), — налоговый модуль поэтому использует `getRateOrNull`, а отчёты нет.

Для сравнения, как сделано правильно в соседних модулях: `dashboard.service.ts:300`, `balance.service.ts:784`, `net-worth.service.ts:262` собирают `missingRates` и показывают их в UI. Это ровно тот класс багов, из-за которого у Sure висит issue «Discrepancy in totals between Transactions list and Sankey charts».

**B3. Состояние Cash flow не в URL.** `useCashFlowMap` держит фильтры в `useState`; вкладка тоже в `useState` (из URL читается только `?tab=tax`). Ссылку на отчёт отправить нельзя, закладку поставить нельзя, при возврате со страницы категории всё сбрасывается.

**B4. Нет drill-down нигде.** Ни в `CashFlowView`, ни в treemap (клик только раскрывает подкатегории), ни в Top merchants / Top categories / Top spenders. Техническая предпосылка тоже отсутствует: `GET /transactions` (`transactions.controller.ts:67`) принимает один `categoryId`, даты, тип, валюту — но не несколько категорий, не контрагента, не кошелёк и не «без переводов».

**B5. Подписи Sankey переведены на 2 языка из 21.** `LABELS` в `cash-flow-map.service.ts` содержит только `en` и `ru`; `kk`, `de`, `fr`, … получают английские «Other sources», «Left over», «Transfers & investments» внутри переведённой страницы (фронтовые ключи `cf*` при этом в `page.content.ts` переведены).

**B6. Расписания живут в UTC.** `computeNextRunAt` всегда ставит 06:00 UTC (строки 68 и 89), таймзона воркспейса игнорируется. Тема письма — `` `${schedule.templateId}: ${from} — ${to}` `` (строка 232), то есть пользователь получает письмо «pnl: 2026-09-01 — 2026-09-30».

**B7. Нет ретеншена файлов отчётов.** `report_history` только пишется; ни удаления записи, ни очистки каталога (`resolveReportsDir`) нет. Ежедневное расписание складывает по файлу в день навсегда — для self-hosted это рост диска без выключателя.

**B8. Разные пресеты периода на разных экранах.** Reports — 4 пресета (`report-period-presets.ts`: этот месяц, прошлый месяц, этот квартал, YTD), net worth — свой набор (1M/3M/180D/1Y/all), spend-over-time — свой. Нет ни «последние 30 дней», ни «последние 12 месяцев», ни «за всё время».

**B9. Фильтр по счетам есть в шаблонах, но не в Cash flow.** Сценарий «исключить сберегательные счета, чтобы проценты не портили картину» (дословная просьба из треда Monarch) не выполняется.

**B10. Возвраты от магазина раздувают доход.** В `cash-flow-map.util.ts` все приходные строки идут в `incomeBySource` по контрагенту, а расходы считаются gross: `sumExpenses` берёт только `type === 'expense'`. Связка «расход ↔ возмещение» существует ([transfer-pairing.service.ts:235](../../backend/src/modules/transactions/services/transfer-pairing.service.ts#L235)), но она **ручная** — пользователь должен выбрать кандидата. Непривязанный возврат за куртку выглядит как «доход от Zara», а расход на куртку остаётся в категории целиком. Это ровно то, о чём пишут в тредах YNAB («refunds/reimbursements = direct to category»), и то, из-за чего у Sure висит issue про пирог, игнорирующий категории с положительным нетто. Плюс мелочь рядом: источники дохода группируются только по контрагенту и жёстко обрезаны на шести (`maxSources = 6`) — группировки дохода по категории нет вообще.

## 7. План

Оценки: S ≤ 3 дней, M ≤ 2 недель, L > 2 недель. Правила из `.claude/rules/*` (api-standards, database, security, frontend-perf) обязательны. Любая работа начинается с подтягивания `main` в рабочую ветку (§1.1).

### Фаза R0. Доверие и дешёвый паритет (S, ~неделя)

**R0.1 Локализовать документы (B1).** Вынести заголовки документов, секций и колонок всех шести шаблонов в словарь по образцу `report-export.translations.ts` на 21 локаль; снять `IsIn(['ru','en','kk'])`; передавать локаль из `ReportGenerator` и из расписания (поле уже есть в сущности).
Проверка: unit на выбор словаря и фоллбэк на `en`; e2e — PDF шаблона P&L для `de` содержит немецкий заголовок; расписание с `locale: 'ja'` отдаёт японский Excel.

**R0.2 Показать неконвертируемые суммы (B2).** И в `cash-flow-map.service`, и в `buildRateMap` перейти на `getRateOrNull`, собирать список валют без курса и возвращать `missingRates` (как в dashboard/balance/net-worth). В `CashFlowView` — плашка «N операций в CHF не учтены: нет курса» со ссылкой на ручной ввод курса; в документе — строка в шапке «Не сконвертировано: 3 операции в CHF». Курса 1.0 по умолчанию в отчётах быть не должно: это первое, что сделает отчёт неверным и незаметно.
Проверка: unit — транзакция в валюте без курса не исчезает и не конвертируется по 1.0, а попадает в `missingRates`; тест UI на плашку; golden-тест документа с отсутствующим курсом.

**R0.3 Состояние Cash flow в URL (B3).** Вкладка, период, `compare`, `includeTransfers`, категории — в query string; `?tab=` расширить на все вкладки, не только `tax`. Над графиком — строка активных фильтров с «Сбросить».
Проверка: тест, что переход по ссылке восстанавливает фильтры; что возврат «назад» со страницы транзакций не теряет период.

**R0.4 Единый контрол периода (B8).** Один модуль пресетов (последние 7/30/90 дней, этот месяц, прошлый месяц, этот квартал, YTD, последние 12 месяцев, прошлый год, за всё время) и один компонент выбора; применить в Reports, net-worth, spend-over-time, forecast.
Проверка: unit на границы каждого пресета (включая февраль и переход года); snapshot-тест компонента.

**R0.5 Savings rate и число операций в сводке Cash flow (S).** Четвёртая карточка рядом с Income / Spending / Net, формула уже есть в `buildMonthlySummaryDocument`.

**R0.6 Расписания по-человечески (B6).** Время запуска — в таймзоне воркспейса; тема и тело письма — с названием шаблона в локали получателя, периодом и ссылкой на вкладку History.
Проверка: unit на `computeNextRunAt` с таймзоной (включая переход на летнее время); тест темы письма.

**R0.7 Ретеншн отчётов (B7).** Cron, чистящий файлы и записи истории старше N дней (значение по умолчанию в настройках приложения), с пометкой записи как «файл удалён, можно перегенерировать». Готовый образец — [storage-trash.scheduler.ts](../../backend/src/modules/storage/storage-trash.scheduler.ts) (`@Cron('0 3 * * *')`, TTL из настроек, 0 = не чистить).
Проверка: unit на выборку устаревших; интеграционный тест, что скачивание удалённого файла отдаёт понятную ошибку, а не 500.

**R0.8 Возвраты не как доход (S→M, B10).** Минимум: приходная строка с категорией расходного типа вычитается из этой категории, а не попадает в источники дохода; тумблер «Возвраты как отрицательные расходы» рядом с «Включить переводы». Дальше (в R1): предложение привязать возврат к расходу в review inbox, когда приход совпал с недавним расходом по сумме и контрагенту — автоматика здесь опаснее подсказки.
Проверка: unit — возврат 100 за покупку 300 даёт 200 в категории и не меняет доход; тест, что при выключенном тумблере поведение прежнее.

### Фаза R1. Reports как рабочее место (L, 2–3 недели)

**R1.1 Drill-down в транзакции (L).** Под графиком — переключатель **Разбивка | Транзакции**. Клик по узлу Sankey, плитке treemap или строке таблицы фильтрует нижнюю часть. Из списка можно поменять категорию и пометить дубликатом, не уходя со страницы.
Бэкенд: `GET /reports/cash-flow-map/transactions` с теми же фильтрами, что и карта (период, несколько категорий, кошельки, контрагент, `includeTransfers`), пагинация, те же правила исключения — чтобы суммы в списке **сходились с графиком** по построению. Альтернатива — расширить `GET /transactions`, но тогда правила исключения придётся дублировать; предпочтительнее отдельный endpoint, переиспользующий `loadRows`.
Проверка: тест «сумма в списке транзакций равна значению узла Sankey» на фикстуре с переводом, возвратом и мультивалютой; e2e «клик по категории → список → смена категории → график пересчитался».

**R1.2 Вкладки Spending и Income (M).** Селектор графика (пирог, ранжированные бары, treemap, столбцы по времени) и селектор группировки (категория / родительская категория / мерчант / кошелёк). Sankey остаётся только в Cash flow.
Проверка: unit на агрегаты по каждой группировке; тест «доход в Income равен доходу в сводке Cash flow за тот же период».

**R1.3 Общий набор фильтров (M).** Период, счета/кошельки, категории, мерчанты, сумма от/до — один компонент на все вкладки, select all/none, видимая строка активных фильтров. Группировку по тегам пока не обещаем: сущность `Tag` и `TransactionTagsService` есть, но в UI транзакций теги почти не выведены — это отдельная предпосылка.

**R1.4 Столбцы по времени (M).** Доход/расход по месяцам (stacked и grouped), клик по столбцу сужает период нижней части. Ось начинается с нуля, подписи с валютой и периодом, без лишнего воздуха сверху (§4.8).

### Фаза R2. Сравнения и планы (M–L, 2–3 недели)

**R2.1 Сравнение периодов (M).** Режимы: предыдущий период (есть), месяц к месяцу, год к году, YTD к YTD, две произвольные даты. Таблица по категориям с Δ и Δ%, сортировка по величине изменения, клик по строке → транзакции обоих периодов.
Проверка: unit на високосные годы и месяцы разной длины; тест, что YoY за неполный текущий месяц сравнивает сопоставимые окна.

**R2.2 Бюджет vs факт (M).** Отчёт «план/факт/отклонение» по категориям за период и YTD, с учётом rollover (механика уже есть в `modules/budgets`), с выводом «идём с опережением/отставанием на X».
Проверка: unit на категорию с переносом и без; e2e на годовой свод.

**R2.3 Прогноз поверх трендов (S).** Линия прогноза из `modules/forecast` поверх столбцов по времени, с явной границей «факт | прогноз».

**R2.4 Доля от дохода (S).** Переключатель «в валюте / в % от расходов / в % от дохода» на вкладках Spending и Cash flow (запрос YNAB, 94↑).

### Фаза R3. Сохранённые отчёты, доставка, итоги (M, 1–2 недели)

**R3.1 Сохранённые отчёты (M).** Сущность по образцу `storage_views` (`userId` + `workspaceId` + `name` + `jsonb` с фильтрами), список на странице Reports, «открыть / переименовать / удалить», возможность назначить один отчёт стартовым. Важно: сохранённые отчёты — **дополнение** к встроенным видам, а не замена (§4.1).

**R3.2 Расписание по сохранённому отчёту (S).** Снять ограничение «только шесть шаблонов»; добавить канал Telegram (бот уже есть) рядом с почтой.

**R3.3 Экспорт (S).** PNG графика (`echarts.getDataURL`) и CSV транзакций, стоящих за текущим отчётом.

**R3.4 Итоги года (M).** Одна страница по году: топ-мерчанты, топ-категории, savings rate, самый дорогой месяц и день, сравнение с прошлым годом, экспорт картинкой. Дешёвый способ получить то, за чем люди ходят в чужие «wrapped».

### Фаза R4. По решению владельца

**R4.1 Reports как единая точка аналитики.** Перенести Spend over time, Top merchants, Top categories, Top spenders из сайд-панели `/statements` в Reports как режимы группировки и графика (ссылки в сайд-панели оставить ярлыками на соответствующий сохранённый вид). Это убирает дублирование и даёт один ответ на вопрос «куда идти смотреть».

**R4.2 Графики в чате.** Ответ ИИ-чата может содержать график и кнопку «показать транзакции», числа — только из tool-результатов. Выгодно отличает от Copilot-беты тем, что у нас есть локальная модель и MCP.

## 8. Чего не делать

- Не делать конструктор вместо встроенных видов: «we took away the feature and told users to rebuild it as a custom report» — самая дорогая ошибка Monarch за год.
- Не открывать отчёт на «всё время» по умолчанию. Дефолт — текущий месяц.
- Не делать фильтры «липкими» невидимо. Либо они в URL и видны строкой, либо их нет.
- Не держать разные пресеты периода и разные контролы на разных экранах.
- Не считать переводы и взносы в инвестиции расходом ни в одном отчёте по умолчанию (сейчас правильно — закрепить тестами).
- Не показывать сумму, часть которой молча потерялась из-за отсутствующего курса.
- Не прятать рутинные действия (смена категории из отчёта, сброс фильтра) за дополнительный клик.

## 9. Открытые вопросы

1. **Позиционирование страницы.** Делаем Reports местом аналитики (вкладки Overview / Spending / Income / Comparison), а документы убираем в одну вкладку «Документы»? Это меняет первый экран для существующих пользователей и требует release notes.
2. **Переносим ли инсайты из `/statements`** (R4.1) или оставляем два места?
3. **Правка данных из отчёта** (смена категории прямо в drill-down) — делаем сразу в R1.1 или выносим отдельно? Это то, ради чего Monarch-пользователи живут в cash flow, но это же размывает границу «отчёт только читает».
4. **Теги**: вкладывать ли в UI тегирования транзакций, чтобы появилась группировка по тегам (сценарии «отпуск», «ремонт», «налоговые вычеты»)?
5. **Business-профиль**: нужен ли отдельный P&L-режим в Cash flow для воркспейсов с бизнес-профилем (у Monarch это платный тир — у нас может быть просто профиль).

## 10. Источники

Reddit (через архив Arctic Shift): [Why removing cash flow tab?](https://www.reddit.com/r/MonarchMoney/comments/1vksxn1/), [Cash flow Reports — Monarch is officially losing it's mind](https://www.reddit.com/r/MonarchMoney/comments/1vohjqo/), [New in Reports on web: treemap and a new home for Cash Flow](https://www.reddit.com/r/MonarchMoney/comments/1vh5vwd/), [Date range options on the net worth chart](https://www.reddit.com/r/MonarchMoney/comments/1vfhz6b/), [Anyone else miss Mint's net worth history chart?](https://www.reddit.com/r/MonarchMoney/comments/1tzypuq/), [Please Fix the Charts](https://www.reddit.com/r/MonarchMoney/comments/1t650yq/), [Thank you YNAB for this extremely unhelpful chart](https://www.reddit.com/r/ynab/comments/1t3orb1/), [The Income v. Spending graph is really wrong](https://www.reddit.com/r/ynab/comments/1rfan27/), [Analytics are lacking](https://www.reddit.com/r/ynab/comments/1rfyeg3/), [YoY reporting is severely lacking](https://www.reddit.com/r/ynab/comments/1q0e3n5/), [Breakdown as a percentage of income](https://www.reddit.com/r/ynab/comments/1t384pk/), [Sankey diagram plz](https://www.reddit.com/r/copilotmoney/comments/1pw0f2j/).
Документация: [Monarch — Using Reports](https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports).
GitHub: [actualbudget/actual](https://github.com/actualbudget/actual/issues), [firefly-iii/firefly-iii](https://github.com/firefly-iii/firefly-iii/issues), [we-promise/sure](https://github.com/we-promise/sure/issues).
Расширения: [MM-Tweaks for Monarch Money](https://paresi.net/MonarchMoneyTweaks/).
