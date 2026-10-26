'use client';

import ConfirmModal from '@/app/components/ConfirmModal';
import { CategoryFormDialog } from '@/app/components/categories/CategoryFormDialog';
import { DataGrid, useDataGrid } from '@/app/components/data-grid';
import { BookmarkOutline, Plus } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { PageTitle } from '@/app/components/ui/page-title';
import { useLocale } from '@/app/i18n';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import type { Category } from './category-labels';
import { CategoryDisableMessage } from './components/CategoryDisableMessage';
import { useCategoriesPage } from './hooks/useCategoriesPage';
import { useCategoryColumns } from './hooks/useCategoryColumns';

export default function CategoriesPage() {
  const { locale } = useLocale();
  const {
    t,
    categoriesQuery,
    usageQuery,
    labels,
    actions,
    search,
    setSearch,
    dialogOpen,
    editing,
    deleteTarget,
    deleting,
    disableConfirm,
    openDialog,
    closeDialog,
    setDeleteTarget,
    setDisableConfirm,
    handleDelete,
    setEnabled,
  } = useCategoriesPage();

  const categories = categoriesQuery.data ?? [];
  const query = search.trim().toLowerCase();
  const visible = query
    ? categories.filter(category =>
        getCategoryDisplayName(category, locale).toLowerCase().includes(query),
      )
    : categories;

  const columns = useCategoryColumns({
    labels,
    locale,
    usage: usageQuery.data ?? {},
    search,
    onSearch: setSearch,
    actions,
  });
  const table = useDataGrid<Category>({
    data: visible,
    columns,
    getRowId: row => row.id,
    initialState: { sorting: [{ id: 'name', desc: false }] },
  });

  const noCategories = !categoriesQuery.isPending && categories.length === 0;

  return (
    <div className="seneca-categories">
      <PageTitle path="/categories" />
      <section className="seneca-categories__card">
        <header className="seneca-categories__header">
          <h2 className="seneca-categories__title">{t.title}</h2>
          <Button
            size="sm"
            type="button"
            data-tour-id="categories-add-button"
            onClick={() => openDialog(null)}
          >
            <Plus size={18} aria-hidden />
            {t.createNew}
          </Button>
        </header>
        <div data-tour-id="categories-list">
          {noCategories ? (
            <EmptyState
              icon={<BookmarkOutline size={28} />}
              size="sm"
              title={t.noData}
              description={t.emptyDescription}
              action={
                <Button size="sm" type="button" onClick={() => openDialog(null)}>
                  <Plus size={18} aria-hidden />
                  {t.createNew}
                </Button>
              }
              compact
            />
          ) : (
            <DataGrid
              table={table}
              caption={t.title.value}
              loading={categoriesQuery.isPending}
              skeletonRows={6}
              emptyState={<p className="seneca-categories__none">{t.noData}</p>}
            />
          )}
        </div>
      </section>

      <CategoryFormDialog open={dialogOpen} category={editing} onClose={closeDialog} />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title={t.deleteTitle.value}
        message={
          deleteTarget ? (
            <>
              <strong>{getCategoryDisplayName(deleteTarget, locale)}</strong>
              {'. '}
              {t.deleteMessage}
            </>
          ) : null
        }
        confirmText={t.actions.delete.value}
        cancelText={t.dialog.cancel.value}
        isDestructive
        isLoading={deleting}
      />

      <ConfirmModal
        isOpen={disableConfirm !== null}
        onClose={() => setDisableConfirm(null)}
        onConfirm={() => {
          if (disableConfirm) {
            void setEnabled(disableConfirm.category, false);
          }
        }}
        title={t.manage.disableDialog.title.value}
        message={
          disableConfirm ? (
            <CategoryDisableMessage
              category={disableConfirm.category}
              usage={disableConfirm.usage}
            />
          ) : null
        }
        confirmText={t.manage.disable.value}
        cancelText={t.dialog.cancel.value}
        isDestructive
      />
    </div>
  );
}
