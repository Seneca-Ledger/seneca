# Командная работа в Lumio: что есть у нас, что у конкурентов, что говорят люди

Дата: 2026-10-05. Автор: сессия Claude по заказу Symon.

Вывод коротко: **менять надо.** Командный слой у нас построен как «малый бизнес»
(роли, инвайты, аудит, права на файлы, заметки с упоминаниями) — и в этой части мы
сильнее всех самохостов. Но измерения «кто из домохозяйства это потратил / чьё это /
что я не хочу показывать партнёру» у нас нет вообще, а именно вокруг него крутятся
все живые жалобы и именно его Monarch сделал своим главным отличием. Плюс найдены три
реальных дефекта в самой модели прав — они закрыты (§5, C0). План — в §6.

## 1. Как собирались данные

- Код: `backend/src/modules/workspaces`, `backend/src/common/guards`,
  `backend/src/entities/workspace-*.entity.ts`, `frontend/app/(main)/workspaces`.
- Поведение прав проверено одноразовым пробным тестом на `PermissionsGuard`
  (прогон в `finflow-backend`, файл удалён) — вывод в §5.
- Reddit-архив Arctic Shift: r/MonarchMoney (600 постов, 2025-04…2026-10), r/ynab,
  r/personalfinance; комментарии через `/api/comments/search`. Рецепт —
  `[[reddit-research-recipe]]`. r/actualbudget и r/FireflyIII архив не отдал (422/пусто),
  поэтому по самохостам опора на GitHub issues.
