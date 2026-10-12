import apiClient from '@/app/lib/api';
import type { BusinessProfileResponse } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

/**
 * The issuer's side of every document the workspace sends. Until the profile
 * is first saved its fields are absent rather than null.
 */
export type BusinessProfile = BusinessProfileResponse;

export type BusinessProfileInput = Partial<Omit<BusinessProfile, 'logoFile' | 'missingRequired'>>;

export const businessProfileApi = {
  async get(): Promise<BusinessProfile> {
    return apiQueryDecoded({ url: '/business-profile', contract: 'BusinessProfileResponse' });
  },

  async update(input: BusinessProfileInput): Promise<BusinessProfile> {
    const { data } = await apiClient.put(
      '/business-profile',
      input satisfies ContractInput<'UpdateBusinessProfileBody'>,
    );
    return checkContract('BusinessProfileResponse', data, '/business-profile');
  },

  async uploadLogo(file: File): Promise<{ logoFile: string; logoUrl: string }> {
    const body = new FormData();
    body.append('logo', file);
    const { data } = await apiClient.post<{ logoFile: string; logoUrl: string }>(
      '/business-profile/logo',
      body,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  async removeLogo(): Promise<void> {
    await apiClient.delete('/business-profile/logo');
  },
};

/** Where the `<img>` tag reads a stored logo from. */
export function businessLogoUrl(logoFile: string | null | undefined): string | null {
  return logoFile ? `/api/v1/business-profile/logo/${encodeURIComponent(logoFile)}` : null;
}
