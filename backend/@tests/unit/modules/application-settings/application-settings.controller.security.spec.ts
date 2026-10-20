import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '@/common/decorators/require-permission.decorator';
import { InstanceAdminGuard } from '@/common/guards/instance-admin.guard';
import { WorkspaceContextGuard } from '@/common/guards/workspace-context.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { Permission } from '@/common/enums/permissions.enum';
import { ApplicationSettingsController } from '@/modules/application-settings/application-settings.controller';

describe('ApplicationSettingsController security metadata', () => {
  it.each([
    ['saveLocalCategorization'],
    ['uploadLocalCategorizationModel'],
    ['saveSmtp'],
    ['disconnectSmtp'],
    ['saveTelegram'],
    ['disconnectTelegram'],
    ['saveApp'],
    ['disconnectApp'],
  ])('requires workspace settings permission on %s', methodName => {
    const handler = ApplicationSettingsController.prototype[
      methodName as keyof ApplicationSettingsController
    ] as (...args: never[]) => unknown;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(
      expect.arrayContaining([WorkspaceContextGuard, PermissionsGuard]),
    );
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      Permission.WORKSPACE_SETTINGS_MANAGE,
    ]);
  });

  // The model root is shared by every workspace on the server.
  it('lets only an instance admin install a categorization model', () => {
    const handler = ApplicationSettingsController.prototype.uploadLocalCategorizationModel;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(
      expect.arrayContaining([InstanceAdminGuard]),
    );
  });

  // Settings belong to the workspace open in the request; without the guard
  // the service fell back to the caller's registration workspace.
  it.each(
    Object.getOwnPropertyNames(ApplicationSettingsController.prototype).filter(
      name => name !== 'constructor',
    ),
  )('runs %s in the workspace of the request', methodName => {
    const handler = ApplicationSettingsController.prototype[
      methodName as keyof ApplicationSettingsController
    ] as (...args: never[]) => unknown;

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(
      expect.arrayContaining([WorkspaceContextGuard]),
    );
  });
});
