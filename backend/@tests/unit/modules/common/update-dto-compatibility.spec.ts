import { UpdateCategoryBody, UpdateCustomTableColumnBody, UpdateWalletBody, UpdateWorkspaceBody } from '@/contracts';
import { CategoryType } from '@/entities/category.entity';
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
});