- GitHub issues конкурентов: actualbudget/actual
  [#4598](https://github.com/actualbudget/actual/issues/4598) (11👍),
  [#1091](https://github.com/actualbudget/actual/issues/1091) (26👍),
  [#524](https://github.com/actualbudget/actual/issues/524),
  [#3438](https://github.com/actualbudget/actual/issues/3438);
  firefly-iii [#372](https://github.com/firefly-iii/firefly-iii/issues/372),
  [#1783](https://github.com/firefly-iii/firefly-iii/issues/1783),
  [discussion #5005](https://github.com/orgs/firefly-iii/discussions/5005).
- Документация конкурентов:
  [Monarch Shared Views](https://help.monarch.com/hc/en-us/articles/42228648365076-Shared-Views-in-Monarch),
  [Firefly III: Make it multi-user](https://docs.firefly-iii.org/how-to/firefly-iii/features/multi-user/),
  [Firefly III: Administrations](https://docs.firefly-iii.org/explanation/financial-concepts/administrations/),
  [YNAB Together](https://support.ynab.com/en_us/ynab-together-B1nS78Cki),
  [YNAB Subscription Sharing](https://www.ynab.com/features/subscription-sharing).

Ограничение: reddit.com напрямую недоступен, отзывы из App Store/Google Play не собирал.
Счётчики голосов ниже — из архива на дату выгрузки.

## 2. Что есть у нас (проверено по коду)

**Пространства и участники.** `workspaces` с владельцем, участниками и приглашениями:
роли `owner / admin / member / viewer`
([workspace-member.entity.ts](backend/src/entities/workspace-member.entity.ts)),
инвайт по email с токеном, сроком жизни и статусом
([workspace-invitation.entity.ts](backend/src/entities/workspace-invitation.entity.ts)),
смена роли и удаление участника
([workspaces.controller.ts](backend/src/modules/workspaces/workspaces.controller.ts)).
Один пользователь может быть в нескольких воркспейсах; домашний (`user.workspaceId`)
отделён от открытого — см. `[[workspace-isolation-2026-09]]`.

**Точечные права поверх роли.** `permissions` jsonb на участнике:
`canEditStatements`, `canEditCustomTables`, `canEditCategories`, `canEditDataEntry`,
`canShareFiles`. Проверяются в `PermissionsGuard` и в `ensureCanEdit`
([ensure-can-edit.util.ts](backend/src/common/utils/ensure-can-edit.util.ts)),
UI раздаёт их в [WorkspaceMembersView.tsx](frontend/app/\(main\)/workspaces/components/WorkspaceMembersView.tsx).

**Обсуждения.** `notes` на выписку или чек с `mentioned_user_ids` и признаком
«решено» ([note.entity.ts](backend/src/entities/note.entity.ts)), уведомление
`note.mentioned`. Отдельно — комментарии к строкам пользовательских таблиц
(`custom_table_row_comments`) и шаринг таблиц (`custom_table_shares`).

**Файлы.** `file_permissions`, `shared_links`, `file_versions`, право `canShareFiles`
— полноценный слой доступа к хранилищу, которого нет ни у одного конкурента из списка.

**Аудит.** 48 типов событий, лента активности воркспейса; доступ только owner/admin
([workspace-activity-access.ts](frontend/app/lib/workspace-activity-access.ts)).

**Уведомления.** `member.invited`, `member.joined`, `workspace_activity`,
персональные настройки с тумблером `member_activity`, тихими часами и дайджестом
([notification-preference.entity.ts](backend/src/entities/notification-preference.entity.ts)).

**Служебное.** Scoped API keys, актор AI/интеграции в аудите через AsyncLocalStorage,
на каждого участника свои правила категоризации (`categorization_rules.user_id`) и
свои сохранённые фильтры хранилища (`storage_views.user_id`).

**Чего нет.** У транзакции нет человека: в
[transaction.entity.ts](backend/src/entities/transaction.entity.ts) есть
`wallet_id`, `branch_id`, `category_id`, `transaction_tags`, `split_group_id`,
`reimbursement_of_id` — и ни одной колонки про участника. Поэтому нет: фильтра
«моё / партнёра / общее», сплита расхода между людьми, персональной очереди
разбора, приватности внутри воркспейса, заметок на транзакцию/бюджет/цель/инвойс,
сводки по нескольким воркспейсам.

## 3. Что у конкурентов

| | Monarch | YNAB | Copilot | Actual Budget | Firefly III | **Lumio** |
|---|---|---|---|---|---|---|
| Несколько людей на одних данных | да, без лимита, включено в $99,99/год | YNAB Together, до 6 человек | **нет** (два человека = 2×$95/год) | да, но через OpenID-сервер | **нет**: administration привязана к одному юзеру | да, без лимита |
| Роли / права | роли есть, но данные видны всем | можно выбрать, какие бюджеты шарить | — | прав на части бюджета нет | — (планируется) | 4 роли + 5 точечных прав |
| Владелец счёта / транзакции | Shared Views: `Shared` или конкретный человек | — | — | просят в [#4598](https://github.com/actualbudget/actual/issues/4598) | просят в [#1783](https://github.com/firefly-iii/firefly-iii/issues/1783) | **нет** |
| Фильтр отчётов по человеку | Accounts / Transactions / Reports / Cash Flow | — | — | — | — | **нет** |
| Правила, назначающие владельца | да, и сплит с разными владельцами | — | — | — | — | **нет** |
| Очередь разбора на человека | «Needs review by» | — | — | — | — | **нет** |
| «Кто что изменил» для участника | — | Recent Moves (с аватаром) | — | — | — | аудит, но только owner/admin |
| Комментарии к транзакции | да | — | — | — | — | только к выписке/чеку |
| Приватность внутри общего доступа | **нет**: «full visibility into the data» | да, выбором бюджетов | — | — | — | **нет** |

Главное из документации Monarch: владелец ставится на счёт, транзакции наследуют его
от счёта, можно переопределить вручную, массово или правилом; фильтр по владельцу есть
в Accounts/Transactions/Reports/Cash Flow и **отсутствует** в Budgets, Recurring, Goals,
Investments. И прямо сказано: приглашённый участник получает полную видимость всех данных.

Самохосты, то есть наши прямые конкуренты по позиционированию, в этом месте пустые:
Firefly открыто пишет, что шарить administration нельзя и что это «big project»,
Actual закрыл [#1091](https://github.com/actualbudget/actual/issues/1091) (26👍) и
[#4598](https://github.com/actualbudget/actual/issues/4598), мульти-юзер там сводится
к «у каждого свой файл бюджета».

## 4. Что люди пишут

Ownership и «кто потратил»:

- «Assigning Amazon retail sync to owner»: общий счёт в Chase, у каждого свой Amazon —
  хотят, чтобы транзакция сама попадала на владельца аккаунта Amazon.
  [r/MonarchMoney](https://www.reddit.com/r/MonarchMoney/comments/1vnm5hq/)
- «Account grouping work around?»: муж и жена хотят каждый свою группу счетов
  (свои «fun money» + свои карты), приложение сваливает всё в Cash и Credit.
  [r/MonarchMoney](https://www.reddit.com/r/MonarchMoney/comments/1vx9mxp/)
- Actual [#4598](https://github.com/actualbudget/actual/issues/4598) (11👍) просит
  ровно это словами: «track each user's personal contributions and shared expenses
  separately», плюс автоматическое деление общего расхода по заданным процентам.

Персональная очередь разбора:

- «Needs review by [not me] — how to keep these out of my review queue?»: поженились,
  слили аккаунты, карты у каждого свои, сделали правила «моё ревьюит я, её — она»,
  и очередь всё равно показывает чужое. Ответ в ветке — «limitations of the current
  system - no known fix», workaround «never use the needs review by anyone option».
  [r/MonarchMoney](https://www.reddit.com/r/MonarchMoney/comments/1w7y3p3/)

Приватность внутри общего доступа:

- «hidden transactions»: купил жене подарок на Рождество, пометил транзакцию скрытой,
  через несколько часов жена видит её в обычном списке. 10↑/12 комментариев.
  [r/MonarchMoney](https://www.reddit.com/r/MonarchMoney/comments/1widoxn/)

Персональные виды:

- «make filters permanent»: «я шарю Monarch с женой», выставляю фильтр «только мои
  счета» — после перезагрузки сбрасывается на все.
  [r/MonarchMoney](https://www.reddit.com/r/MonarchMoney/comments/1vz4jps/)
- «Transaction Columns / Sankey setting not saved»: выключил колонку owner — после
  перелогина вернулась. [r/MonarchMoney](https://www.reddit.com/r/MonarchMoney/comments/1vyiuen/)
- Любимая фича в [«What's your favorite Monarch feature?»](https://www.reddit.com/r/MonarchMoney/comments/1wuftab/)
  (103↑/66c) — «я добавил этот виджет наверх дашборда жены, и она реально следит за
  расходами». То есть персональный дашборд, который можно настроить другому человеку.

Возмещения и «кто кому сколько»:

- «Shared expenses with my ex and expense tracking»: вся ветка — как вручную изобрести
  половину расхода через сплит, трансфер и тег `reimburse`.
  [r/MonarchMoney](https://www.reddit.com/r/MonarchMoney/comments/1wnamwa/)
- «Couples where only one person uses YNAB» (13↑/21c): люди держат **два-три бюджета**
  (личный, партнёра, общий) и руками перекидывают «мою половину» переводами, потому что
  одного измерения «общий/личный» внутри одного бюджета нет.
  [r/ynab](https://www.reddit.com/r/ynab/comments/1wu85jm/)
- «Pour one out for all of those trying to split and categorize your spouse's Target and
  Walmart purchases» (202↑) — уже зафиксировано в
  `docs/plans/2026-10-01-user-expectations-2026-research-plan.md`.

Что людям у конкурентов **хватает** (это не надо догонять): сам факт «один аккаунт, у
каждого свой логин», уведомления, и то, что это не стоит отдельных денег. Главная
претензия к Copilot в обзорах — именно отсутствие этого: «two people means two separate
$95/year subscriptions».

## 5. Три дефекта в нашей модели прав (проверено, C0 закрыта)

Пробный тест на `PermissionsGuard` (глобальная роль пользователя `user`, то есть без
прав на правку — см. `ROLE_PERMISSIONS` в
[permissions.enum.ts](backend/src/common/enums/permissions.enum.ts)):

```
VIEWER -> TRANSACTION_EDIT   allowed = true
VIEWER -> STATEMENT_DELETE   allowed = true
MEMBER(canEditCategories=true) -> CATEGORY_CREATE allowed = false
MEMBER -> budget.create / wallet.create / goal.create allowed = false
```

1. **`viewer` может править и удалять данные.** В
   [permissions.guard.ts](backend/src/common/guards/permissions.guard.ts) ветка
   `statementPermissions` (сюда входят `STATEMENT_EDIT/DELETE`,
   `TRANSACTION_EDIT/DELETE/BULK_UPDATE`) пропускает всех, у кого
   `permissions.canEditStatements !== false`. У `viewer` `permissions` равно `null`,
   потому что UI отправляет права только для роли `member`
   (`inviteRole === 'member' ? invitePermissions : undefined`). `ensureCanEdit` ведёт
   себя так же: `if (membership.permissions?.[key] === false)`. Итого роль
   «только смотреть» не ограничивает ничего, кроме того, что спрятано в UI.
2. **Тумблер `canEditCategories` ничего не включает.** `CATEGORY_CREATE/EDIT/DELETE`
   лежат в `workspaceManagedPermissions`, а эта ветка требует `admin`/`owner`. Значит
   `member` с галочкой «может править категории» всё равно получит 403, и то же —
   `canEditDataEntry` для бюджетов/кошельков/целей. Галочка в UI обещает то, чего нет.

3. **Цели и экспорт отчётов были запрещены всем, включая владельца.** Прогон всех
   59 permission × 4 роли показал `goal.create/edit/delete` и `report.export` =
   нет ни у кого: эти permission не попадали ни в одну ветку `hasWorkspacePermission`,
   а в глобальной роли `user` (её получают все при регистрации,
   [auth.service.ts:214](backend/src/modules/auth/auth.service.ts)) их нет. E2e на
   создание цели не было ни одного.

Это не вопрос фич, это про доверие: воркспейс нельзя дать бухгалтеру «посмотреть».

## 6. План

Порядок осмысленный: сначала чиним права (иначе всё остальное строится на песке),
потом вводим измерение «человек», потом персональные виды и приватность.

### C0. Починить роли — СДЕЛАНО (2026-10-05, не закоммичено)

**Что вышло.** Цепочка `if`-веток в `hasWorkspacePermission` заменена на одну явную
таблицу — [common/authz/workspace-permissions.ts](backend/src/common/authz/workspace-permissions.ts).
Пять правил по порядку: глобальные permission воркспейс не выдаёт никогда; чтение есть
у всех ролей; `viewer` не пишет ничего независимо от колонки; owner/admin получают всё
остальное; `member` пишет только там, где тумблер стоит в `true`. Новый `Permission`
теперь падает в ветку owner/admin, то есть fail-closed, и тест на полноту заставляет
разложить его по корзинам осознанно.

Семантика тумблеров выбрана строгая (решение Symon): отсутствие ключа = «нельзя»,
единая для всех пяти. Миграция
[1786990000000](backend/src/migrations/1786990000000-BackfillWorkspaceMemberPermissions.ts)
прописывает существующим `member` ровно то, что они умеют сегодня —
`canEditStatements`, `canEditCustomTables`, `canEditDataEntry`, `canShareFiles` — и
намеренно не выдаёт `canEditCategories`, потому что сегодня его у них нет. Явный
`false`, выставленный владельцем, сохраняется (`defaults || permissions`).

Привязка тумблеров к permission идёт по их же названиям: `canEditStatements` →
выписки и транзакции, `canEditCategories` → категории. Бюджеты, кошельки, цели,
payables, инвойсы, клиенты, филиалы, подписки и леджер тумблера не имеют и остаются
за owner/admin — как и было.

Попутно: `report.export` отдан owner/admin/member (viewer не экспортирует), а
`goal.*` вернулись к owner/admin — дефект 3 из §5.

Понадобился новый эндпоинт: тумблеры можно было задать только в приглашении, менять у
существующего участника было нечем. `PATCH /workspaces/:id/members/:userId/permissions`
заменяет набор целиком (пропущенный ключ = не выдан), пишет событие в аудит с
`before/after`, доступен owner/admin, на не-`member` роли отвечает 400. В UI участников
появилась кнопка «Access permissions · N/5» с меню из пяти галочек.

**Где.** `common/authz/workspace-permissions.ts` (новый), `common/guards/permissions.guard.ts`,
`common/utils/ensure-can-edit.util.ts`, `common/errors/app-error.ts`,
`modules/workspaces/{workspaces.controller,workspaces.service}.ts`,
`modules/workspaces/dto/update-member-permissions.dto.ts` (новый),
`modules/storage/storage.service.ts` и
`modules/statements/services/receipt-statement.service.ts` (две проверки в обход
утилиты: там `viewer`, загрузивший файл, проходил вообще без проверки),
миграция, фронт `WorkspaceMembersView.tsx` + словарь.

**Чем проверено.**
- `@tests/unit/common/authz/workspace-permissions.spec.ts` — матрица целиком: ни один
  permission не в двух корзинах, список owner/admin закреплён, `viewer` не получает
  ни одной записи при всех пяти тумблерах, `member` получает ровно то, что названо.
- `@tests/unit/common/guards/permissions.guard.spec.ts` — те же случаи через гард.
- `@tests/e2e/workspaces.e2e-spec.ts` — блок «member permissions»: member без тумблера
  → 403 на создание категории, с тумблером → 201, сам себе права менять не может,
  viewer с прописанными прямо в БД тумблерами → всё равно 403, owner создаёт цель и
  экспортирует отчёт.
- Мутационная проверка: снятие правила про `viewer` и удаление `CATEGORY_CREATE` из
  таблицы роняют соответствующие e2e (с `--no-cache`: кэш ts-jest первый раз скрыл это).
- Миграция прогнана на живой строке dev-БД: NULL → четыре права без категорий; частичный
  объект с `canEditStatements:false` → false сохранён, пропуски заполнены.
- Живой стенд: тумблер включён → `POST /categories` 201, выключен → 403.
- Бэкенд unit: 4122 из 4124 (красный `static-assets.util.spec.ts` — предсуществующий,
  про маунт metal-photos). Фронт `WorkspaceMembersView.test.tsx` — 3 из 3.

### C1. Владелец транзакции и счёта — СДЕЛАНО (2026-10-05, не закоммичено)

**Что.** Колонка `owner_member_id uuid NULL` на `transactions` и на `wallets`
(NULL = «общее», ссылка = конкретный участник; FK на `workspace_members` с
`ON DELETE SET NULL`, иначе удаление участника уносит транзакции). Транзакция при
импорте наследует владельца кошелька. Массовая правка владельца в списке транзакций,
правка в карточке, фильтр `ownerMemberId=me|<id>|shared` в транзакциях, отчётах и
cash flow. Сплит у нас — это отдельные строки `transactions` с общим `split_group_id`,
то есть владелец на каждой части появляется автоматически вместе с колонкой: это и есть
«раздели покупку в Target пополам».

Не трогаем бюджеты, цели, подписки и инвестиции: у Monarch фильтра по владельцу там
тоже нет, и это не вызвало жалоб.

**Где.** `entities/transaction.entity.ts`, `entities/wallet.entity.ts`, миграция
(нужна метка `db-approved`), `modules/transactions` (фильтр + bulk update + split),
`modules/reports`, `modules/dashboard`, фронт: список транзакций, карточка, фильтры
отчётов.

**Как сделано.** Колонка `owner_member_id` на `transactions` и `wallets`, FK на
`workspace_members` с `ON DELETE SET NULL` (участник ушёл — его строки становятся
общими, а не удаляются), частичный индекс `(workspace_id, owner_member_id) WHERE
owner_member_id IS NOT NULL`: «общее» это NULL, и индексировать его незачем. Миграция
[1787000000000](backend/src/migrations/1787000000000-AddTransactionOwnerMember.ts).

Наследование от кошелька живёт в одном месте — в классификации
([classification.service.ts](backend/src/modules/classification/services/classification.service.ts)),
там же, где решается `walletId`. Поэтому его получают все пути импорта сразу, включая
банковскую синхронизацию, и ни один из них не заводит свою копию правила. Наследование
только при создании: перенос строки в другой кошелёк потом владельца не переписывает.
Части сплита берут владельца исходной строки.

Фильтр — общий хелпер
[transaction-owner.util.ts](backend/src/common/utils/transaction-owner.util.ts):
`owner=me|shared|<memberId>`, где `me` раскрывается на сервере из нового
`request.workspaceMemberId` (его ставит `WorkspaceContextGuard`, достаёт декоратор
`@WorkspaceMemberId()`), а `shared` — это именно `IS NULL`, отдельный ответ, а не
«без фильтра». Подключён к `GET /transactions`, top-categories, spend-over-time,
spend-flow и cash-flow-map.

Запись: `ownerMemberId` в `UpdateTransactionDto` (nullable: отсутствие ключа — «не
трогать», `null` — «вернуть домохозяйству»), в bulk-update и в `CreateWalletDto`.
Чужой membership отбивается на запись — иначе в колонке оказалась бы ссылка на другой
тенант. В ответ `/workspaces/me` и `/workspaces/:id` добавлен `memberId`: раньше наружу
отдавался только `userId`, а владеет строками membership.

UI: выпадашка «Чьи траты» в тулбаре транзакций, «Assign owner» в панели массовых
действий и в карточке транзакции. Для воркспейса из одного человека все три не
рендерятся вовсе.

**Проверка.**
- Unit: таблица разбора `owner` (`me` без membership → весь воркспейс, `shared` → не
  «всё»), биндинг параметра вместо подстановки, отказ на чужой membership; наследование
  владельца от кошелька и «общий кошелёк → общая строка».
- E2e `transaction-owner.e2e-spec.ts` (10 кейсов): всё стартует общим, назначение каждому,
  возврат в общее через `null`, 400 на membership чужого воркспейса, `me` у двух разных
  людей отдаёт разное, `shared` отдаёт только непомеченное, отчёт с `owner=shared` даёт
  100 вместо 300, массовое назначение.
- Мутационная проверка: превращение ветки `shared` в no-op роняет и фильтр, и отчёт;
  удаление наследования роняет оба юнита (с `--no-cache`).
- Живой стенд: кошелёк с владельцем создаётся, с чужим membership → 400; фильтры
  `me/shared/<id>` и `top-categories?owner=shared` (300 → 100) совпадают с UI; в UI
  выбрана строка → «Shared» → Apply → «Owner updated», и строка действительно ушла
  в общие.
- Бэкенд unit 4143 из 4145 (красный `static-assets.util.spec.ts` предсуществующий),
  e2e transactions/workspaces/reports-counted/cash-flow-map/spend-flow — 76 из 76.

**Что осталось за кадром.** Фильтр по владельцу не выведен в шапку страницы отчётов —
бэкенд его принимает, но UI отчётов отдельного контрола пока не имеет.

### C2. Правила на владельца и персональная очередь разбора — СДЕЛАНО (2026-10-05, не закоммичено)

**Как сделано.** Миграция не понадобилась: условия и действия правил лежат в jsonb,
так что добавились только поля в `ClassificationCondition`/`ClassificationResult`.

Владелец как **действие**: `result.ownerMemberId` раздаёт строку человеку или
возвращает её домохозяйству через `null`. Правило бьёт наследование от кошелька —
кошелёк это умолчание, а правило пользователь написал сам (флаг `ruleSetOwner`).

Владелец как **условие**: поле `owner`, где `shared` означает «ничей». Словом, а не
`null`, потому что `evaluateCondition` считает `null` отсутствием значения и не
матчит ничего. Важное ограничение, записанное в самом интерфейсе: у свежей строки
импорта владельца ещё нет — он появляется от кошелька уже после прогона правил, —
поэтому условие по владельцу срабатывает при переклассификации существующей строки,
а не на первом проходе импорта.

Очередь разбора: `reviewer=me|anyone` на `GET /review-inbox` и
`GET /review-inbox/counts`. `me` — это **моё плюс общее**, а не строго моё: общее это
состояние, в котором рождается каждая строка, и очередь «строго моего» спрятала бы
бэклог домохозяйства от обоих. В `OwnerFilter` для этого появился вид
`memberOrShared`. Чеки и подписки ничьи, фильтр их не касается.

Фильтр доведён до **счётчиков**, а не только до списка — это и есть баг Monarch
(«как сделать, чтобы плашка не висела, когда разбирать нечего именно мне»).
Красная точка на иконке Review теперь спрашивает `reviewer=me`.

По умолчанию страница Review и точка показывают `me`, но только когда в воркспейсе
больше одного человека: `useHouseholdMembers` отдаёт пустой список для воркспейса из
одного, и тогда вопрос «чьё» не встаёт вовсе. Выбор живёт в URL (`?reviewer=anyone`).

**Где.** `common/utils/transaction-owner.util.ts` (вид `memberOrShared`,
`parseReviewerFilter`), `modules/classification/interfaces/classification-rule.interface.ts`,
`classification.service.ts`, `categorization-rules.controller.ts` (+ проверка, что
владелец из этого воркспейса), `modules/review-inbox/*`, фронт:
`components/review/useReviewer.ts` (новый), `useReviewInboxTotal.ts`,
`(main)/review/hooks/useReviewInbox.ts`, `ReviewInboxView.tsx`,
`hooks/useWorkspaceMembers.ts` (разделён на `useHouseholdMembers` без `useAuth` и
обёртку с `isSelf` — иначе значок Review тянул бы AuthProvider на каждую страницу).

**Проверка.**
- Unit: `parseReviewerFilter` («me» → mine-plus-shared, не строго mine; без membership
  → весь воркспейс), SQL вида `memberOrShared`; правило отдаёт строку названному
  человеку поверх кошелька; условие `owner = shared` матчит ничью строку и не матчит
  чужую.
- E2e `review-inbox-reviewer.e2e-spec.ts` (6 кейсов): общий бэклог без фильтра, моя
  очередь без чужих строк но с общими, у двух людей разные очереди из одних данных,
  счётчики совпадают со списком, **пустая очередь когда всё оставшееся чужое**,
  400 на неизвестного reviewer.
- Мутации: счётчики, игнорирующие reviewer, роняют два кейса; снятие `!ruleSetOwner` и
  удаление `case 'owner'` роняют оба юнита правил.
- Фронт: `useDefaultReviewer` — «один человек → anyone», «домохозяйство → me», «пока
  участники грузятся → anyone».
- Живой стенд: правило с чужим membership → 400; правило отдало Amazon партнёру при
  переклассификации; из двух строк (общая + партнёрская) очередь владельца с `me` = 1,
  партнёра с `me` = 2, без фильтра у обоих 2; в UI Review по умолчанию «Mine» с одной
  строкой, `?reviewer=anyone` — две; после approve моей строки точка на иконке Review
  исчезла, хотя строка партнёра ещё ждёт.
- Бэкенд unit 4153 из 4155 (красный `static-assets.util.spec.ts` предсуществующий),
  e2e review-inbox/review-inbox-reviewer/transaction-owner/category-source — 31 из 31.
  Фронт по затронутым областям — 118 из 118.

### C3. Персональные виды и приватность — СДЕЛАНО (2026-10-05, не закоммичено)

**Исходное предложение было неверным.** «Строка не видна, но в суммах участвует»
течёт вычитанием: партнёр видит «Продукты 320/400» при видимых строках на 250, и
разница 70 — ровно цена подарка. Приватность, которая вычисляется арифметикой, хуже
её отсутствия, потому что ей доверяют. Решение Symon — вариант C.

**Как сделано (вариант C).** Приватная строка **видна всем** — дата и сумма на месте,
скрыты мерчант, назначение, номер документа, контрагент и комментарий. Категория не
маскируется при чтении, а **реально переносится** в системную `Private`
([private-category.ts](backend/src/modules/categories/private-category.ts), одна на
воркспейс и тип, как `Uncategorized`), а исходная кладётся в `private_category_id` и
возвращается при снятии приватности.

Почему перенос, а не маска: маска сделала бы каждую сумму зависящей от того, кто
смотрит, а две такие суммы отличаются ровно на скрытую величину. С переносом
**ни одна агрегация в приложении не зависит от зрителя** — а их 59 билдеров в 25
модулях, и патчить их все было бы и дорого, и ненадёжно. Зависят от зрителя только
несколько текстовых полей строки, а они числа не выдают.

Ставить приватность может только владелец строки и только на свою: общая строка — это
строка, от которой некому скрывать (`TRANSACTION_PRIVATE_NOT_OWNER`). Это опирается на
C1.

**Персональные виды.** `storage_views` обобщать не стал — это *именованные* виды
хранилища, другая сущность. Жалобы Monarch («фильтр сбрасывается», «колонка
возвращается») — про «запомни, как я оставил страницу», поэтому отдельная таблица
`view_preferences(user_id, workspace_id, scope, state jsonb)` с уникальным ключом и
upsert. Сервер внутрь `state` не смотрит: форма принадлежит странице. Подключено к
списку транзакций (фильтры владельца и валюты); восстановленный владелец сверяется со
списком участников, иначе ушедший партнёр оставил бы фильтр, дающий пустую страницу.

**Где.** Миграции [1787010000000](backend/src/migrations/1787010000000-AddPrivateTransactions.ts)
и [1787020000000](backend/src/migrations/1787020000000-AddViewPreferences.ts) (нужен
db-approved), `common/utils/transaction-privacy.util.ts`, `modules/categories/private-category.ts`,
`modules/transactions`, `modules/review-inbox`, `modules/view-preferences` (новый),
фронт: `useViewPreference`, `lib/private-category.ts`, карточка транзакции, список.

**Проверка.**
- Unit: редактура щадит владельца и прячет от остальных, сохраняет сумму и дату,
  обнуляет исходную категорию; «приватная и ничья» читается как скрытая.
- E2e `transaction-privacy.e2e-spec.ts` (10 кейсов), главный — **сумма видимых строк
  равна показанному итогу**, и обе картины категорий совпадают у владельца и партнёра
  (`Advertising 70, Private 70`), то есть вычитать нечего.
- E2e `view-preferences.e2e-spec.ts` (6 кейсов): upsert вместо роста строк, у каждого
  свой вид, неизвестная страница → 400.
- Мутации: выключенная редактура и неперенесённая категория роняют по тесту каждая.
- Живой стенд: владелец видит «Jewellery shop», партнёр — «—» с той же суммой; отчёт
  у обоих `[('Advertising', 70), ('Private', 70)]`, итого 140 = сумма видимых строк
  партнёра. Фильтр пережил перезагрузку, в карточке галочка «Hide from the others» с
  пояснением.
- Бэкенд unit 4163 из 4165 (красный `static-assets.util.spec.ts` предсуществующий),
  e2e privacy/view-preferences/owner/reviewer/transactions — 48 из 48. Фронт по
  затронутым областям — 123 из 123.

**Что UI показал, а тесты нет.** Системная `Private` сначала создавалась с
`isEnabled: false`, чтобы не лезть в пикеры, — и строка стала рисоваться как
«Private — select category», будто её надо дочинить. Теперь категория обычная
включённая, а из пикеров её убирает клиент (`lib/private-category.ts`).

### C4. Обсуждения там, где люди спорят о деньгах — СДЕЛАНО (2026-10-05, не закоммичено)

**Как сделано.** `NoteEntityType` расширен на `transaction`, `budget`, `goal`,
`invoice`: колонка и внешний ключ на каждый тип, `CHECK` переписан на «ровно одна из
шести». Полиморфной пары `(type, id)` по-прежнему нет — удаление цели уносит обсуждение
каскадом, без ручной уборки.

Разветвление по типу в сервисе заменено одной таблицей `targets` (тип → колонка +
репозиторий), поэтому следующий тип цели — это одна строка, а не ещё одна ветка в трёх
местах (`requireTarget`, `targetColumns`, счётчики).

Упоминания и `note.mentioned` переиспользованы как есть; у события пришлось расширить
`entityType` со `'statement' | 'receipt'` до строки — уведомление по нему только строит
ссылку.

Фронт: в карточке транзакции появилась вкладка Notes с тем же `NotesPanel`, что на
выписке и чеке. Бюджет, цель и инвойс бэкенд уже принимает, панель туда не подключена.

**Где.** Миграция [1787030000000](backend/src/migrations/1787030000000-AddNoteTargets.ts)
(нужен db-approved), `entities/note.entity.ts`, `modules/notes/notes.service.ts`,
`modules/notifications/events/notification-events.ts`, фронт: `hooks/useNotes.ts`,
`components/transactions/DetailsDrawer.tsx`.

**Проверка.**
- E2e `note-targets.e2e-spec.ts` (8 кейсов): заметка на транзакции и на цели, цели не
  смешиваются, счётчики на список, цель чужого воркспейса → 404, неизвестный тип → 400,
  и два кейса про удаление (ниже).
- Живой стенд: заметка на транзакции с упоминанием партнёра → у него уведомление
  `note.mentioned`; в UI вкладка Notes показывает её с автором и кнопками
  «Mark resolved» / «Delete».
- Бэкенд unit 4163 из 4165 (красный `static-assets.util.spec.ts` предсуществующий),
  e2e note-targets/privacy/view-preferences/reviewer/owner/workspaces — 70 из 70.

**Что тест поймал в самом тесте.** Сначала проверял, что удаление цели уносит заметку
каскадом, — не уносит: цели удаляются мягко (`softRemove`), и это правильно, потому что
восстановленная цель должна вернуться с обсуждением. Тест переписан на два кейса:
мягко удалённая цель заметку сохраняет, жёстко удалённая транзакция — уносит.

### Фильтр по владельцу в отчётах — СДЕЛАНО (2026-10-05)

Контрол «Чьи траты» добавлен в шапку вкладки Cash flow рядом с Export CSV; `owner`
уходит в `/reports/cash-flow-map` (проверено по сетевому логу: `&owner=shared`). Для
воркспейса из одного человека не рендерится. Остальные отчётные эндпоинты параметр
принимают с C1, но своего контрола пока не имеют.

### C5. Лента «кто что сделал» для участников — СДЕЛАНО (2026-10-05, не закоммичено)

**Как сделано.** Отдельный эндпоинт `GET /audit-events/activity` за
`TRANSACTION_VIEW`, а не за `AUDIT_VIEW`. Полный аудит остаётся owner/admin и
продолжает отвечать участнику 403.

Граница проведена **по типу сущности**, а не по действию: деньги и план —
дело домохозяйства, безопасность и администрирование — дело владельца.
`HOUSEHOLD_ENTITY_TYPES` в [workspace-activity.ts](backend/src/modules/audit/workspace-activity.ts)
перечисляет первое; всё новое по умолчанию оказывается снаружи, пока его не внесут
туда осознанно.

Лента **не отдаёт ни `diff`, ни `meta`**. Это и есть стык с C3: в diff транзакции
лежат мерчант и сумма, а приватная строка приватна от остальных. Описание безопасно по
построению — оно называет изменённые *поля*, а не их значения, а имя сущности берёт из
`name`/`title`/`label`, которых у транзакции нет.

Фронт: карточка «Кто что менял» на вкладке Overview. Для воркспейса из одного человека
не рендерится — каждая строка читалась бы как «это сделали вы».

**Где.** `modules/audit/workspace-activity.ts` (новый), `audit.service.ts`,
`audit.controller.ts`, фронт: `components/dashboard/WorkspaceActivityCard.tsx`,
`OverviewTab.tsx`. Миграция не нужна — читается существующая таблица аудита.

**Проверка.**
- Unit: админские типы в ленту не входят, денежные входят; `diff` и `meta` отброшены и
  в выводе нет значения мерчанта; откаты имени актора (имя → почта → метка → «—»).
- E2e `workspace-activity.e2e-spec.ts` (7 кейсов): участник ленту читает, полный аудит
  ему 403, событие приглашения (`workspace_member`) в ленту не попало, но в полном
  аудите есть; чужой воркспейс пуст; `limit` работает.
- Мутации: возврат `diff` в ленту и добавление `workspace_member` в список типов роняют
  по кейсу каждая.
- Живой стенд: участник видит обе записи и `403` на полном аудите, строк с «Jewellery
  shop» и «Anniversary» в ленте нет; в UI карточка показывает три строки с именем,
  описанием и временем.

**Удалён мёртвый код.** `frontend/app/lib/workspace-activity-access.ts` с тестом: на
него никто не ссылался, а его утверждение «member → false» прямо противоречило бы
новой ленте, если бы кто-то его подключил.

**Баг, найденный живой лентой.** В ленте стояло «Changed transaction: paymentPurpose,
**isPrivate**…» на правке, которая приватности не касалась. Причина в C3:
`updateDto.isPrivate = undefined` на no-op **создаёт** ключ, `Object.assign` копирует
его на строку, и аудит видит изменение. Заменено на `delete`; закрыто юнит-тестом
`transaction-privacy-noop.spec.ts` (мутация ловится). Попутно: biome-правило
`noDelete` предлагает ровно то присваивание, которое было багом — подавлено с
причиной.

### Шумное описание в аудите — ПОЧИНЕНО (2026-10-05, не закоммичено)

**Моя же гипотеза оказалась неверной.** Я написал, что «`after` неполный». Проба по
сохранённой строке аудита показала обратное: сам `diff` корректен — на правке одного
поля отличаются ровно `updatedAt` и `paymentPurpose`. Шум рождался в построении
описания.

**Настоящая причина.** Ledger-колонки объявлены
`@Column({ select: false, insert: false, update: false })` — их намеренно не грузят и не
пишут. На загруженной строке они `undefined`, поэтому при сохранении снимка в jsonb
просто исчезают; в копии, вернувшейся из `save()`, они приходят как `null`.
`getChangedFieldKeys` сравнивал через `JSON.stringify`, где `undefined` даёт `undefined`,
а `null` — строку `"null"`, и считал это изменением. Отсюда «Changed transaction:
paymentPurpose, ledgerPostedAt, ledgerError and 1 more» на переименовании.

Данные при этом не портятся: `update: false` означает, что TypeORM эти колонки не
записывает.

**Как починено.** Один хелпер `hasChanged` в
[audit-description.service.ts](backend/src/modules/audit/description/audit-description.service.ts):
отсутствующий ключ и явный `null` — это одно и то же «ничего». Чинится весь класс шума
для всех сущностей сразу, а не три имени колонок в списке исключений.

**Проверка.**
- Unit: поле, которое строка не грузила, в описание не попадает; реально очищенное
  (значение → null) и реально заполненное (null → значение) по-прежнему попадают;
  отсутствующий ключ равен явному null.
- Мутация: возврат к голому `JSON.stringify` роняет два кейса.
- Живой стенд, одна и та же транзакция до и после:
  `Changed transaction: paymentPurpose, ledgerPostedAt, ledgerError and 1 more`
  → `Changed: paymentPurpose`. Правка трёх полей читается как
  `paymentPurpose, transaction category, categorySource and 2 more` (всё настоящее),
  очистка комментария — `Changed: comments`.
- Бэкенд unit 4177 из 4179 (красный `static-assets.util.spec.ts` предсуществующий),
  e2e activity/privacy/transactions — 33 из 33.

**Что осталось нетронутым.** Снимки `before`/`after` по-прежнему хранят всю строку
(~70 ключей, включая вложенный объект категории) на каждое событие. Для массовой правки
500 транзакций это 500 пар таких снимков. Трогать не стал: откат удаления восстанавливает
строку именно из полного `before`, так что обрезка — отдельная задача со своим риском.

### Что сознательно не делаем

- Сводку по нескольким воркспейсам сразу. Люди у YNAB действительно держат 2–3 бюджета,
  но у нас воркспейсы — это ещё и изоляция тенанта и налоговая юрисдикция; «общий
  дашборд поверх всех» ломает и `workspaceId`-дисциплину, и `x-workspace-id`. Правильный
  ответ на их боль — ownership внутри одного воркспейса (C1), а не агрегат поверх разных.
- Автоматическое деление расхода по процентам (из Actual #4598). Сначала C1: руками
  поставить владельцев на части сплита. Проценты — отдельная фича, если кто-то попросит.
- Долги между участниками («кто кому сколько»). У нас уже есть `reimbursement_of_id`;
  после C1 он начинает читаться как «я заплатил, партнёр вернул». Отдельный модуль
  Splitwise не нужен.

## 7. Что решить Symon

1. ~~C0: `canEditCategories`/`canEditDataEntry`~~ — решено: доведены до работающих прав,
   отсутствие ключа значит «нельзя». Сделано.
2. ~~C3: приватная транзакция в суммах домохозяйства~~ — решено: вариант C, строка
   видна с суммой и датой, скрыты мерчант/назначение/категория, категория переносится
   в `Private` для всех. Сделано.
3. Порядок: C0–C5 закрыты — план выполнен целиком.
4. ~~Фильтр по владельцу в шапке отчётов~~ — сделан на вкладке Cash flow.
   Остальные отчёты параметр принимают, контрола не имеют — добавить, если понадобится.
5. Панель заметок подключена только к карточке транзакции. Бюджет, цель и инвойс
   бэкенд принимает — подключить, когда дойдут руки до их экранов.
5. C2 по умолчанию ставит очередь Review в «Mine» для домохозяйства. Это то, что просят
   пользователи Monarch, но означает, что строки партнёра по умолчанию не видны —
   переключатель «Everyone» рядом. Если хочется наоборот, меняется одной строкой в
   `useDefaultReviewer`.
6. Условие `owner` в правилах не срабатывает на первом проходе импорта (владелец ещё
   не известен). Если нужно иначе — придётся разносить классификацию на два прохода.
