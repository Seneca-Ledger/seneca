import type { Mock } from 'vitest';
vi.mock('imapflow', () => ({ ImapFlow: vi.fn() }));
vi.mock('webdav', () => ({ createClient: vi.fn() }));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn(),
  HeadBucketCommand: vi.fn(),
}));
vi.mock('mailparser', () => ({
  simpleParser: vi.fn().mockResolvedValue({
    messageId: '<receipt-001@captions.ai>',
    subject: 'Your receipt from Captions #2786-5570',
    from: { text: 'billing@captions.ai' },
    date: new Date('2026-05-21T10:00:00Z'),
    html: '<p>Amount due: $11.99</p>',
    text: 'Amount due: $11.99',
    attachments: [],
  }),
}));

import { ImapFlow } from 'imapflow';
import { OpenProtocolIntegrationsService } from '../../../../src/modules/open-protocol-integrations/open-protocol-integrations.service';

const connectMock = vi.fn().mockResolvedValue(undefined);
const mailboxOpenMock = vi.fn().mockResolvedValue(undefined);
const searchMock = vi.fn().mockResolvedValue([3]);
const fetchOneMock = vi.fn().mockResolvedValue({
  uid: 3,
  flags: new Set(['\\Seen']),
  source: Buffer.from('From: billing@captions.ai\r\nSubject: Your receipt\r\n\r\nAmount due: $11.99'),
});
const messageFlagsAddMock = vi.fn().mockResolvedValue(undefined);
const logoutMock = vi.fn().mockResolvedValue(undefined);

(ImapFlow as Mock).mockImplementation(function () {
    return {
  connect: connectMock,
  mailboxOpen: mailboxOpenMock,
  search: searchMock,
  fetchOne: fetchOneMock,
  messageFlagsAdd: messageFlagsAddMock,
  logout: logoutMock,
};
  });

const savedReceipt = { id: 'receipt-001', status: 'needs_review' };

const receiptRepository = {
  findOne: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockImplementation((data: unknown) => data),
  save: vi.fn().mockResolvedValue(savedReceipt),
};

const integrationRepository = {
  findOne: vi.fn().mockResolvedValue(null),
};

const receiptParserService = {
  parseFromEmailOnly: vi.fn().mockResolvedValue({ amount: 11.99, currency: 'USD' }),
};

const receiptDuplicateService = {
  findPotentialDuplicates: vi.fn().mockResolvedValue([]),
};

const receiptCategoryService = {
  categorize: vi.fn().mockResolvedValue(null),
};

const auditService = {
  createEvent: vi.fn().mockResolvedValue(undefined),
};

const fileStorageService = {
  saveFile: vi.fn().mockResolvedValue('/tmp/receipt.html'),
};

const createService = () =>
  new OpenProtocolIntegrationsService(
    integrationRepository as never,
    {} as never,
    {} as never,
    receiptRepository as never,
    {} as never,
    fileStorageService as never,
    receiptParserService as never,
    receiptDuplicateService as never,
    receiptCategoryService as never,
    auditService as never,
  );

describe('OpenProtocolIntegrationsService.syncImap — already-seen messages', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      IMAP_HOST: '127.0.0.1',
      IMAP_USER: 'test@example.com',
      IMAP_PASS: 'secret',
      IMAP_PORT: '1143',
      IMAP_SECURE: 'false',
      IMAP_MAILBOX: 'Folders/Receipts',
    };
    connectMock.mockResolvedValue(undefined);
    mailboxOpenMock.mockResolvedValue(undefined);
    searchMock.mockResolvedValue([3]);
    fetchOneMock.mockResolvedValue({
      uid: 3,
      flags: new Set(['\\Seen']),
      source: Buffer.from(
        'From: billing@captions.ai\r\nSubject: Your receipt\r\n\r\nAmount due: $11.99',
      ),
    });
    messageFlagsAddMock.mockResolvedValue(undefined);
    logoutMock.mockResolvedValue(undefined);
    receiptRepository.findOne.mockResolvedValue(null);
    receiptRepository.save.mockResolvedValue(savedReceipt);
    receiptParserService.parseFromEmailOnly.mockResolvedValue({ amount: 11.99, currency: 'USD' });
    receiptDuplicateService.findPotentialDuplicates.mockResolvedValue([]);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('imports a message even when it was already marked \\Seen in the mailbox', async () => {
    const user = { id: 'user-1', workspaceId: 'workspace-1' } as never;

    const result = await createService().syncImap(user, 'workspace-1');

    expect(result.scanned).toBe(1);
    expect(result.imported).toBe(1);
    expect(receiptRepository.save).toHaveBeenCalled();
  });

  it('does not search with seen:false filter so already-read emails are included', async () => {
    const user = { id: 'user-1', workspaceId: 'workspace-1' } as never;

    await createService().syncImap(user, 'workspace-1');

    const [searchQuery] = searchMock.mock.calls[0] as [Record<string, unknown>];
    expect(searchQuery).not.toHaveProperty('seen');
  });

  it('imports into the workspace it syncs for, deduplicating within it', async () => {
    const user = { id: 'user-1', workspaceId: 'ws-home' } as never;

    await createService().syncImap(user, 'ws-open');

    expect(receiptRepository.findOne).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-open', messageId: expect.stringMatching(/^imap:/) },
    });
    expect(receiptRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', workspaceId: 'ws-open' }),
    );
  });
});
