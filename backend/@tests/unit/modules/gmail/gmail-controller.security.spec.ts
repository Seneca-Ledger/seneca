import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '@/common/decorators/require-permission.decorator';
import { Permission } from '@/common/enums/permissions.enum';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { WorkspaceContextGuard } from '@/common/guards/workspace-context.guard';
import { GmailController } from '@/modules/gmail/gmail.controller';

/**
 * Receipt routes scope by `@WorkspaceId()`, which is only set by
 * WorkspaceContextGuard. Without the guard it is undefined, and TypeORM drops
 * an undefined `where` value, so the query would span every workspace.
 */
describe('GmailController security metadata', () => {
  it.each([
    ['listReceipts', Permission.STATEMENT_VIEW],
    ['getReceipt', Permission.STATEMENT_VIEW],
    ['getReceiptThumbnail', Permission.STATEMENT_VIEW],
    ['getReceiptFile', Permission.STATEMENT_VIEW],
    ['getReceiptPreview', Permission.STATEMENT_VIEW],
    ['exportToXlsx', Permission.STATEMENT_VIEW],
    ['updateReceipt', Permission.STATEMENT_EDIT],
    ['approveReceipt', Permission.STATEMENT_EDIT],
    ['updateParsedData', Permission.STATEMENT_EDIT],
    ['markDuplicate', Permission.STATEMENT_EDIT],
    ['unmarkDuplicate', Permission.STATEMENT_EDIT],
    ['bulkApprove', Permission.STATEMENT_EDIT],
    ['reparseMerchants', Permission.STATEMENT_EDIT],
    // Integration routes: the mailbox belongs to the workspace it was connected in.
    ['getConnectUrl', Permission.INTEGRATION_MANAGE],
    ['disconnect', Permission.INTEGRATION_MANAGE],
    ['triggerSync', Permission.INTEGRATION_MANAGE],
    ['updateSettings', Permission.INTEGRATION_MANAGE],
    ['exportToDraft', Permission.INTEGRATION_MANAGE],
  ])('scopes %s to the current workspace with %s', (methodName, permission) => {
    const handler = GmailController.prototype[methodName as keyof GmailController] as (
      ...args: never[]
    ) => unknown;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(
      expect.arrayContaining([WorkspaceContextGuard, PermissionsGuard]),
    );
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([permission]);
  });

  it('reads the status of the current workspace’s integration', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, GmailController.prototype.getStatus)).toEqual(
      expect.arrayContaining([WorkspaceContextGuard]),
    );
  });
});
