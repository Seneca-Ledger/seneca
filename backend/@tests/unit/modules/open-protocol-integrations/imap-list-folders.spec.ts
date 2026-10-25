import type { Mock } from 'vitest';
vi.mock('imapflow', () => ({ ImapFlow: vi.fn() }));
vi.mock('webdav', () => ({ createClient: vi.fn() }));
vi.mock('../../../../src/common/utils/egress-url.util', () => ({
  assertPublicEgressHost: vi.fn(),
  assertPublicEgressUrl: vi.fn(),
  createPublicEgressHttpAgents: vi.fn(() => ({
    lookup: vi.fn(),
    httpAgent: {},
    httpsAgent: {},
  })),
}));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
  HeadBucketCommand: vi.fn(),
}));

import { ImapFlow } from 'imapflow';
import { OpenProtocolIntegrationsService } from '../../../../src/modules/open-protocol-integrations/open-protocol-integrations.service';

const makeMailboxList = () => [
  { path: 'INBOX', name: 'INBOX' },
  { path: 'Folders/Чеки', name: 'Чеки' },
  { path: 'Folders/Finance-Billing', name: 'Finance-Billing' },
  { path: 'Sent', name: 'Sent' },
];

const connectMock = vi.fn();
const listMock = vi.fn();
const logoutMock = vi.fn();

(ImapFlow as Mock).mockImplementation(function () {
    return {
  connect: connectMock,
  list: listMock,
  logout: logoutMock,
};
  });

const createService = () =>
  new OpenProtocolIntegrationsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

describe('OpenProtocolIntegrationsService.listImapFolders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectMock.mockResolvedValue(undefined);
    listMock.mockResolvedValue(makeMailboxList());
    logoutMock.mockResolvedValue(undefined);
  });

  it('returns folder paths from the IMAP server', async () => {
    const result = await createService().listImapFolders({
      host: '127.0.0.1',
      port: 1143,
      secure: false,
      user: 'user@example.com',
      pass: 'secret',
    });

    expect(result).toEqual(['INBOX', 'Folders/Чеки', 'Folders/Finance-Billing', 'Sent']);
  });

  it('always disconnects even when list throws', async () => {
    listMock.mockRejectedValueOnce(new Error('network error'));

    await expect(
      createService().listImapFolders({
        host: '127.0.0.1',
        port: 1143,
        secure: false,
        user: 'user@example.com',
        pass: 'bad-pass',
      }),
    ).rejects.toThrow('network error');

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
