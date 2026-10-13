jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService, MetadataScanner } from '@nestjs/core';
import type { TestingModule } from '@nestjs/testing';
import { Arbitrary, Effect, Schema, SchemaAST } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { SCHEMA_BODY_METADATA } from '../../src/common/effect/schema-body';
import { IS_PUBLIC_KEY } from '../../src/modules/auth/decorators/public.decorator';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';
import { seedWorkspace } from './helpers/seed-workspace';

/**
 * User A, in their own workspace, aims every route of the API at workspace B:
 * B's ids in every path parameter, in every id a request body carries, and B's
 * workspace in the header.
 *
 * - No answer A gets may hold B's data: B's ids, the marker every text of B's
 *   seed carries, or a file served for B's id.
 * - None of B's rows may change, and none of A's may come to point at one of
 *   B's (a budget on B's category, B's tag on A's file).
 * - No request may end in an unhandled error (500): a foreign id is a 403 or
 *   a 404. A 502-504 is a deliberate answer: there is no network here.
 *
 * B is seeded with nearly every kind of record, and a positive control checks
 * that the same scan, run by B over its own lists, does find B's data. Bodies
 * are generated from each route's contract, so they get past validation and
 * reach the code that looks the ids up.
 */

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface Route {
  method: HttpMethod;
  path: string;
  handler: string;
  body?: Schema.Top;
}

const METHODS: Partial<Record<RequestMethod, HttpMethod>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
};

/**
 * Out of the sweep: routes that act on the caller's own account (a sweep that
 * logs A out or changes A's password stops testing anything) and routes that
 * call outside services.
 */
const EXCLUDED =
  /^\/(auth|users\/me|maps|vendor-icons|public|metrics|health|telegram\/webhook|webhooks\/|gmail\/webhook|integrations\/)|^\/goals\/covers|^\/workspaces\/backgrounds|^\/ai-analysis\/(completions|model-proxy)/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A body field that names a record: `id`, `categoryId`, `transactionIds`. */
const ID_KEY = /(^id|Ids?)$/;
/** Path nouns that are not the name of their table. */
const TABLE_ALIASES: Record<string, string> = { files: 'statements', file: 'statements' };
/** How many id combinations to try per route at most. */
const MAX_COMBINATIONS = 120;
/** Generated bodies per route without path parameters. */
const BODIES_PER_ROUTE = 3;

const toSnake = (value: string) =>
  value
    .replace(/-/g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();

/** A stable seed per route: adding a route elsewhere does not change what this one gets. */
const seedOf = (text: string) =>
  [...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7);

function discoverRoutes(app: INestApplication): Route[] {
  const discovery = app.get(DiscoveryService);
  const scanner = new MetadataScanner();
  const routes: Route[] = [];
  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    if (!instance || !metatype) continue;
    const prefixes = [Reflect.getMetadata(PATH_METADATA, metatype) ?? ''].flat() as string[];
    const classPublic = Boolean(Reflect.getMetadata(IS_PUBLIC_KEY, metatype));
    const prototype = Object.getPrototypeOf(instance);
    for (const name of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[name];
      const method = METHODS[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
      if (!method || classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler)) continue;
      const body = Reflect.getMetadata(SCHEMA_BODY_METADATA, prototype, name) as
        | Schema.Top
        | undefined;
      for (const prefix of prefixes) {
        for (const path of [Reflect.getMetadata(PATH_METADATA, handler) ?? ''].flat() as string[]) {
          const full =
            `/${[prefix, path].filter(Boolean).join('/')}`
              .replace(/\/+/g, '/')
              .replace(/\/$/, '') || '/';
          if (!EXCLUDED.test(full)) {
            routes.push({ method, path: full, handler: `${metatype.name}.${name}`, body });
          }
        }
      }
    }
  }
  return routes;
}

