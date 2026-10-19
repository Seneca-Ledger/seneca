'use client';

import { Box, Typography } from '@mui/material';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { LazyReceiptLocationMap } from '@/app/components/receipts/location/LazyReceiptLocationMap';
import { resolveMapStyleId } from '@/app/components/receipts/location/map-style';
import { useMapStylePreference } from '@/app/components/receipts/location/useMapStylePreference';
import { useMapStyles } from '@/app/components/receipts/location/useMapStyles';
import { DetailActionButton } from '@/app/components/ui/detail-action-button';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { type PlaceCandidate, receiptsApi } from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { tokens } from '@/lib/theme-tokens';
import type { PlaceQuestion } from './useReceiptPlaceFollowup';

const MAP_HEIGHT = 200;
const noop = (): void => undefined;

const candidateKey = (candidate: PlaceCandidate): string =>
  `${candidate.osmType}:${candidate.osmId}`;

type ReceiptPlacePickerDrawerProps = {
  open: boolean;
  question: PlaceQuestion;
  summary: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ReceiptPlacePickerDrawer({
  open,
  question,
  summary,
  onClose,
  onSaved,
}: ReceiptPlacePickerDrawerProps): React.JSX.Element {
  const t = useIntlayer('receiptPlaceFollowup');
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const c = isDark ? tokens.dark.color : tokens.color;
  const stylesQuery = useMapStyles();
  const { preference } = useMapStylePreference();
  const styleId = resolveMapStyleId(stylesQuery.data, preference, isDark);

  const { candidates, receiptId } = question.suggestions;
  const [selectedKey, setSelectedKey] = useState(() =>
    candidates[0] ? candidateKey(candidates[0]) : null,
  );
  const [saving, setSaving] = useState(false);
  const selected = candidates.find(candidate => candidateKey(candidate) === selectedKey) ?? null;

  const handleSave = async (): Promise<void> => {
    if (!selected) {
      return;
    }
    setSaving(true);
    try {
      await receiptsApi.updateReceiptLocation(receiptId, {
        latitude: selected.lat,
        longitude: selected.lng,
        place: {
          name: selected.name,
          category: selected.category || null,
          osmType: selected.osmType,
          osmId: selected.osmId,
        },
      });
      toast.success(t.saved.value);
      onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t.saveFailed.value));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DrawerShell isOpen={open} onClose={onClose} title={t.drawerTitle.value} width="md">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, flex: 1 }}>
        <Box>
          {summary ? (
            <Typography style={{ fontSize: 14, fontWeight: 600, color: c.ink900 }}>
              {summary}
            </Typography>
          ) : null}
          <Typography style={{ marginTop: 4, fontSize: 13, color: c.ink500 }}>
            {t.drawerHint.value}
          </Typography>
        </Box>

        {styleId && selected ? (
          <Box
            sx={{
              position: 'relative',
              height: MAP_HEIGHT,
              flexShrink: 0,
              overflow: 'hidden',
              border: `1px solid ${c.ink150}`,
              // Leaflet stacks its panes up to z-index 1000; keep them inside this box.
              isolation: 'isolate',
            }}
          >
            <LazyReceiptLocationMap
              position={[selected.lat, selected.lng]}
              styleId={styleId}
              markerColor={c.primary}
              onPick={noop}
            />
          </Box>
        ) : null}

        <Box
          role="radiogroup"
          aria-label={t.placesNearby.value}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', minHeight: 0 }}
        >
          {candidates.map(candidate => {
            const key = candidateKey(candidate);
            const checked = key === selectedKey;
            const details = [candidate.address, candidate.locality].filter(Boolean).join(', ');
            return (
              <Box
                key={key}
                component="button"
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setSelectedKey(key)}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 2,
                  width: '100%',
                  textAlign: 'start',
                  cursor: 'pointer',
                  p: 1.5,
                  bgcolor: checked ? 'action.selected' : 'background.paper',
                  color: 'inherit',
                  border: `1px solid ${checked ? c.primary : c.ink150}`,
                  font: 'inherit',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 2 },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography style={{ fontSize: 14, fontWeight: 600, color: c.ink900 }}>
                    {candidate.name}
                  </Typography>
                  {details ? (
                    <Typography style={{ fontSize: 13, color: c.ink500 }}>{details}</Typography>
                  ) : null}
                  {candidate.matchesVendor ? (
                    <Typography
                      style={{ marginTop: 2, fontSize: 12, fontWeight: 600, color: c.primary }}
                    >
                      {t.matchesReceipt.value}
                    </Typography>
                  ) : null}
                </Box>
                <Typography style={{ flexShrink: 0, fontSize: 13, color: c.ink500 }}>
                  {candidate.distanceM} {t.metres.value}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <DetailActionButton
            variant="default"
            type="button"
            onClick={() => void handleSave()}
            disabled={!selected || saving}
          >
            {saving ? <Spinner className="size-[18px] mr-2" /> : null}
            {t.save.value}
          </DetailActionButton>
          <Link
            href={`/storage/receipts/${receiptId}`}
            onClick={onClose}
            style={{ fontSize: 14, color: c.primary, textAlign: 'center' }}
          >
            {t.notInList.value}
          </Link>
        </Box>
      </Box>
    </DrawerShell>
  );
}
