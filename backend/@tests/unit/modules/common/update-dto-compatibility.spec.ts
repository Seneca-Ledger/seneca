import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCategoryBody, UpdateCustomTableColumnBody, UpdateWalletBody, UpdateWorkspaceBody } from '@/contracts';
import { CategoryType } from '@/entities/category.entity';
import { UpdateDriveSettingsDto } from '@/modules/google-drive/dto/update-drive-settings.dto';
import { UpdateDropboxSettingsDto } from '@/modules/dropbox/dto/update-dropbox-settings.dto';
import { rejectedFields } from '../../../helpers/schema-body';

describe('update DTO compatibility', () => {
  it('keeps category update fields optional with existing validation rules', () => {
    expect(
      rejectedFields(UpdateCategoryBody, {
        name: 'Food',
        type: CategoryType.EXPENSE,
        parentId: 'not-a-uuid',
      }),
    ).toContain('parentId');
  });

  it('keeps custom table column update fields optional with existing validation rules', () => {
    const fields = rejectedFields(UpdateCustomTableColumnBody, { title: '', position: -1 });

    expect(fields).toContain('title');
    expect(fields).toContain('position');
  });

  it('preserves workspace and wallet extra optional flags', () => {
    expect(rejectedFields(UpdateWorkspaceBody, { isFavorite: true })).toEqual([]);
    expect(rejectedFields(UpdateWalletBody, { isActive: false })).toEqual([]);
  });

  it('keeps drive and dropbox settings DTOs aligned', async () => {
    const payload = {
      folderId: 'folder-1',
      folderName: 'Receipts',
      syncEnabled: true,
      syncTime: '09:30',
      timeZone: 'Asia/Almaty',
    };

    const driveDto = plainToInstance(UpdateDriveSettingsDto, payload);
    const dropboxDto = plainToInstance(UpdateDropboxSettingsDto, payload);

    expect(await validate(driveDto as object)).toHaveLength(0);
    expect(await validate(dropboxDto as object)).toHaveLength(0);
  });
});
