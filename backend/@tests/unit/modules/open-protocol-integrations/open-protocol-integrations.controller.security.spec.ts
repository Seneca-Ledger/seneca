import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '@/common/decorators/require-permission.decorator';
import { WorkspaceContextGuard } from '@/common/guards/workspace-context.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { Permission } from '@/common/enums/permissions.enum';
import { OpenProtocolIntegrationsController } from '@/modules/open-protocol-integrations/open-protocol-integrations.controller';

describe('OpenProtocolIntegrationsController security metadata', () => {
  it.each([
    ['saveS3Settings'],
    ['importS3Files'],
    ['syncS3'],
    ['disconnectS3'],
    ['saveWebdavSettings'],
    ['importWebdavFiles'],
    ['syncWebdav'],
    ['disconnectWebdav'],
    ['saveImapSettings'],
    ['listImapFolders'],
    ['syncImap'],
    ['disconnectImap'],
    ['listS3Files'],
    ['listWebdavFiles'],
  ])('requires integration management permission on %s', methodName => {
    const handler = OpenProtocolIntegrationsController.prototype[
      methodName as keyof OpenProtocolIntegrationsController
    ] as (...args: never[]) => unknown;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(
      expect.arrayContaining([WorkspaceContextGuard, PermissionsGuard]),
    );
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      Permission.INTEGRATION_MANAGE,
    ]);
  });

  it.each([['s3Status'], ['webdavStatus'], ['imapStatus']])(
    'reads %s for the workspace of the request',
    methodName => {
      const handler = OpenProtocolIntegrationsController.prototype[
        methodName as keyof OpenProtocolIntegrationsController
      ] as (...args: never[]) => unknown;

      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(
        expect.arrayContaining([WorkspaceContextGuard]),
      );
    },
  );
});
