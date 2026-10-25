import { RECOMMAND_API_URL } from '../../../src/modules/peppol/recommand.client';

/**
 * A minimal Recommand access point for suites that only need Peppol to answer:
 * one company, a registry of Peppol ids, sends that stay pending, an empty
 * inbox. `peppol.e2e-spec.ts` plays the full API.
 */
export function fakeRecommand(registry: Map<string, string[]>) {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  let sent = 0;

  return async (url: URL, body: Record<string, unknown>): Promise<Response> => {
    if (url.pathname === '/api/core/auth/verify') return json({ success: true });
    if (url.pathname === '/api/v1/companies') {
      return json({
        success: true,
        companies: [
          {
            id: 'c_example',
            name: 'Example Studio GmbH',
            country: 'DE',
            vatNumber: 'DE123456789',
            enterpriseNumber: 'DE123456789',
            enterpriseNumberScheme: '9930',
            isVerified: true,
          },
        ],
      });
    }
    if (url.pathname === '/api/v1/verify') {
      const docTypes = registry.get(String(body.peppolAddress));
      return json(
        docTypes
          ? {
              success: true,
              isValid: true,
              companyName: 'Example Buyer BV',
              supportedDocuments: docTypes.map(docTypeId => ({ docTypeId, name: 'doc' })),
            }
          : { success: true, isValid: false },
      );
    }
    if (/^\/api\/v1\/[^/]+\/send$/.test(url.pathname)) {
      sent += 1;
      return json({
        success: true,
        id: `doc_out_${sent}`,
        deliveryStatus: 'pending',
        deliveries: [{ channel: 'peppol', status: 'pending', failure: null }],
      });
    }
    if (url.pathname === '/api/v1/inbox') return json({ success: true, documents: [] });
    const documentId = /^\/api\/v1\/documents\/([^/]+)$/.exec(url.pathname)?.[1];
    if (documentId) {
      return json({
        success: true,
        document: { id: documentId, type: 'invoice', deliveryStatus: 'pending', deliveries: [] },
      });
    }
    return json({ success: false, errors: { path: ['Not found'] } }, 404);
  };
}

/** Routes the access point's origin to `fake`; everything else goes out as usual. */
export function routeRecommand(
  realFetch: typeof fetch,
  fake: ReturnType<typeof fakeRecommand>,
): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    if (url.origin !== RECOMMAND_API_URL) return realFetch(input, init);
    const raw = input instanceof Request ? await input.text() : init?.body;
    return fake(url, raw ? JSON.parse(String(raw)) : {});
  };
}
