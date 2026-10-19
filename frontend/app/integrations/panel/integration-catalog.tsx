import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AlternateEmailOutlinedIcon from '@mui/icons-material/AlternateEmailOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import CloudQueueOutlinedIcon from '@mui/icons-material/CloudQueueOutlined';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import MarkEmailUnreadOutlinedIcon from '@mui/icons-material/MarkEmailUnreadOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';
import type React from 'react';
import { useMemo } from 'react';
import { useIntlayer } from '@/app/i18n';
import { APP_NAME } from '@/app/lib/brand';
import type { ProtocolIntegrationPageProps } from '../open-protocol-page';

export type IntegrationCategoryKey =
  | 'ai'
  | 'application'
  | 'bank'
  | 'storage'
  | 'email'
  | 'messaging';

type CatalogText = ReturnType<typeof useIntlayer<'integrationCatalog'>>;
type PeppolText = ReturnType<typeof useIntlayer<'peppol'>>;

type ProtocolConfig = Omit<ProtocolIntegrationPageProps, 'embedded' | 'onConnectionStatusChange'>;

/**
 * What the second layer shows for an entry: the shared protocol form, or a
 * panel of its own for the one entry that is not a credentials form.
 */
export type IntegrationDetail =
  | { kind: 'protocol'; config: ProtocolConfig }
  | { kind: 'local-categorization' }
  | { kind: 'bank-sync' };

export type IntegrationEntry = {
  key: string;
  name: string;
  description: string;
  badge: string;
  category: IntegrationCategoryKey;
  recommended: boolean;
  icon: React.ReactNode;
  /** Where the list reads the connected flag from; absent means no connection state. */
  statusPath?: string;
  docsUrl?: string;
  detail: IntegrationDetail;
};

/**
 * The integrations offered in the panel, in list order. Each entry carries the
 * settings its second layer renders, so there is one place to add a service.
 */
