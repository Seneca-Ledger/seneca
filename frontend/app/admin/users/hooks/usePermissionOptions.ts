import { useIntlayer } from '@/app/i18n';
import type { ContractInput } from '@/app/lib/query-fn-schema';

export type AdminPermission = ContractInput<'UpdatePermissionsBody'>['permissions'][number];

/** Every permission an admin can grant, labelled in the reader's language. */
export function usePermissionOptions(): Array<{ value: AdminPermission; label: string }> {
  const t = useIntlayer('adminUsersPage');
  return [
    { value: 'statement.view', label: t.permissions.statementView.value },
    { value: 'statement.upload', label: t.permissions.statementUpload.value },
    { value: 'statement.delete', label: t.permissions.statementDelete.value },
    { value: 'statement.edit', label: t.permissions.statementEdit.value },
    { value: 'transaction.view', label: t.permissions.transactionView.value },
    { value: 'transaction.edit', label: t.permissions.transactionEdit.value },
    {
      value: 'transaction.delete',
      label: t.permissions.transactionDelete.value,
    },
    {
      value: 'transaction.bulk_update',
      label: t.permissions.transactionBulkUpdate.value,
    },
    { value: 'category.view', label: t.permissions.categoryView.value },
    { value: 'category.create', label: t.permissions.categoryCreate.value },
    { value: 'category.edit', label: t.permissions.categoryEdit.value },
    { value: 'category.delete', label: t.permissions.categoryDelete.value },
    { value: 'tag.view', label: t.permissions.tagView.value },
    { value: 'tag.create', label: t.permissions.tagCreate.value },
    { value: 'tag.edit', label: t.permissions.tagEdit.value },
    { value: 'tag.delete', label: t.permissions.tagDelete.value },
    { value: 'branch.view', label: t.permissions.branchView.value },
    { value: 'branch.create', label: t.permissions.branchCreate.value },
    { value: 'branch.edit', label: t.permissions.branchEdit.value },
    { value: 'branch.delete', label: t.permissions.branchDelete.value },
    { value: 'wallet.view', label: t.permissions.walletView.value },
    { value: 'wallet.create', label: t.permissions.walletCreate.value },
    { value: 'wallet.edit', label: t.permissions.walletEdit.value },
    { value: 'wallet.delete', label: t.permissions.walletDelete.value },
    { value: 'report.view', label: t.permissions.reportView.value },
    { value: 'report.export', label: t.permissions.reportExport.value },
  ];
}
