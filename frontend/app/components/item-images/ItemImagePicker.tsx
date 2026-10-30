'use client';

import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { FULL_SCREEN_ON_PHONE, ModalShell } from '@/app/components/ui/modal-shell';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer, useLocale } from '@/app/i18n';
import { apiBaseUrl } from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { itemSearchTerm } from './item-kind';
import { type ItemSubject, useItemImageMutations } from './useItemImage';

interface ItemImagePickerProps {
  subject: ItemSubject;
  id: string;
  name: string;
  hasImage: boolean;
  onClose: () => void;
}

/** Wikidata takes a bare language code; "pt-BR" asks as "pt". */
const languageOf = (locale: string): string => locale.toLowerCase().split(/[-_]/)[0];

/**
 * Pictures of what a row was for, found on Wikidata. Opening it is the
 * person's go-ahead: the search runs once with the words of the note (the sale
 * verb dropped), and only those words leave the server.
 */
export function ItemImagePicker({ subject, id, name, hasImage, onClose }: ItemImagePickerProps) {
  const t = useIntlayer('itemImages');
  const { locale } = useLocale();
  const lang = languageOf(String(locale));
  const [term, setTerm] = useState(() => itemSearchTerm(name) || name);
  const [query, setQuery] = useState(term.trim());
  const { set, remove } = useItemImageMutations(subject, id);
  const [picking, setPicking] = useState<string | null>(null);

  const search = useQuery({
    queryKey: ['item-image-search', lang, query.toLowerCase()],
    queryFn: () =>
      apiQueryDecoded({
        url: '/item-images/search',
        params: { q: query, lang } satisfies ContractInput<'ItemImageSearchQuery'>,
        contract: 'ItemImageSearchResults',
      }),
    enabled: query.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  const pick = (wikidataId: string) => {
    setPicking(wikidataId);
    set.mutate({ wikidataId, lang }, { onSuccess: onClose, onSettled: () => setPicking(null) });
  };

  const results = search.data?.results ?? [];
  const failure = search.error ?? set.error ?? remove.error;

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={<span className="seneca-item-picker__title">{t.title}</span>}
      size="sm"
      paperSx={FULL_SCREEN_ON_PHONE}
    >
      <form
        className="seneca-item-picker__search"
        onSubmit={event => {
          event.preventDefault();
          setQuery(term.trim());
        }}
      >
        <TextField
          size="small"
          fullWidth
          value={term}
          placeholder={t.searchPlaceholder.value}
          onChange={event => setTerm(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 100, 'aria-label': t.searchPlaceholder.value } }}
        />
        <Button type="submit" variant="outline" disabled={!term.trim() || search.isFetching}>
          <Search size={18} />
          {t.search}
        </Button>
      </form>
      <p className="seneca-item-picker__note">{t.privacyNote}</p>

      {failure ? (
        <p className="seneca-item-picker__message" role="alert">
          {getApiErrorMessage(failure)}
        </p>
      ) : null}

      <div className="seneca-item-picker__grid">
        {search.isFetching
          ? Array.from({ length: 6 }).map((_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed skeleton grid
              <Skeleton key={index} variant="rounded" className="seneca-item-picker__skeleton" />
            ))
          : results.map(result => (
              <button
                key={result.id}
                type="button"
                className="seneca-item-picker__tile"
                disabled={picking !== null}
                onClick={() => pick(result.id)}
                title={result.description ?? result.label}
              >
                <span className="seneca-item-picker__image">
                  <img src={`${apiBaseUrl}/item-images/preview/${result.id}`} alt="" />
                  {picking === result.id && (
                    <Spinner size={20} className="seneca-item-picker__saving" />
                  )}
                </span>
                <span className="seneca-item-picker__label">{result.label}</span>
                {result.description && (
                  <span className="seneca-item-picker__description">{result.description}</span>
                )}
              </button>
            ))}
      </div>

      {search.isSuccess && !search.isFetching && results.length === 0 && (
        <p className="seneca-item-picker__message">{t.noResults}</p>
      )}

      <div className="seneca-item-picker__footer">
        <span className="seneca-item-picker__credit">{t.credit}</span>
        {hasImage && (
          <Button
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => remove.mutate(undefined, { onSuccess: onClose })}
          >
            {t.remove}
          </Button>
        )}
      </div>
    </ModalShell>
  );
}
