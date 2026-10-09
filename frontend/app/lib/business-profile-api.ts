import apiClient from '@/app/lib/api';

/** The issuer's side of every document the workspace sends. */
export interface BusinessProfile {
  legalName: string | null;
  registrationId: string | null;
  taxId: string | null;
  addressLines: string | null;
  countryCode: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankCode: string | null;
  paymentInstructions: string | null;
  invoiceFooter: string | null;
  logoFile: string | null;
  /** Fields an invoice cannot be sent without that are still empty. */
  missingRequired: string[];
}

export type BusinessProfileInput = Partial<Omit<BusinessProfile, 'logoFile' | 'missingRequired'>>;

export const businessProfileApi = {
  async get(): Promise<BusinessProfile> {
    const { data } = await apiClient.get<BusinessProfile>('/business-profile');
    return data;
  },

  async update(input: BusinessProfileInput): Promise<BusinessProfile> {
    const { data } = await apiClient.put<BusinessProfile>('/business-profile', input);
    return data;
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
