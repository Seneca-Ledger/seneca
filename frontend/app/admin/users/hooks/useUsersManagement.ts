'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '../../../lib/api';
import { checkContract } from '../../../lib/query-fn-schema';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions: string[] | null;
  createdAt: string;
}

interface ErrorResponse {
  response?: { data?: { message?: string } };
}

export function useUsersManagement(errorMessages: {
  loadUsers: string;
  loadPermissions: string;
  savePermissions: string;
  resetPermissions: string;
  updateRole: string;
  updateStatus: string;
}) {
  const [users, setUsers] = useState<User[]>([]);
  // Первый рендер должен быть скелетоном, а не пустым состоянием: фетч уходит
  // из useEffect, т.е. уже после первой отрисовки.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    await (async () => {
      const response = await apiClient.get('/users');
      setUsers([...(await checkContract('AdminUserList', response.data, '/users'))]);
    })()
      .catch(async (err: unknown) => {
        const e = err as ErrorResponse;
        setError(e.response?.data?.message ?? errorMessages.loadUsers);
      })
      .finally(async () => {
        setLoading(false);
      });
  }, [errorMessages.loadUsers]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleEditPermissions = async (user: User): Promise<void> => {
    await (async () => {
      const response = await apiClient.get(`/users/${user.id}/permissions`);
      const { customPermissions } = await checkContract(
        'UserPermissions',
        response.data,
        '/users/:id/permissions',
      );
      setSelectedPermissions([...customPermissions]);
      setEditingUser(user);
      setPermissionsDialogOpen(true);
    })().catch(async (err: unknown) => {
      const e = err as ErrorResponse;
      setError(e.response?.data?.message ?? errorMessages.loadPermissions);
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
      .catch(async (err: unknown) => {
        const e = err as ErrorResponse;
        setError(e.response?.data?.message ?? errorMessages.savePermissions);
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
      .catch(async (err: unknown) => {
        const e = err as ErrorResponse;
        setError(e.response?.data?.message ?? errorMessages.resetPermissions);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const handleTogglePermission = (permission: string): void => {
    setSelectedPermissions(prev =>
      prev.includes(permission) ? prev.filter(p => p !== permission) : [...prev, permission],
    );
  };

  const handleUpdateRole = async (userId: string, newRole: string): Promise<void> => {
    await (async () => {
      await apiClient.put(`/users/${userId}`, { role: newRole });
      void loadUsers();
    })().catch(async (err: unknown) => {
      const e = err as ErrorResponse;
      setError(e.response?.data?.message ?? errorMessages.updateRole);
    });
  };

  const handleToggleActive = async (user: User): Promise<void> => {
    await (async () => {
      await apiClient.put(`/users/${user.id}`, { isActive: !user.isActive });
      void loadUsers();
    })().catch(async (err: unknown) => {
      const e = err as ErrorResponse;
      setError(e.response?.data?.message ?? errorMessages.updateStatus);
    });
  };

  const closePermissionsDialog = (): void => {
    setPermissionsDialogOpen(false);
    setEditingUser(null);
  };

  const filteredUsers = users.filter(
    u =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return {
    users,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    editingUser,
    permissionsDialogOpen,
    selectedPermissions,
    saving,
    filteredUsers,
    loadUsers,
    handleEditPermissions,
    handleSavePermissions,
    handleResetPermissions,
    handleTogglePermission,
    handleUpdateRole,
    handleToggleActive,
    closePermissionsDialog,
  };
}
