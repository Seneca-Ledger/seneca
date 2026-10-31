'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { getWorkspacesRootRedirectPath } from '@/app/lib/workspace-tabs';
import WorkspaceTabShell from './components/WorkspaceTabShell';

export default function WorkspacesPage() {
  const router = useRouter();
  const { currentWorkspace, loading } = useWorkspace();

  useEffect(() => {
    if (loading) {
      return;
    }
    router.replace(getWorkspacesRootRedirectPath(Boolean(currentWorkspace)));
  }, [currentWorkspace, loading, router]);

  // Most visits land on Overview: show its frame until the redirect.
  return loading ? <WorkspaceTabShell activeItem="overview">{null}</WorkspaceTabShell> : null;
}
