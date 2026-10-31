import { redirect } from 'next/navigation';

export default function WorkspaceSettingsRedirectPage() {
  redirect('/workspaces/overview');
}
