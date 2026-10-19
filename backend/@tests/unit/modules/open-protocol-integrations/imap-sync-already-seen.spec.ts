jest.mock('imapflow', () => ({ ImapFlow: jest.fn() }));
jest.mock('webdav', () => ({ createClient: jest.fn() }));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
  HeadBucketCommand: jest.fn(),
}));
jest.mock('mailparser', () => ({
  simpleParser: jest.fn().mockResolvedValue({
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

const connectMock = jest.fn().mockResolvedValue(undefined);
const mailboxOpenMock = jest.fn().mockResolvedValue(undefined);
const searchMock = jest.fn().mockResolvedValue([3]);
const fetchOneMock = jest.fn().mockResolvedValue({
  uid: 3,
  flags: new Set(['\\Seen']),
  source: Buffer.from('From: billing@captions.ai\r\nSubject: Your receipt\r\n\r\nAmount due: $11.99'),
});
const messageFlagsAddMock = jest.fn().mockResolvedValue(undefined);
const logoutMock = jest.fn().mockResolvedValue(undefined);

(ImapFlow as jest.Mock).mockImplementation(() => ({
  connect: connectMock,
  mailboxOpen: mailboxOpenMock,
  search: searchMock,
  fetchOne: fetchOneMock,
  messageFlagsAdd: messageFlagsAddMock,
  logout: logoutMock,
}));

const savedReceipt = { id: 'receipt-001', status: 'needs_review' };

const receiptRepository = {
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((data: unknown) => data),
  save: jest.fn().mockResolvedValue(savedReceipt),
};

const integrationRepository = {
  findOne: jest.fn().mockResolvedValue(null),
};

const receiptParserService = {
  parseFromEmailOnly: jest.fn().mockResolvedValue({ amount: 11.99, currency: 'USD' }),
};

const receiptDuplicateService = {
  findPotentialDuplicates: jest.fn().mockResolvedValue([]),
};

const receiptCategoryService = {
  categorize: jest.fn().mockResolvedValue(null),
};

const auditService = {
  createEvent: jest.fn().mockResolvedValue(undefined),
};

const fileStorageService = {
  saveFile: jest.fn().mockResolvedValue('/tmp/receipt.html'),
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
    jest.clearAllMocks();
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
      where: { workspaceId: 'ws-open', gmailMessageId: expect.stringMatching(/^imap:/) },
    });
    expect(receiptRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', workspaceId: 'ws-open' }),
    );
  });
});
