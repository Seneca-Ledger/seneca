import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import type { CategoryItem } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { useCategoryBulkActions } from './useCategoryBulkActions';

/** A row of `GET /categories`. */
export type Category = CategoryItem;

export type CategoryUsageCount = {
  transactions: number;
  statements: number;
  total: number;
};

export type CategoryFormData = {
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  withoutIcon: boolean;
  parentId: string;
};

const DEFAULT_FORM: CategoryFormData = {
  name: '',
  type: 'expense',
  color: '#2196F3',
  icon: 'mdi:tag',
  withoutIcon: false,
  parentId: '',
};

type ToastMessages = {
  loadFailed: string;
  updated: string;
  created: string;
  saveFailed: string;
  iconUploaded: string;
  iconUploadFailed: string;
};

type UseCategoryManagementParams = {
  userId: string | undefined;
  toastMessages: ToastMessages;
};

type UseCategoryManagementReturn = {
  categories: Category[];
  loading: boolean;
  usageCounts: Record<string, CategoryUsageCount>;
  togglingIds: Set<string>;
  selectedIds: Set<string>;
  disableConfirm: { category: Category; usage: CategoryUsageCount } | null;
  dialogOpen: boolean;
  editingCategory: Category | null;
  formData: CategoryFormData;
  uploadingIcon: boolean;
  setDisableConfirm: (value: { category: Category; usage: CategoryUsageCount } | null) => void;
  setSelectedIds: (value: Set<string>) => void;
  setFormData: (value: CategoryFormData) => void;
  setDialogOpen: (value: boolean) => void;
  setEditingCategory: (value: Category | null) => void;
  loadCategories: () => Promise<void>;
  handleSave: () => Promise<void>;
  performToggle: (category: Category, nextEnabled: boolean) => Promise<void>;
  handleToggleEnabled: (category: Category) => Promise<void>;
  handleBulkEnable: (enable: boolean) => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleIconFileChange: (file: File) => Promise<void>;
};

function useCategoryData(
  userId: string | undefined,
  loadFailed: string,
): {
  categories: Category[];
  setCategories: (v: Category[]) => void;
  loading: boolean;
  usageCounts: Record<string, CategoryUsageCount>;
  setUsageCounts: (v: Record<string, CategoryUsageCount>) => void;
  loadCategories: () => Promise<void>;
} {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [usageCounts, setUsageCounts] = useState<Record<string, CategoryUsageCount>>({});

  const loadCategories = useCallback(async (): Promise<void> => {
    await (async () => {
      setLoading(true);
      const [categoriesRes, usageRes] = await Promise.all([
        apiClient.get('/categories'),
        apiClient.get('/categories/usage/counts'),
      ]);
      setCategories(await checkContract('CategoryList', categoriesRes.data, '/categories'));
      setUsageCounts(
        await checkContract('CategoryUsageCounts', usageRes.data, '/categories/usage/counts'),
      );
    })()
      .catch(async err => {
        console.error('Failed to load categories:', err);
        toast.error(loadFailed);
      })
      .finally(async () => {
        setLoading(false);
      });
  }, [loadFailed]);

  useEffect(() => {
    if (userId) {
      void loadCategories();
    }
  }, [userId, loadCategories]);

  return { categories, setCategories, loading, usageCounts, setUsageCounts, loadCategories };
}

