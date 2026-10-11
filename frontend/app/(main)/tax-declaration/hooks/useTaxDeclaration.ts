'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { saveBlob } from '@/app/(main)/reports/components/tax-return.helpers';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { getApiErrorStatus } from '@/app/lib/api-error';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import { exportFileName } from '../tax-declaration.helpers';
import type {
  IncomeTaxDraft,
  IncomeTaxProfile,
  MappingEntry,
  MappingsResponse,
  TaxDisclaimerStatus,
  TaxpayerType,
} from '../tax-declaration.types';

/** 403 is worth its own message: the user can do nothing about it but ask an owner. */
export type ActionError = 'forbidden' | 'failed' | null;

export function toActionError(error: unknown): ActionError {
  if (!error) return null;
  return getApiErrorStatus(error) === 403 ? 'forbidden' : 'failed';
}

export function useTaxDeclaration(taxYear: number) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  // Every part of the declaration depends on the others (profile → form →
  // mappings → draft), so any change refreshes all of them.
  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: ['income-tax', workspaceId] });

  const disclaimer = useQuery({
    queryKey: queryKeys.incomeTaxDisclaimer(workspaceId),
    queryFn: ({ signal }) =>
      apiQuery<TaxDisclaimerStatus>({ url: '/income-tax/disclaimer', signal }),
  });

  const acceptDisclaimer = useMutation({
    mutationFn: () => apiClient.post('/income-tax/disclaimer'),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.incomeTaxDisclaimer(workspaceId) }),
  });

  const accepted = disclaimer.data?.accepted === true;

  const profile = useQuery({
    queryKey: queryKeys.incomeTaxProfile({ workspaceId, taxYear }),
    queryFn: ({ signal }) =>
      apiQuery<IncomeTaxProfile>({ url: '/income-tax/profile', params: { taxYear }, signal }),
    enabled: accepted,
  });

  // Without a tax country there is no form to map to or draft to build.
  const hasCountry = Boolean(profile.data?.country);

  const mappings = useQuery({
    queryKey: queryKeys.incomeTaxMappings({ workspaceId, taxYear }),
    queryFn: ({ signal }) =>
      apiQuery<MappingsResponse>({ url: '/income-tax/mappings', params: { taxYear }, signal }),
    enabled: accepted && hasCountry,
  });

  const draft = useQuery({
    queryKey: queryKeys.incomeTaxDraft({ workspaceId, taxYear }),
    queryFn: ({ signal }) =>
      apiQuery<IncomeTaxDraft>({ url: `/income-tax/returns/${taxYear}`, signal }),
    enabled: accepted && hasCountry,
  });

  const saveProfile = useMutation({
    mutationFn: (body: { taxpayerType: TaxpayerType; details: Record<string, unknown> }) =>
      apiClient.put('/income-tax/profile', { taxYear, ...body }),
    onSuccess: invalidateAll,
  });

  const saveMappings = useMutation({
    mutationFn: (entries: MappingEntry[]) =>
      apiClient.put('/income-tax/mappings', { taxYear, entries }),
    onSuccess: invalidateAll,
  });

  const finalize = useMutation({
    mutationFn: () => apiClient.post(`/income-tax/returns/${taxYear}/finalize`),
    onSuccess: invalidateAll,
  });

  const reopen = useMutation({
    mutationFn: () => apiClient.post(`/income-tax/returns/${taxYear}/reopen`),
    onSuccess: invalidateAll,
  });

  const download = useMutation({
    mutationFn: async (format: 'pdf' | 'xlsx' | 'csv') => {
      const response = await apiClient.get(`/income-tax/returns/${taxYear}/export`, {
        params: { format },
        responseType: 'blob',
      });
      saveBlob(
        response.data as Blob,
        exportFileName(profile.data?.country?.code ?? 'xx', taxYear, format),
      );
    },
  });

  const mutationError = [saveProfile, saveMappings, finalize, reopen, download].find(
    mutation => mutation.isError,
  )?.error;

  return {
    disclaimer,
    acceptDisclaimer,
    profile,
    mappings,
    draft,
    saveProfile,
    saveMappings,
    finalize,
    reopen,
    download,
    actionError: toActionError(mutationError),
  };
}
