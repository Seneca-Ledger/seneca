jest.mock('franc', () => ({
  franc: () => 'und',
}));

import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { User, UserRole } from '../../src/entities/user.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * The MCP endpoint: API keys only, only while the workspace has MCP on, tools
 * limited by the key's scopes, answers as safe as the REST ones, and nothing
 * outside the key's workspace.
 */
describe('MCP endpoint (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `mcp-owner-${stamp}@example.com`,
    other: `mcp-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let readKey: string;
  let categoriesOnlyKey: string;
  let otherTransactionId: string;

  const server = () => app.getHttpServer();
  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const today = () => new Date().toISOString().slice(0, 10);
  const rpc = (key: string, method: string, params?: Record<string, unknown>) =>
    request(server())
      .post('/mcp')
      .set('x-api-key', key)
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) });
  const callTool = async (key: string, name: string, args: Record<string, unknown> = {}) => {
    const res = await rpc(key, 'tools/call', { name, arguments: args }).expect(200);
    const result = res.body.result;
    return { isError: result.isError === true, text: result.content[0].text as string };
  };
  const spend = async (account: E2eAccount, merchant: string) => {
    const categories = await as(account, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    await as(account, request(server()).post('/statements/manual-expense'))
      .field('amount', '12.5')
      .field('currency', 'EUR')
      .field('merchant', merchant)
      .field('categoryId', categories.body[0].id)
      .field('date', today())
      .expect(201);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'MCP Owner');
    other = await registerAccount(app, emails.other, 'MCP Other');
    // api_key.manage belongs to the admin role.
    await dataSource.getRepository(User).update({ email: emails.owner }, { role: UserRole.ADMIN });

    await spend(owner, 'Owner coffee');
    await spend(other, 'Other coffee');
    const otherRows = await as(other, request(server()).get('/transactions')).expect(200);
    otherTransactionId = otherRows.body.data[0].id;

    const scopes = await as(owner, request(server()).get('/api-keys/scopes')).expect(200);
    readKey = (
      await as(owner, request(server()).post('/api-keys'))
        .send({ name: 'MCP reader', scopes: scopes.body.presets.read })
        .expect(201)
    ).body.key;
    categoriesOnlyKey = (
      await as(owner, request(server()).post('/api-keys'))
        .send({ name: 'MCP categories', scopes: ['category.view'] })
        .expect(201)
    ).body.key;

    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ plugins: { mcp: true } })
      .expect(200);
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('answers initialize as the Lumio server with tools', async () => {
    const res = await rpc(readKey, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'e2e', version: '0' },
    }).expect(200);

    expect(res.body.result.serverInfo.name).toBe('lumio');
    expect(res.body.result.capabilities.tools).toBeDefined();
  });

  it('lists only the tools the key may call', async () => {
    const all = await rpc(readKey, 'tools/list').expect(200);
    const narrow = await rpc(categoriesOnlyKey, 'tools/list').expect(200);
    const names = (res: request.Response) =>
      res.body.result.tools.map((tool: { name: string }) => tool.name).sort();

    expect(names(all)).toEqual(
      expect.arrayContaining(['get_dashboard', 'list_categories', 'list_transactions']),
    );
    expect(names(narrow)).toEqual(['list_categories']);
    const listTransactions = all.body.result.tools.find(
      (tool: { name: string }) => tool.name === 'list_transactions',
    );
    expect(listTransactions.inputSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
    });
    expect(listTransactions.annotations.readOnlyHint).toBe(true);
  });

  it('reads the key workspace through a tool', async () => {
    const { isError, text } = await callTool(readKey, 'list_transactions', { limit: 5 });

    expect(isError).toBe(false);
    const page = JSON.parse(text);
    expect(page.total).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(page)).toContain('Owner coffee');
    expect(JSON.stringify(page)).not.toContain('Other coffee');
    expect(page.items).toBeUndefined();
  });

  it('never reaches another workspace', async () => {
    const { isError, text } = await callTool(readKey, 'get_transaction', {
      id: otherTransactionId,
    });

    expect(isError).toBe(true);
    expect(JSON.parse(text).status).toBe(404);
  });

  it('keeps file paths, hashes and account rows out of the answer', async () => {
    const page = JSON.parse((await callTool(readKey, 'list_transactions')).text);
    const one = await callTool(readKey, 'get_transaction', { id: page.data[0].id });

    expect(one.isError).toBe(false);
    for (const key of ['filePath', 'fileHash', 'fileData', 'passwordHash', 'googleId', 'tokenVersion']) {
      expect(one.text).not.toContain(`"${key}"`);
    }
  });

  it('refuses a tool outside the key scopes, as REST does', async () => {
    const { isError, text } = await callTool(categoriesOnlyKey, 'list_transactions');

    expect(isError).toBe(true);
    expect(JSON.parse(text)).toMatchObject({ status: 403 });
    expect(text).toMatch(/API key scope missing: transaction\.view/);
  });

  it('refuses arguments the tool does not take', async () => {
    const tooMany = await callTool(readKey, 'list_transactions', { limit: 500 });
    const unknown = await callTool(readKey, 'list_transactions', { search: 'coffee' });

    expect(tooMany.isError).toBe(true);
    expect(JSON.parse(tooMany.text).status).toBe(400);
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toMatch(/search/);
  });

  it('works with the official MCP client over Streamable HTTP', async () => {
    const http = app.getHttpServer();
    if (!http.listening) {
      await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
    }
    const { port } = http.address() as AddressInfo;
    const client = new Client({ name: 'e2e-client', version: '0' });
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
      requestInit: { headers: { 'x-api-key': readKey } },
    });

    await client.connect(transport);
    const { tools } = await client.listTools();
    const result = await client.callTool({ name: 'get_dashboard', arguments: { range: '30d' } });
    await client.close();

    expect(tools.map(tool => tool.name)).toContain('get_dashboard');
    expect(result.isError).toBeFalsy();
    const dashboard = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(dashboard.snapshot.currency).toBeTruthy();
  });

  it('answers an unknown tool with a protocol error', async () => {
    const res = await rpc(readKey, 'tools/call', { name: 'drop_everything', arguments: {} }).expect(
      200,
    );

    expect(res.body.error.message).toMatch(/Unknown tool/);
  });

  it('takes API keys only', async () => {
    const res = await as(owner, request(server()).post('/mcp'))
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
      .expect(401);

    expect(res.headers['www-authenticate']).toMatch(/X-Api-Key/);
  });

  it('has no session stream to open', async () => {
    await request(server()).get('/mcp').set('x-api-key', readKey).expect(405);
  });

  it('is closed while the workspace has MCP off, and REST keeps working for the key', async () => {
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ plugins: { mcp: false } })
      .expect(200);

    const refused = await rpc(readKey, 'tools/list').expect(403);
    expect(JSON.stringify(refused.body)).toContain('PLUGIN_DISABLED');
    await request(server()).get('/transactions').set('x-api-key', readKey).expect(200);

    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ plugins: { mcp: true } })
      .expect(200);
    await rpc(readKey, 'tools/list').expect(200);
  });
});
