'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient, { apiBaseUrl } from '@/app/lib/api';
import type { ItemImage, ItemVendor } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

export type ItemSubject = 'transaction' | 'payable';

/** The API serves /uploads as static files, one level above its /api/v1 base. */
const uploadsOrigin = apiBaseUrl.replace(/\/api\/v1$/, '');

/** Where the browser loads a stored picture from. */
export const itemImageSrc = (image: ItemImage): string => `${uploadsOrigin}${image.url}`;

const PATH: Record<ItemSubject, string> = {
  transaction: '/item-images/transactions',
  payable: '/item-images/payables',
};

/**
 * What stands for a row: its own picture; for a transaction that paid a
 * subscription, the vendor; and the kind of thing its note names, for an icon.
 */
export type ItemVisual = {
  image: ItemImage | null;
  vendor: ItemVendor | null;
  kind: string | null;
};

type Waiter = { resolve: (visual: ItemVisual) => void; reject: (error: unknown) => void };

/**
 * Rows ask one by one; the server is asked once per list. Every row that
 * renders in the same tick joins one request for its kind.
 */
const pending: Record<ItemSubject, Map<string, Waiter[]>> = {
  transaction: new Map(),
  payable: new Map(),
};

function flush(subject: ItemSubject): void {
  const batch = pending[subject];
  pending[subject] = new Map();
  const ids = [...batch.keys()];
  apiQueryDecoded({
    url: PATH[subject],
    params: { ids: ids.join(',') } satisfies ContractInput<'ItemImageIdsQuery'>,
    contract: 'ItemImageList',
  }).then(
    ({ images, vendors = [], kinds = [] }) => {
      const imageOf = new Map(images.map(image => [image.subjectId, image]));
      const vendorOf = new Map(vendors.map(vendor => [vendor.subjectId, vendor]));
      const kindOf = new Map(kinds.map(item => [item.subjectId, item.kind]));
      for (const [id, waiters] of batch) {
        const visual = {
          image: imageOf.get(id) ?? null,
          vendor: vendorOf.get(id) ?? null,
          kind: kindOf.get(id) ?? null,
        };
        for (const waiter of waiters) {
          waiter.resolve(visual);
        }
      }
    },
    error => {
      for (const waiters of batch.values()) {
        for (const waiter of waiters) {
          waiter.reject(error);
        }
      }
    },
  );
}

function load(subject: ItemSubject, id: string): Promise<ItemVisual> {
  return new Promise((resolve, reject) => {
    const batch = pending[subject];
    if (batch.size === 0) {
      setTimeout(() => flush(subject), 0);
    }
    batch.set(id, [...(batch.get(id) ?? []), { resolve, reject }]);
  });
}

const itemImageKey = (workspaceId: string | null, subject: ItemSubject, id: string) =>
  ['item-images', workspaceId, subject, id] as const;

/** A row's picture and vendor, each null when it has none; they change rarely, so they are kept a while. */
export function useItemVisual(subject: ItemSubject, id: string) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: itemImageKey(workspaceId, subject, id),
    queryFn: () => load(subject, id),
    enabled: Boolean(workspaceId && id),
    staleTime: 5 * 60 * 1000,
  });
}

/** The stored picture of a row, or null. */
export function useItemImage(
  subject: ItemSubject,
  id: string,
): { data: ItemImage | null | undefined } {
  const { data } = useItemVisual(subject, id);
  return { data: data?.image };
}

/** Sets or removes a row's picture; a bill and its payment share theirs, so all are refetched. */
export function useItemImageMutations(subject: ItemSubject, id: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['item-images'] });
  const set = useMutation({
    mutationFn: async ({ wikidataId, lang }: { wikidataId: string; lang: string }) => {
      const response = await apiClient.put(`${PATH[subject]}/${id}`, {
        wikidataId,
        lang,
      } satisfies ContractInput<'SetItemImageBody'>);
      return checkContract('ItemImage', response.data, PATH[subject]);
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`${PATH[subject]}/${id}`);
    },
    onSuccess: refresh,
  });
  return { set, remove };
}
