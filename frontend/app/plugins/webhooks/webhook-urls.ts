/** Where other tools send files for an inbound endpoint; the API base may be relative behind a proxy. */
export function inboundWebhookUrls(
  apiBase: string,
  origin: string,
  token: string,
): { statements: string; receipts: string } {
  const base = `${new URL(apiBase, origin).href.replace(/\/+$/, '')}/webhooks/${token}`;
  return { statements: `${base}/statements`, receipts: `${base}/receipts` };
}
