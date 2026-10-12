'use client';

import apiClient from '@/app/lib/api';
import { pickDriveFiles } from '@/app/lib/googleDrivePicker';
import type { StorageWidgetProvider } from '@/app/lib/storage-widget-types';
import { BaseStorageWidget } from './BaseStorageWidget';

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY || '';

const googleDriveProvider: StorageWidgetProvider = {
  apiPath: 'google-drive',
  logoSrc: '/icons/google-drive-icon.png',
  logoAlt: 'Google Drive',
  settingsHref: '/integrations/google-drive',
  providerName: 'Google Drive',
  getTranslations: t => t.driveSync,
  isPickerAvailable: () => Boolean(apiKey),
  openPicker: async mimeTypes => {
    const tokenResp = await apiClient.get('/integrations/google-drive/picker-token');
    // Unchecked on purpose: Gmail, Google Drive and Dropbox are going away, so they get no contract.
    const accessToken = (tokenResp.data as { accessToken?: string } | null)?.accessToken;
    if (!accessToken) {
      throw new Error('Google Drive picker token unavailable');
    }
    return pickDriveFiles({ accessToken, apiKey, mimeTypes });
  },
  getDocName: doc => doc.name || doc.title || '',
};

export function GoogleDriveStorageWidget({ locale }: { locale?: string }) {
  return <BaseStorageWidget provider={googleDriveProvider} locale={locale} />;
}
