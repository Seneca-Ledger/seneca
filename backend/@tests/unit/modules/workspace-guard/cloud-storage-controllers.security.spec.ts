import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_KEY } from '@/common/decorators/require-permission.decorator';
import { Permission } from '@/common/enums/permissions.enum';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { WorkspaceContextGuard } from '@/common/guards/workspace-context.guard';
import { IS_PUBLIC_KEY } from '@/modules/auth/decorators/public.decorator';
import { DropboxController } from '@/modules/dropbox/dropbox.controller';
import { GoogleDriveController } from '@/modules/google-drive/google-drive.controller';

type Handler = (...args: never[]) => unknown;

const handlersOf = (controller: { prototype: object }) => {
  const proto = controller.prototype as Record<string, Handler>;
  return Object.getOwnPropertyNames(proto)
    .filter(name => name !== 'constructor' && typeof proto[name] === 'function')
    .map(name => [name, proto[name]] as const);
};

/**
 * The integration belongs to the workspace it was connected in, and every
 * route reads it by `@WorkspaceId()`, which only WorkspaceContextGuard sets.
 * The OAuth callback is the exception: the provider calls it without the
 * header, and the workspace travels in the signed state instead.
 */
describe.each([
  ['DropboxController', DropboxController],
  ['GoogleDriveController', GoogleDriveController],
])('%s security metadata', (_name, controller) => {
  it.each(handlersOf(controller))('%s is public or runs in a workspace', (name, handler) => {
    if (Reflect.getMetadata(IS_PUBLIC_KEY, handler)) {
      expect(name).toBe('callback');
      return;
    }

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(
      expect.arrayContaining([WorkspaceContextGuard]),
    );
  });

  it.each(['connect', 'disconnect', 'updateSettings', 'getPickerToken', 'importFiles', 'sync'])(
    '%s requires managing the workspace’s integrations',
    name => {
      const handler = (controller.prototype as Record<string, Handler>)[name];

      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(
        expect.arrayContaining([WorkspaceContextGuard, PermissionsGuard]),
      );
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
        Permission.INTEGRATION_MANAGE,
      ]);
    },
  );
});
