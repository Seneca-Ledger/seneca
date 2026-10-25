import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import type { CurrencySearchItem } from '@/app/lib/statement-expense-drawer';
import { useCurrencyState } from './useWorkspaceCurrencyState';

export type WorkspaceInfo = {
  id: string;
  name: string;
  description: string | null;
  currency: string | null;
  backgroundImage: string | null;
  memberRole?: string;
};

export type WorkspaceOverviewState = {
  workspace: WorkspaceInfo;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  currency: string;
  saving: boolean;
  deleting: boolean;
  showBackgroundPicker: boolean;
  setShowBackgroundPicker: (v: boolean) => void;
  savingBackground: boolean;
  currencyDrawerOpen: boolean;
  setCurrencyDrawerOpen: (v: boolean) => void;
  currencySearch: string;
  setCurrencySearch: (v: string) => void;
  deleteModalOpen: boolean;
  deleteConfirmationName: string;
  setDeleteConfirmationName: (v: string) => void;
  isDirty: boolean;
  isDeleteConfirmationMatched: boolean;
  selectedCurrencyItem: CurrencySearchItem | null | undefined;
  currencyQuery: string;
  selectedMatchesSearch: boolean;
  recentCurrencyItems: CurrencySearchItem[];
  allCurrencyItems: CurrencySearchItem[];
  notSelectedLabel: string;
  notSelectedMatchesSearch: boolean;
  handleSave: () => Promise<void>;
  handleDelete: () => Promise<void>;
  openDeleteModal: () => void;
  closeDeleteModal: () => void;
  handleSelectCurrency: (code: string) => void;
  handleBackgroundChange: (background: string) => Promise<void>;
};

