import type { Mock } from 'vitest';
import * as nodemailerMock from 'nodemailer';
vi.mock('nodemailer', () => {
  const sendMail = vi.fn(async () => ({ messageId: 'test' }));
  const mock = { createTransport: vi.fn(() => ({ sendMail })), sendMail };
  // The service imports nodemailer's default export.
  return { ...mock, default: mock };
});
vi.mock('../../../../src/common/utils/egress-url.util', () => ({
  pinPublicEgressHost: vi.fn(async (host: string) => ({
    host: '198.51.100.7',
    servername: host,
  })),
}));

import type {
  SmtpRuntimeSettings,
} from '@/modules/application-settings/application-settings.service';
import { MailerService } from '@/modules/mailer/mailer.service';

// vi.mock above replaces the module, so this import is the mock.
const { createTransport, sendMail } = nodemailerMock as unknown as {
  createTransport: Mock;
  sendMail: Mock;
};

const smtp = (over: Partial<SmtpRuntimeSettings>): SmtpRuntimeSettings => ({
  host: 'smtp.b.example',
  port: 587,
  secure: false,
  user: null,
  pass: null,
  from: 'b@b.example',
  replyTo: null,
  timeoutMs: 1000,
  source: 'workspace',
  ...over,
});

describe('MailerService', () => {
  const originalEnv = process.env;
  const settings = {
    getSmtpSettings: vi.fn(async () => smtp({})),
    getAccountSmtpSettings: vi.fn(async () => smtp({ host: 'smtp.home.example' })),
  };
  const mailer = new MailerService(settings as never);
  const content = { to: 'client@example.com', subject: 'Hi', text: 'Body' };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SMTP_HOST;
    vi.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sends through the server of the workspace the mail is about', async () => {
    await expect(mailer.send({ ...content, workspaceId: 'ws-b' })).resolves.toBe(true);

    expect(settings.getSmtpSettings).toHaveBeenCalledWith('ws-b');
    expect(settings.getAccountSmtpSettings).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'b@b.example' }));
  });

  it('sends account mail through the server chosen for the account', async () => {
    const accountOf = { id: 'u1', workspaceId: 'ws-a' };

    await mailer.send({ ...content, accountOf });

    expect(settings.getAccountSmtpSettings).toHaveBeenCalledWith(accountOf);
    expect(settings.getSmtpSettings).not.toHaveBeenCalled();
  });

  // The host was checked when saved; connecting to the checked address keeps a
  // resolver from switching it to a private one afterwards (DNS rebinding).
  it("connects to a workspace server's checked address, keeping its name for TLS", async () => {
    await mailer.send({ ...content, workspaceId: 'ws-b' });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: '198.51.100.7', servername: 'smtp.b.example' }),
    );
  });

  it("leaves the operator's SMTP_* relay alone, which may well be private", async () => {
    process.env.SMTP_HOST = 'mailpit';
    settings.getSmtpSettings.mockResolvedValueOnce(smtp({ host: 'mailpit', source: 'env' }));

    await mailer.send({ ...content, workspaceId: 'ws-b' });

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'mailpit' }));
  });
});