function useCategoryForm(
  toastMessages: ToastMessages,
  loadCategories: () => Promise<void>,
): {
  dialogOpen: boolean;
  editingCategory: Category | null;
  formData: CategoryFormData;
  uploadingIcon: boolean;
  setDialogOpen: (v: boolean) => void;
  setEditingCategory: (v: Category | null) => void;
  setFormData: (v: CategoryFormData) => void;
  handleSave: () => Promise<void>;
  handleIconFileChange: (file: File) => Promise<void>;
} {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(DEFAULT_FORM);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  const handleSave = async (): Promise<void> => {
    await (async () => {
      const { withoutIcon, ...restFormData } = formData;
      const data = {
        ...restFormData,
        icon: withoutIcon ? undefined : restFormData.icon,
        parentId: restFormData.parentId || undefined,
      };
      if (editingCategory) {
        await apiClient.put(
          `/categories/${editingCategory.id}`,
          data satisfies ContractInput<'UpdateCategoryBody'>,
        );
        toast.success(toastMessages.updated);
      } else {
        await apiClient.post('/categories', data satisfies ContractInput<'CreateCategoryBody'>);
        toast.success(toastMessages.created);
      }
      await loadCategories();
      setDialogOpen(false);
      setEditingCategory(null);
    })().catch(async err => {
      console.error('Failed to save category:', err);
      toast.error(toastMessages.saveFailed);
    });
  };

  const handleIconFileChange = async (file: File): Promise<void> => {
    const fd = new FormData();
    fd.append('icon', file);
    setUploadingIcon(true);

    await (async () => {
      const response = await apiClient.post('/data-entry/custom-fields/icon', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { url } = await checkContract(
        'UploadedIcon',
        response.data,
        '/data-entry/custom-fields/icon',
      );
      if (url) {
        setFormData(prev => ({ ...prev, icon: url, withoutIcon: false }));
        toast.success(toastMessages.iconUploaded);
      }
    })()
      .catch(async err => {
        console.error('Failed to upload icon:', err);
        toast.error(toastMessages.iconUploadFailed);
      })
      .finally(async () => {
        setUploadingIcon(false);
      });
  };

  return {
    dialogOpen,
    editingCategory,
    formData,
    uploadingIcon,
    setDialogOpen,
    setEditingCategory,
    setFormData,
    handleSave,
    handleIconFileChange,
  };
}

type ToggleHookParams = {
  toastMessages: ToastMessages;
  categories: Category[];
  setCategories: (v: Category[]) => void;
  loadCategories: () => Promise<void>;
};
type ToggleState = {
  togglingIds: Set<string>;
  setTogglingIds: (fn: (p: Set<string>) => Set<string>) => void;
  disableConfirm: { category: Category; usage: CategoryUsageCount } | null;
  setDisableConfirm: (v: { category: Category; usage: CategoryUsageCount } | null) => void;
};

function usePerformToggle(
  params: ToggleHookParams,
  state: ToggleState,
): (category: Category, nextEnabled: boolean) => Promise<void> {
  const { toastMessages, categories, setCategories } = params;
  const { setTogglingIds, setDisableConfirm } = state;
  return async (category: Category, nextEnabled: boolean): Promise<void> => {
    setDisableConfirm(null);
    setTogglingIds(prev => new Set(prev).add(category.id));

    await (async () => {
      await apiClient.put(`/categories/${category.id}`, {
        isEnabled: nextEnabled,
      } satisfies ContractInput<'UpdateCategoryBody'>);
      setCategories(
        categories.map(item =>
          item.id === category.id ? { ...item, isEnabled: nextEnabled } : item,
        ),
      );
    })()
      .catch(async err => {
        console.error('Failed to toggle:', err);
        toast.error(toastMessages.saveFailed);
      })
      .finally(async () => {
        setTogglingIds(prev => {
          const next = new Set(prev);
          next.delete(category.id);
          return next;
        });
      });
  };
}

function useCategoryToggle({
  toastMessages,
  categories,
  setCategories,
  loadCategories,
}: ToggleHookParams): {
  togglingIds: Set<string>;
  selectedIds: Set<string>;
  disableConfirm: { category: Category; usage: CategoryUsageCount } | null;
  setSelectedIds: (v: Set<string>) => void;
  setDisableConfirm: (v: { category: Category; usage: CategoryUsageCount } | null) => void;
  performToggle: (category: Category, nextEnabled: boolean) => Promise<void>;
  handleToggleEnabled: (category: Category) => Promise<void>;
  handleBulkEnable: (enable: boolean) => Promise<void>;
  handleBulkDelete: () => Promise<void>;
} {
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [disableConfirm, setDisableConfirm] = useState<{
    category: Category;
    usage: CategoryUsageCount;
  } | null>(null);
  const state: ToggleState = { togglingIds, setTogglingIds, disableConfirm, setDisableConfirm };
  const performToggle = usePerformToggle(
    { toastMessages, categories, setCategories, loadCategories },
    state,
  );

  const handleToggleEnabled = async (category: Category): Promise<void> => {
    if (togglingIds.has(category.id)) {
      return;
    }
    const nextEnabled = category.isEnabled === false;
    if (!nextEnabled) {
      const usage = await apiQueryDecoded({
        url: `/categories/${category.id}/usage-count`,
        contract: 'CategoryUsageCount',
      }).catch((err: unknown) => {
        console.error('Failed to get usage count:', err);
        return null;
      });
      if (usage && usage.total > 0) {
        setDisableConfirm({ category, usage });
        return;
      }
    }
    await performToggle(category, nextEnabled);
  };

  const { handleBulkEnable, handleBulkDelete } = useCategoryBulkActions({
    categories,
    selectedIds,
    setSelectedIds,
    loadCategories,
    saveFailed: toastMessages.saveFailed,
  });

  return {
    togglingIds,
    selectedIds,
    disableConfirm,
    setSelectedIds,
    setDisableConfirm,
    performToggle,
    handleToggleEnabled,
    handleBulkEnable,
    handleBulkDelete,
  };
}

export function useCategoryManagement({
  userId,
  toastMessages,
}: UseCategoryManagementParams): UseCategoryManagementReturn {
  const { categories, setCategories, loading, usageCounts, loadCategories } = useCategoryData(
    userId,
    toastMessages.loadFailed,
  );
  const formHook = useCategoryForm(toastMessages, loadCategories);
  const toggleHook = useCategoryToggle({
    toastMessages,
    categories,
    setCategories,
    loadCategories,
  });
  return { categories, loading, usageCounts, loadCategories, ...formHook, ...toggleHook };
}
