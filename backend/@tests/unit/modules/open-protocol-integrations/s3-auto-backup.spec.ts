jest.mock('webdav', () => ({ createClient: jest.fn() }));
jest.mock('../../../../src/common/utils/egress-url.util', () => ({
  assertPublicEgressHost: jest.fn(),
  assertPublicEgressUrl: jest.fn(),
  createPublicEgressHttpAgents: jest.fn(() => ({
    lookup: jest.fn(),
    httpAgent: {},
    httpsAgent: {},
  })),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(args => args),
  HeadBucketCommand: jest.fn(),
}));

import { Readable } from 'stream';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { OpenProtocolIntegrationsService } from '../../../../src/modules/open-protocol-integrations/open-protocol-integrations.service';
import { IntegrationProvider, IntegrationStatus } from '../../../../src/entities';
import type { Integration, OpenProtocolSettings, Statement } from '../../../../src/entities';

const s3SendMock = jest.fn().mockResolvedValue({});
(S3Client as jest.Mock).mockImplementation(() => ({ send: s3SendMock }));

const makeSettings = (config: Record<string, unknown>): OpenProtocolSettings =>
  ({
    config: {
      endpoint: 'https://s3.test.com',
      bucket: 'test-bucket',
      region: 'us-east-1',
      prefix: '',
      forcePathStyle: false,
      ...config,
    },
    encryptedSecrets: {},
  }) as unknown as OpenProtocolSettings;

const makeIntegration = (settings: OpenProtocolSettings | null): Integration =>
  ({
    id: 'integration-1',
    provider: IntegrationProvider.S3_COMPATIBLE,
    status: IntegrationStatus.CONNECTED,
    workspaceId: 'ws-1',
    openProtocolSettings: settings,
  }) as unknown as Integration;

const makeStatement = (): Statement =>
  ({
    id: 'stmt-1',
    fileName: 'bank.csv',
    filePath: '/uploads/bank.csv',
    fileType: 'csv',
    fileHash: null,
    userId: 'user-1',
  }) as unknown as Statement;

describe('OpenProtocolIntegrationsService.autoBackupStatementToS3', () => {
  const integrationRepository = { findOne: jest.fn() };
  const statementRepository = { findOne: jest.fn() };
  const fileStorageService = { getStatementFileStream: jest.fn() };

  const createService = () =>
    new OpenProtocolIntegrationsService(
      integrationRepository as never,
      {} as never,
      statementRepository as never,
      {} as never,
      {} as never,
      fileStorageService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    s3SendMock.mockResolvedValue({});
    (S3Client as jest.Mock).mockImplementation(() => ({ send: s3SendMock }));
    fileStorageService.getStatementFileStream.mockResolvedValue({
      stream: Readable.from(Buffer.from('csv')),
      fileName: 'bank.csv',
      mimeType: 'text/csv',
      source: 'disk',
    });
  });

  it('uploads statement file to S3 when autoBackup is enabled', async () => {
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration(makeSettings({ autoBackup: true })),
    );
    statementRepository.findOne.mockResolvedValue(makeStatement());

    await createService().autoBackupStatementToS3('ws-1', 'stmt-1');

    expect(s3SendMock).toHaveBeenCalledTimes(1);
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ Bucket: 'test-bucket', Key: 'bank.csv' }),
    );
  });

  it('skips upload when autoBackup is false', async () => {
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration(makeSettings({ autoBackup: false })),
    );

    await createService().autoBackupStatementToS3('ws-1', 'stmt-1');

    expect(s3SendMock).not.toHaveBeenCalled();
  });

  it('skips when no S3 integration exists for the workspace', async () => {
    integrationRepository.findOne.mockResolvedValue(null);

    await createService().autoBackupStatementToS3('ws-1', 'stmt-1');

    expect(s3SendMock).not.toHaveBeenCalled();
  });

  // The connection test on save runs right after the endpoint passed the egress
  // check; without the pinned agents a short-TTL name could resolve privately
  // for the probe itself (DNS rebinding).
  it('probes a new S3 endpoint through the pinned-lookup agents', async () => {
    const service = createService() as unknown as {
      assertS3Connection: (config: Record<string, unknown>) => Promise<void>;
    };

    await service.assertS3Connection({
      endpoint: 'https://s3.test.com',
      bucket: 'test-bucket',
      region: 'us-east-1',
      forcePathStyle: false,
    });

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({ requestHandler: expect.any(NodeHttpHandler) }),
    );
  });
});