function useWorkspaceActions(
  workspaceId: string | undefined,
  refreshWorkspaces: () => Promise<void>,
  clearWorkspace: () => void,
): {
  saving: boolean;
  deleting: boolean;
  deleteModalOpen: boolean;
  deleteConfirmationName: string;
  setDeleteConfirmationName: (v: string) => void;
  openDeleteModal: () => void;
  closeDeleteModal: () => void;
  handleSave: (params: { name: string; description: string; currency: string }) => Promise<void>;
  handleDelete: (params: {
    confirmName: string;
    workspaceName: string;
    onSuccess: () => void;
  }) => Promise<void>;
} {
  const t = useIntlayer('workspaceOverview');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');

  const openDeleteModal = (): void => {
    setDeleteConfirmationName('');
    setDeleteModalOpen(true);
  };
  const closeDeleteModal = (): void => {
    if (deleting) {
      return;
    }
    setDeleteModalOpen(false);
    setDeleteConfirmationName('');
  };

  const handleSave = async ({
    name,
    description,
    currency,
  }: {
    name: string;
    description: string;
    currency: string;
  }): Promise<void> => {
    if (!(workspaceId && name.trim())) {
      return;
    }
    setSaving(true);

    await (async () => {
      await apiClient.patch(`/workspaces/${workspaceId}`, {
        name: name.trim(),
        description: description.trim() || undefined,
        currency: currency || undefined,
      } satisfies ContractInput<'UpdateWorkspaceBody'>);
      await refreshWorkspaces();
      toast.success(t.toasts.updated.value);
    })()
      .catch(async err => {
        console.error('Failed to update workspace:', err);
        toast.error(t.toasts.updateFailed.value);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const handleDelete = async ({
    confirmName,
    workspaceName,
    onSuccess,
  }: {
    confirmName: string;
    workspaceName: string;
    onSuccess: () => void;
  }): Promise<void> => {
    if (!workspaceId || confirmName.trim() !== workspaceName) {
      return;
    }
    setDeleting(true);

    await (async () => {
      await apiClient.delete(`/workspaces/${workspaceId}`);
      clearWorkspace();
      await refreshWorkspaces();
      toast.success(t.toasts.deleted.value);
      setDeleteModalOpen(false);
      setDeleteConfirmationName('');
      onSuccess();
    })()
      .catch(async err => {
        console.error('Failed to delete workspace:', err);
        toast.error(t.toasts.deleteFailed.value);
      })
      .finally(async () => {
        setDeleting(false);
      });
  };

  return {
    saving,
    deleting,
    deleteModalOpen,
    deleteConfirmationName,
    setDeleteConfirmationName,
    openDeleteModal,
    closeDeleteModal,
    handleSave,
    handleDelete,
  };
}

export function useWorkspaceOverview(): WorkspaceOverviewState | null {
  const router = useRouter();
  const t = useIntlayer('workspaceOverview');
  const { notSelected } = useIntlayer('workspaceCurrencySelector');
  const { currentWorkspace, refreshWorkspaces, clearWorkspace, updateWorkspaceBackground } =
    useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('');
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [savingBackground, setSavingBackground] = useState(false);
  const [currencyDrawerOpen, setCurrencyDrawerOpen] = useState(false);

  useEffect(() => {
    if (!currentWorkspace) {
      return;
    }
    setName(currentWorkspace.name ?? '');
    setDescription(currentWorkspace.description ?? '');
    setCurrency(currentWorkspace.currency ?? '');
  }, [currentWorkspace]);

  const currencyState = useCurrencyState(currency, notSelected.value);
  const actions = useWorkspaceActions(currentWorkspace?.id, refreshWorkspaces, clearWorkspace);

  const isDirty =
    Boolean(currentWorkspace) &&
    (name !== (currentWorkspace?.name ?? '') ||
      description !== (currentWorkspace?.description ?? '') ||
      currency !== (currentWorkspace?.currency ?? ''));
  const isDeleteConfirmationMatched =
    actions.deleteConfirmationName.trim() === (currentWorkspace?.name ?? '');

  const handleSelectCurrency = (code: string): void => {
    setCurrency(code);
    if (code) {
      currencyState.pushRecentCurrency(code);
    }
    currencyState.setCurrencySearch('');
    setCurrencyDrawerOpen(false);
  };

  const handleBackgroundChange = async (background: string): Promise<void> => {
    if (!currentWorkspace) {
      return;
    }
    setSavingBackground(true);

    await (async () => {
      await updateWorkspaceBackground({
        workspaceId: currentWorkspace.id,
        backgroundImage: background,
      });
      toast.success(t.toasts.backgroundUpdated.value);
      setShowBackgroundPicker(false);
    })()
      .catch(async () => {
        toast.error(t.toasts.backgroundFailed.value);
      })
      .finally(async () => {
        setSavingBackground(false);
      });
  };

  if (!currentWorkspace) {
    return null;
  }

  return {
    workspace: currentWorkspace,
    name,
    setName,
    description,
    setDescription,
    currency,
    saving: actions.saving,
    deleting: actions.deleting,
    showBackgroundPicker,
    setShowBackgroundPicker,
    savingBackground,
    currencyDrawerOpen,
    setCurrencyDrawerOpen,
    currencySearch: currencyState.currencySearch,
    setCurrencySearch: currencyState.setCurrencySearch,
    deleteModalOpen: actions.deleteModalOpen,
    deleteConfirmationName: actions.deleteConfirmationName,
    setDeleteConfirmationName: actions.setDeleteConfirmationName,
    isDirty,
    isDeleteConfirmationMatched,
    selectedCurrencyItem: currencyState.selectedCurrencyItem,
    currencyQuery: currencyState.currencyQuery,
    selectedMatchesSearch: currencyState.selectedMatchesSearch,
    recentCurrencyItems: currencyState.recentCurrencyItems,
    allCurrencyItems: currencyState.allCurrencyItems,
    notSelectedLabel: notSelected.value,
    notSelectedMatchesSearch: currencyState.notSelectedMatchesSearch,
    handleSave: () => actions.handleSave({ name, description, currency }),
    handleDelete: () =>
      actions.handleDelete({
        confirmName: actions.deleteConfirmationName,
        workspaceName: currentWorkspace.name,
        onSuccess: () => router.replace('/workspaces/list'),
      }),
    openDeleteModal: actions.openDeleteModal,
    closeDeleteModal: actions.closeDeleteModal,
    handleSelectCurrency,
    handleBackgroundChange,
  };
}
