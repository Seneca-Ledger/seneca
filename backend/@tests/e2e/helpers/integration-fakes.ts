import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OpenProtocolIntegrationsService } from '../../../src/modules/open-protocol-integrations/open-protocol-integrations.service';

/**
 * Stand-ins for the services the integrations talk to, so the contracts suite
 * gets real answers with data in them and nothing leaves the process.
 */

const day = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

export const simplefinClaimUrl = 'https://bridge.example.org/simplefin/claim/contracts';
export const simplefinSetupToken = Buffer.from(simplefinClaimUrl).toString('base64');
const simplefinAccessUrl = 'https://member:bridge-pass@bridge.example.org/simplefin';

/** SimpleFIN Bridge: one claim, then one account with two rows. */
export async function simplefinFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (url === simplefinClaimUrl && init.method === 'POST') {
    return new Response(simplefinAccessUrl, { status: 200 });
  }
  const balancesOnly = new URL(url).searchParams.get('balances-only') === '1';
  const transactions = [
    { id: 'TRN-1', posted: day('2026-09-03T10:00:00Z'), amount: '-42.50', description: 'ACME STORE', payee: 'ACME Store' },
    { id: 'TRN-2', posted: day('2026-09-25T10:00:00Z'), amount: '3000.00', description: 'EXAMPLE PAYROLL' },
  ];
  return Response.json({
    errors: [],
    accounts: [
      {
        org: { name: 'Example Bank', domain: 'bank.example.org' },
        id: 'ACT-1',
        name: 'Checking',
        currency: 'USD',
        balance: '2957.50',
        'balance-date': day('2026-09-30T00:00:00Z'),
        transactions: balancesOnly ? [] : transactions,
      },
    ],
  });
}

/** Telegram's Bot API: getMe knows the bot, sendMessage delivers, the rest is `true`. */
export async function telegramFetch(input: unknown): Promise<Response> {
  const url = String(input);
  if (!url.startsWith('https://api.telegram.org/')) {
    throw new Error(`No network in e2e tests: ${url}`);
  }
  const method = url.split('/').pop();
  const result =
    method === 'getMe'
      ? { id: 987654, username: 'contracts_e2e_bot' }
      : method === 'sendMessage'
        ? { message_id: 7 }
        : true;
  return Response.json({ ok: true, result });
}

const statementCsv = Buffer.from('Date,Description,Amount\n2026-10-01,ACME Store - Wireless Buds,-42.50\n');

/** An S3 bucket holding one statement; uploads are accepted and dropped. */
export const fakeS3 = {
  async send(command: { constructor: { name: string } }) {
    switch (command.constructor.name) {
      case 'ListObjectsV2Command':
        return {
          Contents: [
            { Key: 'statements/', Size: 0 },
            { Key: 'statements/acme-october.csv', Size: statementCsv.length, LastModified: new Date('2026-10-02T08:00:00Z') },
          ],
        };
      case 'GetObjectCommand':
        return { ContentType: 'text/csv', Body: { transformToByteArray: async () => new Uint8Array(statementCsv) } };
      default:
        return {};
    }
  },
};

/** A WebDAV folder holding one statement. */
export const fakeWebdav = {
  getDirectoryContents: async () => [
    { filename: '/statements/acme-september.csv', type: 'file', size: statementCsv.length, lastmod: 'Thu, 02 Oct 2026 08:00:00 GMT' },
    { filename: '/statements/archive', type: 'directory', size: 0, lastmod: null },
  ],
  getFileContents: async () => statementCsv,
  putFileContents: async () => true,
  exists: async () => true,
};

/** A P-256 key pair in the form web-push reads from the environment. */
function vapidKeys(): { publicKey: string; privateKey: string } {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const urlBase64 = (buffer: Buffer) =>
    buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwk = pair.publicKey.export({ format: 'jwk' });
  return {
    publicKey: urlBase64(
      Buffer.concat([
        Buffer.from([4]),
        Buffer.from(jwk.x as string, 'base64url'),
        Buffer.from(jwk.y as string, 'base64url'),
      ]),
    ),
    privateKey: urlBase64(
      Buffer.from((pair.privateKey.export({ format: 'jwk' }) as { d: string }).d, 'base64url'),
    ),
  };
}

export const statementCsvFile = statementCsv;

export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Points the app at the fakes before it boots: push keys, a Telegram bot,
 * a local backup root, Telegram on `fetch`, S3 and WebDAV clients. Returns
 * what puts everything back.
 */
export function installIntegrationFakes(): () => void {
  const previousEnv = { ...process.env };
  const originalFetch = global.fetch;
  const vapid = vapidKeys();
  process.env.WEB_PUSH_VAPID_PUBLIC_KEY = vapid.publicKey;
  process.env.WEB_PUSH_VAPID_PRIVATE_KEY = vapid.privateKey;
  process.env.TELEGRAM_BOT_TOKEN = '987654:e2e-token';
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  // A public https address: the bot gets a webhook, so no poller runs in the test.
  process.env.APP_URL = 'https://seneca.example';
  process.env.BACKUP_LOCAL_ROOT ??= mkdtempSync(join(tmpdir(), 'seneca-integ-backups-'));
  global.fetch = telegramFetch as typeof fetch;

  const protocol = OpenProtocolIntegrationsService.prototype as never;
  vi.spyOn(protocol, 'assertS3Connection').mockResolvedValue(undefined as never);
  vi.spyOn(protocol, 'createS3ClientFromConfig').mockReturnValue({ client: fakeS3 } as never);
  vi.spyOn(protocol, 'createWebdavClientFromConfig').mockImplementation((async (config: unknown) => ({
    config,
    client: fakeWebdav,
  })) as never);

  return () => {
    global.fetch = originalFetch;
    process.env = previousEnv;
    vi.restoreAllMocks();
  };
}
