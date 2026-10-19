'use client';

import WorkspacePayeesView from '../components/WorkspacePayeesView';
import WorkspaceTabShell from '../components/WorkspaceTabShell';

export default function WorkspacePayeesPage() {
  return (
    <WorkspaceTabShell activeItem="payees">
      <WorkspacePayeesView />
    </WorkspaceTabShell>
  );
}