function buildIntegrationCatalog(t: CatalogText, peppol: PeppolText): IntegrationEntry[] {
  const f = t.fields;
  const e = t.entries;

  return [
    {
      key: 'local-categorization',
      name: e.localCategorization.name.value,
      description: e.localCategorization.description.value,
      badge: 'Local model',
      category: 'ai',
      recommended: true,
      icon: <CategoryOutlinedIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/settings/local-categorization',
      detail: { kind: 'local-categorization' },
    },
    {
      key: 'smtp',
      name: e.smtp.name.value,
      description: e.smtp.description.value,
      badge: 'Open protocol',
      category: 'email',
      recommended: true,
      icon: <AlternateEmailOutlinedIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/settings/email/smtp',
      docsUrl: 'https://datatracker.ietf.org/doc/html/rfc5321',
      detail: {
        kind: 'protocol',
        config: {
          title: e.smtp.name.value,
          description: e.smtp.detailDescription.value,
          statusPath: '/settings/email/smtp',
          settingsPath: '/settings/email/smtp',
          settingsMethod: 'put',
          disconnectPath: '/settings/email/smtp',
          icon: <AlternateEmailOutlinedIcon sx={{ fontSize: 24 }} aria-hidden="true" />,
          workflow: e.smtp.workflow.value,
          fields: [
            { name: 'host', label: f.host.value, placeholder: 'mail.example.com', required: true },
            {
              name: 'port',
              label: f.port.value,
              type: 'number',
              placeholder: '587',
              required: true,
            },
            { name: 'secure', label: f.useTls.value, type: 'checkbox' },
            { name: 'user', label: f.username.value, placeholder: 'seneca@example.com' },
            { name: 'pass', label: f.password.value, type: 'password' },
            {
              name: 'from',
              label: f.from.value,
              placeholder: `${APP_NAME} <noreply@example.com>`,
              required: true,
            },
            { name: 'replyTo', label: f.replyTo.value, placeholder: 'support@example.com' },
            { name: 'timeoutMs', label: f.timeoutMs.value, type: 'number', placeholder: '10000' },
          ],
        },
      },
    },
    {
      key: 'app-url',
      name: e.appUrl.name.value,
      description: e.appUrl.description.value,
      badge: 'Workspace setting',
      category: 'application',
      recommended: true,
      icon: <LinkOutlinedIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/settings/app',
      detail: {
        kind: 'protocol',
        config: {
          title: e.appUrl.name.value,
          description: e.appUrl.detailDescription.value,
          statusPath: '/settings/app',
          settingsPath: '/settings/app',
          settingsMethod: 'put',
          disconnectPath: '/settings/app',
          icon: <LinkOutlinedIcon sx={{ fontSize: 24 }} aria-hidden="true" />,
          workflow: e.appUrl.workflow.value,
          fields: [
            {
              name: 'publicUrl',
              label: f.publicUrl.value,
              placeholder: 'https://app.example.com',
              required: true,
            },
          ],
        },
      },
    },
    {
      key: 's3-compatible',
      name: e.s3.name.value,
      description: e.s3.description.value,
      badge: 'OSS protocol',
      category: 'storage',
      recommended: true,
      icon: <DnsOutlinedIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/integrations/s3-compatible/status',
      docsUrl: 'https://min.io/docs/minio/linux/developers/javascript/API.html',
      detail: {
        kind: 'protocol',
        config: {
          title: e.s3.name.value,
          description: e.s3.detailDescription.value,
          statusPath: '/integrations/s3-compatible/status',
          settingsPath: '/integrations/s3-compatible/settings',
          disconnectPath: '/integrations/s3-compatible',
          icon: <DnsOutlinedIcon sx={{ fontSize: 24 }} aria-hidden="true" />,
          filesPath: '/integrations/s3-compatible/files',
          importPath: '/integrations/s3-compatible/import',
          syncPath: '/integrations/s3-compatible/sync',
          fields: [
            {
              name: 'endpoint',
              label: f.endpoint.value,
              placeholder: 'http://localhost:9000',
              required: true,
            },
            { name: 'region', label: f.region.value, placeholder: 'us-east-1' },
            { name: 'bucket', label: f.bucket.value, placeholder: 'seneca', required: true },
            { name: 'prefix', label: f.prefix.value, placeholder: 'statements' },
            { name: 'accessKeyId', label: f.accessKeyId.value, type: 'password' },
            { name: 'secretAccessKey', label: f.secretAccessKey.value, type: 'password' },
            { name: 'forcePathStyle', label: f.forcePathStyle.value, type: 'checkbox' },
            { name: 'autoBackup', label: f.autoBackup.value, type: 'checkbox' },
          ],
          workflow: e.s3.workflow.value,
        },
      },
    },
    {
      key: 'webdav',
      name: e.webdav.name.value,
      description: e.webdav.description.value,
      badge: 'Open protocol',
      category: 'storage',
      recommended: true,
      icon: <CloudQueueOutlinedIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/integrations/webdav/status',
      docsUrl: 'https://datatracker.ietf.org/doc/html/rfc4918',
      detail: {
        kind: 'protocol',
        config: {
          title: e.webdav.name.value,
          description: e.webdav.detailDescription.value,
          statusPath: '/integrations/webdav/status',
          settingsPath: '/integrations/webdav/settings',
          disconnectPath: '/integrations/webdav',
          icon: <CloudQueueOutlinedIcon sx={{ fontSize: 24 }} aria-hidden="true" />,
          filesPath: '/integrations/webdav/files',
          importPath: '/integrations/webdav/import',
          syncPath: '/integrations/webdav/sync',
          fields: [
            {
              name: 'url',
              label: 'WebDAV URL',
              placeholder: 'https://cloud.example.com/remote.php/dav/files/user',
              required: true,
            },
            { name: 'rootPath', label: f.rootPath.value, placeholder: '/' },
            { name: 'username', label: f.username.value },
            { name: 'password', label: f.password.value, type: 'password' },
          ],
          workflow: e.webdav.workflow.value,
        },
      },
    },
    {
      key: 'imap',
      name: e.imap.name.value,
      description: e.imap.description.value,
      badge: 'Open protocol',
      category: 'email',
      recommended: true,
      icon: <MarkEmailUnreadOutlinedIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/integrations/imap/status',
      docsUrl: 'https://datatracker.ietf.org/doc/html/rfc9051',
      detail: {
        kind: 'protocol',
        config: {
          title: e.imap.name.value,
          description: e.imap.detailDescription.value,
          statusPath: '/integrations/imap/status',
          settingsPath: '/integrations/imap/settings',
          disconnectPath: '/integrations/imap',
          icon: <MarkEmailUnreadOutlinedIcon sx={{ fontSize: 24 }} aria-hidden="true" />,
          syncPath: '/integrations/imap/sync',
          fields: [
            { name: 'host', label: f.host.value, placeholder: 'imap.example.com', required: true },
            { name: 'port', label: f.port.value, type: 'number', placeholder: '993' },
            {
              name: 'mailbox',
              label: f.mailbox.value,
              placeholder: 'INBOX',
              browseAction: {
                label: f.browseFolders.value,
                endpoint: '/integrations/imap/folders',
                dependsOn: ['host', 'port', 'secure', 'user', 'pass'],
              },
            },
            { name: 'user', label: f.username.value, required: true },
            { name: 'pass', label: f.password.value, type: 'password', required: true },
            { name: 'secure', label: f.useTls.value, type: 'checkbox' },
          ],
          workflow: e.imap.workflow.value,
        },
      },
    },
    {
      key: 'simplefin',
      name: e.simplefin.name.value,
      description: e.simplefin.description.value,
      badge: 'Open protocol',
      category: 'bank',
      recommended: false,
      icon: <AccountBalanceOutlinedIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/integrations/simplefin/status',
      docsUrl: 'https://www.simplefin.org/protocol.html',
      detail: { kind: 'bank-sync' },
    },
    {
      key: 'peppol',
      name: peppol.integrationName.value,
      description: peppol.integrationDescription.value,
      badge: 'Peppol',
      category: 'messaging',
      recommended: false,
      icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/integrations/peppol/status',
      docsUrl: 'https://docs.recommand.eu',
      detail: {
        kind: 'protocol',
        config: {
          title: peppol.integrationName.value,
          description: peppol.integrationDetail.value,
          statusPath: '/integrations/peppol/status',
          settingsPath: '/integrations/peppol/settings',
          disconnectPath: '/integrations/peppol',
          syncPath: '/integrations/peppol/sync',
          icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 24 }} aria-hidden="true" />,
          // The form shows the workflow text, not the description: the sign-up steps go first.
          workflow: `${peppol.integrationDetail.value} ${peppol.integrationWorkflow.value}`,
          fields: [
            {
              name: 'apiKeyId',
              label: peppol.apiKeyId.value,
              placeholder: 'key_…',
              required: true,
            },
            {
              name: 'apiSecret',
              label: peppol.apiSecret.value,
              type: 'password',
              placeholder: peppol.apiSecretPlaceholder.value,
            },
            { name: 'companyId', label: peppol.companyId.value, placeholder: 'c_…' },
            {
              name: 'senderPeppolId',
              label: peppol.senderPeppolId.value,
              placeholder: '9930:DE123456789',
            },
          ],
        },
      },
    },
    {
      key: 'telegram',
      name: 'Telegram',
      description: e.telegram.description.value,
      badge: 'Bot token',
      category: 'messaging',
      recommended: false,
      icon: <TelegramIcon sx={{ fontSize: 22 }} aria-hidden="true" />,
      statusPath: '/settings/notifications/telegram',
      docsUrl: 'https://core.telegram.org/bots',
      detail: {
        kind: 'protocol',
        config: {
          title: 'Telegram',
          description: e.telegram.detailDescription.value,
          statusPath: '/settings/notifications/telegram',
          settingsPath: '/settings/notifications/telegram',
          settingsMethod: 'put',
          disconnectPath: '/settings/notifications/telegram',
          icon: <TelegramIcon sx={{ fontSize: 24 }} aria-hidden="true" />,
          workflow: e.telegram.workflow.value,
          fields: [
            {
              name: 'botToken',
              label: f.botToken.value,
              type: 'password',
              placeholder: '123456:ABC...',
            },
            { name: 'timeoutMs', label: f.timeoutMs.value, type: 'number', placeholder: '10000' },
          ],
        },
      },
    },
  ];
}

/** The catalog with its names, descriptions and field labels in the active locale. */
export function useIntegrationCatalog(): IntegrationEntry[] {
  const t = useIntlayer('integrationCatalog');
  const peppol = useIntlayer('peppol');
  return useMemo(() => buildIntegrationCatalog(t, peppol), [t, peppol]);
}

export function findIntegrationEntry(
  catalog: IntegrationEntry[],
  key: string | null,
): IntegrationEntry | undefined {
  return key ? catalog.find(entry => entry.key === key) : undefined;
}
