'use client';

import { useState } from 'react';
import apiClient from '../../../lib/api';
import { checkContract } from '../../../lib/query-fn-schema';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions: string[] | null;
  createdAt: string;
}

export interface PermissionsHandlers {
  editingUser: User | null;
  selectedPermissions: string[];
  saving: boolean;
  permissionsDialogOpen: boolean;
  handleEditPermissions: (user: User) => Promise<void>;
  handleSavePermissions: () => Promise<void>;
  handleResetPermissions: () => Promise<void>;
  handleTogglePermission: (permission: string) => void;
  handleCloseDialog: () => void;
}

async function fetchUserPermissions(userId: string): Promise<string[]> {
  const response = await apiClient.get(`/users/${userId}/permissions`);
  const { customPermissions } = await checkContract(
    'UserPermissions',
    response.data,
    '/users/:id/permissions',
  );
  return [...customPermissions];
}

export function usePermissionsHandlers({
  loadUsers,
  errorMessages,
}: {
  loadUsers: () => Promise<void>;
  errorMessages: { loadPermissions: string; savePermissions: string; resetPermissions: string };
}): PermissionsHandlers {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);

  const handleEditPermissions = async (user: User): Promise<void> => {
    await (async () => {
      setSelectedPermissions(await fetchUserPermissions(user.id));
      setEditingUser(user);
      setPermissionsDialogOpen(true);
    })().catch(async () => {
      console.error(errorMessages.loadPermissions);
    });
  };

  const handleSavePermissions = async (): Promise<void> => {
    if (!editingUser) {
      return;
    }
    setSaving(true);

    await (async () => {
      await apiClient.put(`/users/${editingUser.id}/permissions`, {
        permissions: selectedPermissions,
      });
      setPermissionsDialogOpen(false);
      setEditingUser(null);
      void loadUsers();
    })()
      .catch(async () => {
        console.error(errorMessages.savePermissions);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const handleResetPermissions = async (): Promise<void> => {
    if (!editingUser) {
      return;
    }
    setSaving(true);

    await (async () => {
      await apiClient.post(`/users/${editingUser.id}/permissions/reset`);
      setPermissionsDialogOpen(false);
      setEditingUser(null);
      void loadUsers();
    })()
      .catch(async () => {
        console.error(errorMessages.resetPermissions);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  return {
    editingUser,
    selectedPermissions,
    saving,
    permissionsDialogOpen,
    handleEditPermissions,
    handleSavePermissions,
    handleResetPermissions,
    handleTogglePermission: (permission: string): void =>
      setSelectedPermissions(prev =>
        prev.includes(permission) ? prev.filter(p => p !== permission) : [...prev, permission],
      ),
    handleCloseDialog: (): void => {
      setPermissionsDialogOpen(false);
      setEditingUser(null);
    },
  };
}
