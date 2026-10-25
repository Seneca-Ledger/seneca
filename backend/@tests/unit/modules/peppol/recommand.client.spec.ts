import type { MockInstance } from 'vitest';
import { HttpException } from '@nestjs/common';
import { EffectRuntime } from '@/common/effect/effect-runtime';
import { RECOMMAND_API_URL, RecommandClient } from '@/modules/peppol/recommand.client';

const credentials = { apiKeyId: 'key_x', apiSecret: 'secret_x' };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('RecommandClient', () => {
  const runtime = new EffectRuntime();
  const client = new RecommandClient(runtime);
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => fetchMock.mockRestore());
  afterAll(() => runtime.onModuleDestroy());

  const codeOf = async (promise: Promise<unknown>) => {
    const error = await promise.then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(HttpException);
    const http = error as HttpException;
    return { status: http.getStatus(), body: http.getResponse() as { code: string; message: string } };
  };

  it('authenticates with HTTP Basic: key id as user, secret as password', async () => {
    fetchMock.mockImplementation(async () => json({ success: true, companies: [] }));
    await client.companies(credentials);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${RECOMMAND_API_URL}/api/v1/companies`);
    expect(new Headers(init?.headers).get('authorization')).toBe(
      `Basic ${Buffer.from('key_x:secret_x').toString('base64')}`,
    );
  });

  it('turns 401 into PEPPOL_AUTH_FAILED', async () => {
    fetchMock.mockImplementation(async () => json({ success: false }, 401));
    const { status, body } = await codeOf(client.verifyAuth(credentials));
    expect(status).toBe(400);
    expect(body.code).toBe('PEPPOL_AUTH_FAILED');
  });

  it('retries a read on 503, but never a send', async () => {
    fetchMock.mockImplementation(async () => json({ success: false }, 503));
    await codeOf(client.companies(credentials));
    const reads = fetchMock.mock.calls.length;
    expect(reads).toBe(3);

    fetchMock.mockClear();
    const { status, body } = await codeOf(
      client.sendXml(credentials, 'c_1', { recipient: '0208:0428643097', doctypeId: 'x', xml: '<x/>' }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(status).toBe(502);
    expect(body.code).toBe('PEPPOL_UNAVAILABLE');
  });

  it('passes on why a document was refused', async () => {
    fetchMock.mockImplementation(async () =>
      json(
        { success: false, errors: { 'document.buyer': ['document.buyer: Required'] } },
        400,
      ),
    );
    const { status, body } = await codeOf(
      client.sendXml(credentials, 'c_1', { recipient: '0208:0428643097', doctypeId: 'x', xml: '<x/>' }),
    );
    expect(status).toBe(400);
    expect(body.code).toBe('PEPPOL_REJECTED');
    expect(body.message).toContain('document.buyer: Required');
  });

  it('sends the XML as it is, with the document type it is written in', async () => {
    fetchMock.mockImplementation(async () =>
      json({ success: true, id: 'doc_1', deliveryStatus: 'pending', deliveries: [] }),
    );
    const sent = await client.sendXml(credentials, 'c 1', {
      recipient: '0208:0428643097',
      doctypeId: 'urn:doc',
      xml: '<Invoice/>',
    });
    expect(sent.id).toBe('doc_1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${RECOMMAND_API_URL}/api/v1/c%201/send`);
    expect(JSON.parse(String(init?.body))).toEqual({
      recipient: '0208:0428643097',
      documentType: 'xml',
      doctypeId: 'urn:doc',
      document: '<Invoice/>',
    });
  });
});
