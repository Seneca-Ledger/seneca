import { hasSessionCookie } from '@/app/lib/csrf';
import { getWorkspaceHeaders } from '@/app/lib/workspace-headers';

/** Saves the file behind `endpoint` under `fileName`; `onError` gets the message to show. */
export async function downloadFile(
  endpoint: string,
  fileName: string,
  messages: { authRequired: string; failed: string },
  onError: (message: string) => void,
): Promise<void> {
  if (!hasSessionCookie()) {
    onError(messages.authRequired);
    return;
  }
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: getWorkspaceHeaders(),
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error downloading PDF:', err);
    onError(messages.failed);
  }
}