describe('Workspace isolation sweep (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = [`sweep-a-${stamp}@example.com`, `sweep-b-${stamp}@example.com`];
  const markers = [`amark${stamp}`, `bmark${stamp}`];
  let a: E2eAccount;
  let b: E2eAccount;
  /** Every id of B's, with the table it lives in. */
  const bIds = new Map<string, string>();
  /** The same for A, whose own records go in the path while the body names B's. */
  const aIds = new Map<string, string>();
  /** B's rows per table, as the predicate that selects them. */
  const bTables: Array<{ table: string; where: string; hasId: boolean }> = [];
  /** Queries that count A's rows pointing at B's, one per foreign key between workspace data. */
  const crossChecks: Array<{ label: string; sql: string }> = [];
  let routes: Route[] = [];

  const as = (
    account: E2eAccount,
    method: HttpMethod,
    url: string,
    workspaceId = account.workspaceId,
  ) =>
    request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${account.token}`)
      .set('x-workspace-id', workspaceId)
      .timeout(10_000);

  const foundIds = (text: string) => [...bIds.keys()].filter(id => text.includes(id));

  /** B's ids A has put in a write: an answer may hand them back ("3 not found", a saved field). */
  const sentIds = new Set<string>();

  /**
   * What of B's a successful answer holds: one of B's ids A never sent (any
   * at all when `strict`), B's texts, or a file served for a path naming B's id.
   */
  const leakedBy = (res: request.Response, sent: string, strict: boolean): string[] => {
    if (res.status >= 300) return [];
    const text = res.text ?? '';
    const found = foundIds(text)
      .filter(id => strict || !sentIds.has(id))
      .map(id => bIds.get(id) ?? id);
    if (text.includes(markers[1])) found.push('marker');
    const isJson = /json/.test(String(res.headers['content-type'] ?? ''));
    const hasContent = text.length > 0 || (Buffer.isBuffer(res.body) && res.body.length > 0);
    if (res.status === 200 && !isJson && hasContent && foundIds(sent).length > 0) {
      found.push(`a file (${res.headers['content-type']})`);
    }
    return found;
  };

  /** Every foreign key along which A's data points at B's, with how many rows. */
  const crossReferences = async () => {
    const found: string[] = [];
    for (const { label, sql } of crossChecks) {
      const [row] = await dataSource.query(sql, [a.workspaceId, b.workspaceId]);
      if (row.n > 0) found.push(`${label}: ${row.n}`);
    }
    return found;
  };

  /** md5 of all of B's rows, table by table. */
  const fingerprint = async () => {
    const parts: string[] = [];
    for (const { table, where } of bTables) {
      const [row] = await dataSource.query(
        `SELECT md5(coalesce(string_agg(t::text, '' ORDER BY t::text), '')) AS h FROM "${table}" t WHERE ${where}`,
        [b.workspaceId],
      );
      parts.push(`${table} (${where}): ${row.h}`);
    }
    return parts;
  };

  /** B's ids in the table a name points at ("tagIds", "categoryId", "rows"), else all of them. */
  const idsNamedBy = (name: string, ids = bIds): string[] => {
    const all = [...ids.keys()];
    const hint = TABLE_ALIASES[name] ?? toSnake(name.replace(/Ids?$/, ''));
    const matching = hint
      ? all.filter(id => {
          const table = ids.get(id) ?? '';
          const plural = hint.replace(/y$/, 'ie');
          return (
            table === hint ||
            table === `${plural}s` ||
            table.endsWith(`_${hint}`) ||
            table.endsWith(`_${plural}s`)
          );
        })
      : [];
    return matching.length > 0 ? matching : all;
  };

  const urlsFor = (route: Route, ids = bIds): string[] => {
    const segments = route.path.split('/').filter(Boolean);
    const params = [...route.path.matchAll(/:(\w+)/g)].map(match => match[1]);
    if (params.length === 0) return [route.path];
    let combos: string[][] = [[]];
    for (const param of params) {
      const at = segments.indexOf(`:${param}`);
      const named = idsNamedBy(param === 'id' && at > 0 ? segments[at - 1] : param, ids);
      combos = combos.flatMap(combo => named.map(id => [...combo, id])).slice(0, MAX_COMBINATIONS);
    }
    return combos.map(combo => {
      let index = 0;
      return route.path.replace(/:\w+/g, () => combo[index++]);
    });
  };

  /**
   * A valid body from the route's contract, with every id in it pointing at B.
   * The first attempt is the raw sample, which finds the inputs that crash a
   * handler. The later ones are tamed so they reach the code past validation:
   * every id field the contract has is filled with B's, and amounts are small.
   */
  const bodyFor = async (route: Route, attempt: number): Promise<unknown> => {
    if (!route.body) return {};
    const seed = seedOf(`${route.method} ${route.path}`) + attempt;
    try {
      const [sample] = await Effect.runPromise(
        Arbitrary.sampleEffect(Arbitrary.schema(route.body), { count: 1, seed }),
      );
      const encoded = Schema.encodeUnknownSync(route.body as Schema.Codec<unknown, unknown>)(
        sample,
      );
      let next = Math.abs(seed);
      const aimAtB = (value: unknown, key: string): unknown => {
        if (typeof value === 'string' && (UUID.test(value) || ID_KEY.test(key))) {
          const ids = idsNamedBy(key);
          return ids[next++ % ids.length];
        }
        if (Array.isArray(value)) {
          return value.length === 0 && /Ids$/.test(key)
            ? idsNamedBy(key).slice(0, 3)
            : value.map(item => aimAtB(item, key));
        }
        if (typeof value === 'object' && value !== null) {
          return Object.fromEntries(
            Object.entries(value).map(([field, item]) => [field, aimAtB(item, field)]),
          );
        }
        return value;
      };
      const aimed = aimAtB(encoded, '');
      if (attempt === 0 || typeof aimed !== 'object' || aimed === null) return aimed;
      const ast = SchemaAST.toEncoded(route.body.ast);
      const idFields = SchemaAST.isObjects(ast)
        ? ast.propertySignatures.map(field => String(field.name)).filter(name => ID_KEY.test(name))
        : [];
      const tame = (value: unknown): unknown =>
        typeof value === 'number' && Math.abs(value) > 1e6
          ? Math.sign(value) * 100
          : Array.isArray(value)
            ? value.map(tame)
            : typeof value === 'object' && value !== null
              ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, tame(item)]))
              : value;
      const body = tame(aimed) as Record<string, unknown>;
      for (const field of idFields) {
        if (
          body[field] === undefined ||
          body[field] === null ||
          (Array.isArray(body[field]) && body[field].length === 0)
        ) {
          const ids = idsNamedBy(field);
          body[field] = /Ids$/.test(field) ? ids.slice(0, 3) : ids[(next += 1) % ids.length];
        }
      }
      return body;
    } catch {
      // A schema the generator cannot derive: an empty body still reaches the guards.
      return {};
    }
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    a = await registerAccount(app, emails[0], 'Sweep A');
    b = await registerAccount(app, emails[1], 'Sweep B');
    await seedWorkspace(app, dataSource, a, markers[0]);
    await seedWorkspace(app, dataSource, b, markers[1]);

    // B's rows: every table with a workspace column, and the tables that hang
    // off those by a foreign key (rows, columns, lines, items, join tables).
    const columnsNamed = async (column: string) =>
      new Set(
        (
          (await dataSource.query(
            `SELECT table_name FROM information_schema.columns
              WHERE column_name = $1 AND table_schema = current_schema()`,
            [column],
          )) as Array<{ table_name: string }>
        ).map(row => row.table_name),
      );
    const owned = await columnsNamed('workspace_id');
    const withId = await columnsNamed('id');
    for (const table of owned) {
      bTables.push({ table, where: 'workspace_id = $1', hasId: withId.has(table) });
    }
    const foreignKeys: Array<{ child: string; column: string; parent: string }> =
      await dataSource.query(
        `SELECT src.relname AS child, att.attname AS column, tgt.relname AS parent
           FROM pg_constraint fk
           JOIN pg_class src ON src.oid = fk.conrelid
           JOIN pg_class tgt ON tgt.oid = fk.confrelid
           JOIN pg_attribute att ON att.attrelid = fk.conrelid AND att.attnum = fk.conkey[1]
           JOIN pg_namespace ns ON ns.oid = src.relnamespace
          WHERE fk.contype = 'f' AND ns.nspname = current_schema() AND array_length(fk.conkey, 1) = 1`,
      );
    for (const { child, column, parent } of foreignKeys) {
      if (owned.has(child) || !owned.has(parent) || !withId.has(parent)) continue;
      bTables.push({
        table: child,
        where: `"${column}" IN (SELECT id FROM "${parent}" WHERE workspace_id = $1)`,
        hasId: withId.has(child),
      });
    }
    for (const [owner, ids] of [
      [b, bIds],
      [a, aIds],
    ] as const) {
      for (const { table, where } of bTables.filter(entry => entry.hasId)) {
        const rows: Array<{ id: string }> = await dataSource.query(
          `SELECT id::text FROM "${table}" t WHERE ${where}`,
          [owner.workspaceId],
        );
        for (const row of rows) ids.set(row.id, table);
      }
      ids.set(owner.workspaceId, 'workspaces');
    }
    // A's workspace and account stay out of A's own targets: deleting them
    // would take every row the sweep checks with them.
    for (const [id, table] of aIds) {
      if (table === 'workspaces' || table === 'users') aIds.delete(id);
    }

    // A reference from A's data to B's. users.workspace_id is a home workspace,
    // not an owner: a member's user row lives in another workspace by design.
    const toWorkspaceData = foreignKeys.filter(
      fk => owned.has(fk.parent) && withId.has(fk.parent) && fk.parent !== 'users',
    );
    for (const { child, column, parent } of toWorkspaceData) {
      if (!owned.has(child)) continue;
      crossChecks.push({
        label: `${child}.${column} -> ${parent}`,
        sql: `SELECT count(*)::int AS n FROM "${child}" c JOIN "${parent}" p ON p.id = c."${column}"
               WHERE c.workspace_id = $1 AND p.workspace_id = $2`,
      });
    }
    // Join tables (a file's tags): both ends must be in one workspace.
    for (const first of toWorkspaceData.filter(fk => !owned.has(fk.child))) {
      for (const second of toWorkspaceData) {
        if (second.child !== first.child || second.column === first.column) continue;
        crossChecks.push({
          label: `${first.child}.${first.column} / ${second.column} -> ${second.parent}`,
          sql: `SELECT count(*)::int AS n FROM "${first.child}" c
                  JOIN "${first.parent}" mine ON mine.id = c."${first.column}"
                  JOIN "${second.parent}" theirs ON theirs.id = c."${second.column}"
                 WHERE mine.workspace_id = $1 AND theirs.workspace_id = $2`,
        });
      }
    }

    routes = discoverRoutes(app);
  }, 180_000);

  afterAll(async () => {
    if (dataSource) {
      for (const email of emails) await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('starts with A’s data and B’s apart', async () => {
    expect(crossChecks.length).toBeGreaterThanOrEqual(50);
    expect(await crossReferences()).toEqual([]);
  });

  it('seeds B with most kinds of record and finds the routes to aim at it', () => {
    // A kind of record that stops being seeded is a table the sweep no longer covers.
    expect(new Set(bIds.values()).size).toBeGreaterThanOrEqual(70);
    expect(routes.filter(route => route.method === 'get').length).toBeGreaterThanOrEqual(220);
    expect(routes.filter(route => route.body).length).toBeGreaterThanOrEqual(200);
  });

  it('finds B’s data when B reads its own lists (the scan can see a leak)', async () => {
    let lists = 0;
    for (const route of routes.filter(r => r.method === 'get' && !r.path.includes(':'))) {
      const res = await as(b, 'get', route.path).catch(() => null);
      if (res && leakedBy(res, '', true).length > 0) lists += 1;
    }
    expect(lists).toBeGreaterThanOrEqual(30);
  }, 300_000);

  it('never answers A with B’s data, from A’s workspace or by naming B’s', async () => {
    const leaks: string[] = [];
    const failures: string[] = [];
    for (const route of routes.filter(r => r.method === 'get')) {
      const targets = [
        ...urlsFor(route).map(url => ({ url, workspaceId: a.workspaceId })),
        // A names B's workspace in the header: membership is checked, not trusted.
        ...(route.path.includes(':') ? [] : [{ url: route.path, workspaceId: b.workspaceId }]),
      ];
      for (const { url, workspaceId } of targets) {
        const res = await as(a, 'get', url, workspaceId).catch(() => null);
        if (!res) continue;
        if (res.status === 500) failures.push(`${res.status} GET ${route.path} (${route.handler})`);
        const found = leakedBy(res, url, true);
        if (found.length > 0) leaks.push(`GET ${url} -> ${found.join(', ')}`);
      }
    }
    expect({ leaks, failures: [...new Set(failures)] }).toEqual({ leaks: [], failures: [] });
  }, 900_000);

  it('never lets A change or read B’s rows by writing, by path, body or header', async () => {
    const before = await fingerprint();
    const leaks: string[] = [];
    const failures: string[] = [];
    // Deletes last, so A's own records are still there for the other writes.
    const writes = routes
      .filter(r => r.method !== 'get')
      .sort((x, y) => Number(x.method === 'delete') - Number(y.method === 'delete'));
    let pointingAtB: string[] = [];
    for (const route of writes) {
      // Before the deletes, which may remove the row that points at B's.
      if (route.method === 'delete' && pointingAtB.length === 0) {
        pointingAtB = await crossReferences();
      }
      const urls = urlsFor(route);
      const aUrls = urlsFor(route, aIds);
      const attempts = route.path.includes(':')
        ? [
            ...urls.map((url, attempt) => ({ url, attempt, workspaceId: a.workspaceId })),
            // A's own record, B's ids in the body: tags, categories, rates by reference.
            ...Array.from({ length: BODIES_PER_ROUTE }, (_, attempt) => ({
              url: aUrls[attempt % aUrls.length],
              attempt,
              workspaceId: a.workspaceId,
            })),
          ]
        : [
            ...Array.from({ length: BODIES_PER_ROUTE }, (_, attempt) => ({
              url: urls[0],
              attempt,
              workspaceId: a.workspaceId,
            })),
            { url: urls[0], attempt: 0, workspaceId: b.workspaceId },
          ];
      for (const { url, attempt, workspaceId } of attempts) {
        const body = await bodyFor(route, attempt);
        for (const id of foundIds(`${url} ${JSON.stringify(body)}`)) sentIds.add(id);
        const res = await as(a, route.method, url, workspaceId)
          .send(body as object)
          .catch(() => null);
        if (!res) continue;
        const label = `${route.method.toUpperCase()} ${route.path} (${route.handler})`;
        if (res.status === 500) failures.push(`${res.status} ${label}`);
        const found = leakedBy(res, url, false);
        if (found.length > 0)
          leaks.push(
            `${label} -> ${found.join(', ')} SENT ${JSON.stringify(body).slice(0, 600)} GOT ${(res.text ?? '').slice(0, 1500)}`,
          );
      }
    }
    // A write may have pointed A's own record at B's (a budget on B's
    // category): A's lists must not show what it points at.
    for (const route of routes.filter(r => r.method === 'get' && !r.path.includes(':'))) {
      const res = await as(a, 'get', route.path).catch(() => null);
      if (!res) continue;
      if (res.status === 500) failures.push(`${res.status} GET ${route.path} (${route.handler})`);
      const found = leakedBy(res, '', false);
      if (found.length > 0)
        leaks.push(
          `GET ${route.path} after the writes -> ${found.join(', ')} GOT ${(res.text ?? '').slice(0, 1500)}`,
        );
    }
    const after = await fingerprint();
    expect({
      changed: after.filter((part, index) => part !== before[index]),
      pointingAtB: [...new Set([...pointingAtB, ...(await crossReferences())])],
      leaks: [...new Set(leaks)],
      failures: [...new Set(failures)],
      // A write that ended A's session would have turned the rest into 401s.
      stillSignedIn: (await as(a, 'get', '/categories')).status,
    }).toEqual({ changed: [], pointingAtB: [], leaks: [], failures: [], stillSignedIn: 200 });
  }, 1_500_000);
});
