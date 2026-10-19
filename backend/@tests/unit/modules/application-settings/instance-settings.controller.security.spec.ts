import { GUARDS_METADATA } from '@nestjs/common/constants';
import { InstanceAdminGuard } from '@/common/guards/instance-admin.guard';
import { InstanceSettingsController } from '@/modules/application-settings/instance-settings.controller';

describe('InstanceSettingsController security metadata', () => {
  // Server-wide settings: no workspace role may change them, only an instance admin.
  it('lets only instance admins in, for every route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, InstanceSettingsController)).toEqual([
      InstanceAdminGuard,
    ]);
  });
});
