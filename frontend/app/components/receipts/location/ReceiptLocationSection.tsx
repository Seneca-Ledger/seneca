'use client';

import { Box, Typography } from '@mui/material';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { MapPin } from '@/app/components/icons';
import { DetailActionButton } from '@/app/components/ui/detail-action-button';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { type ReceiptLocationSource, type ReceiptRecord, receiptsApi } from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ReceiptRecordUpdate } from '@/app/lib/contracts';
import { tokens } from '@/lib/theme-tokens';
import { LazyReceiptLocationMap } from './LazyReceiptLocationMap';
import { MapStylePicker } from './MapStylePicker';
import { resolveMapStyleId } from './map-style';
import type { LatLng } from './ReceiptLocationMap';
import { useMapStylePreference } from './useMapStylePreference';
import { useMapStyles } from './useMapStyles';

type ThemeColors = typeof tokens.color | typeof tokens.dark.color;

type ReceiptLocationSectionProps = {
  receipt: ReceiptRecord;
  onReceiptChange: (next: ReceiptRecord) => void;
};

const MAP_HEIGHT = 280;

const formatPoint = ([lat, lng]: LatLng): string => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

const toSavedPoint = (receipt: ReceiptRecord): LatLng | null =>
  typeof receipt.locationLat === 'number' && typeof receipt.locationLng === 'number'
    ? [receipt.locationLat, receipt.locationLng]
    : null;

function LocationActions({
  hasDraft,
  isManual,
  saving,
  labels,
  onCancel,
  onSave,
  onReset,
}: {
  hasDraft: boolean;
  isManual: boolean;
  saving: boolean;
  labels: { cancel: string; save: string; reset: string };
  onCancel: () => void;
  onSave: () => void;
  onReset: () => void;
}): React.JSX.Element | null {
  const spinner = saving ? <Spinner className="size-[18px] mr-2" /> : null;

  if (hasDraft) {
    return (
      <>
        <DetailActionButton variant="ghost" type="button" onClick={onCancel} disabled={saving}>
          {labels.cancel}
        </DetailActionButton>
        <DetailActionButton variant="default" type="button" onClick={onSave} disabled={saving}>
          {spinner}
          {labels.save}
        </DetailActionButton>
      </>
    );
  }

  if (!isManual) {
    return null;
  }

  return (
    <DetailActionButton variant="ghost" type="button" onClick={onReset} disabled={saving}>
      {spinner}
      {labels.reset}
    </DetailActionButton>
  );
}

export function ReceiptLocationSection({
  receipt,
  onReceiptChange,
  flat = false,
}: ReceiptLocationSectionProps & {
  /** Part of another panel: a divider above instead of a card of its own. */
  flat?: boolean;
}): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const c = isDark ? tokens.dark.color : tokens.color;
  const t = useIntlayer('receiptLocation');
  const stylesQuery = useMapStyles();
  const { preference, setPreference } = useMapStylePreference();
  const [draft, setDraft] = useState<LatLng | null>(null);
  const [saving, setSaving] = useState(false);

  const position = draft ?? toSavedPoint(receipt);
  const styleId = resolveMapStyleId(stylesQuery.data, preference, isDark);
  const merchantAddress = receipt.parsedData?.merchantAddress;
  const placeName = receipt.locationSource === 'place' ? receipt.metadata?.place?.name : undefined;
  const detail = placeName ?? merchantAddress;

  const sourceLabels: Record<ReceiptLocationSource, string> = {
    merchant_address: t.sourceMerchantAddress.value,
    exif: t.sourceExif.value,
    device: t.sourceDevice.value,
    manual: t.sourceManual.value,
    fiscal_qr: t.sourceFiscalQr.value,
    place: t.sourcePlace.value,
  };

  const describeLocation = (): string => {
    if (draft !== null) {
      return t.unsavedPoint.value;
    }
    return receipt.locationSource ? sourceLabels[receipt.locationSource] : t.noLocation.value;
  };

  const applyUpdate = async (
    // The update answers the stored row without its display category: merged below.
    request: () => Promise<ReceiptRecordUpdate>,
    failure: string,
  ): Promise<void> => {
    setSaving(true);
    await (async () => {
      const next = await request();
      onReceiptChange({ ...receipt, ...next });
      setDraft(null);
    })()
      .catch(async (error: unknown) => {
        toast.error(getApiErrorMessage(error, failure));
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const handleSave = (): void => {
    if (draft) {
      const [latitude, longitude] = draft;
      void applyUpdate(
        () => receiptsApi.updateReceiptLocation(receipt.id, { latitude, longitude }),
        t.saveFailed.value,
      );
    }
  };

  const handleReset = (): void => {
    void applyUpdate(() => receiptsApi.resetReceiptLocation(receipt.id), t.resetFailed.value);
  };

  const renderMap = (): React.ReactNode => {
    if (stylesQuery.isPending) {
      return <Skeleton variant="rectangular" width="100%" height="100%" />;
    }
    // Unreachable in practice (mapMissing renders the one-line message instead); narrows the type.
    if (!styleId) {
      return null;
    }

    return (
      <>
        <LazyReceiptLocationMap
          position={position}
          styleId={styleId}
          markerColor={c.primary}
          onPick={setDraft}
        />
        <MapStylePicker
          label={t.mapStyle.value}
          styles={stylesQuery.data?.styles ?? []}
          activeStyleId={styleId}
          accentColor={c.primary}
          borderColor={c.ink150}
          onSelect={nextStyleId => void setPreference(nextStyleId)}
        />
      </>
    );
  };

  // No map to show (tiles not configured, or the style list failed): one line
  // instead of an empty map-sized box.
  const mapMissing = !(stylesQuery.isPending || styleId);
  const unavailableMessage = stylesQuery.isError
    ? t.mapUnavailable.value
    : t.tilesNotConfigured.value;

  // Inside another panel with no map to show, the whole block is one muted line:
  // where the receipt is from, with why there is no map in the tooltip.
  if (flat && mapMissing) {
    const place = merchantAddress || (position ? formatPoint(position) : describeLocation());
    return (
      <Box
        component="section"
        aria-label={t.title.value}
        title={unavailableMessage}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          borderTop: `1px solid ${c.ink150}`,
          pt: 1.5,
          fontSize: 13,
          color: c.ink500,
        }}
      >
        <MapPin size={15} aria-hidden style={{ flexShrink: 0 }} />
        <Box
          component="span"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {place}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      component="section"
      aria-labelledby="receipt-location-title"
      sx={
        flat
          ? { borderTop: `1px solid ${c.ink150}`, pt: 2.5 }
          : {
              border: `1px solid ${c.ink150}`,
              borderRadius: tokens.radius.lg,
              bgcolor: 'background.paper',
              p: 3,
            }
      }
    >
      <Box
        sx={{
          mb: 2,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            id="receipt-location-title"
            component="h2"
            style={{ fontSize: flat ? 14 : 18, fontWeight: 600, color: c.ink900 }}
          >
            {t.title.value}
          </Typography>
          <Typography style={{ marginTop: 4, fontSize: 14, color: c.ink500 }}>
            {describeLocation()}
            {detail ? ` · ${detail}` : ''}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <LocationActions
            hasDraft={draft !== null}
            isManual={receipt.locationSource === 'manual' || receipt.locationSource === 'place'}
            saving={saving}
            labels={{
              cancel: t.cancel.value,
              save: t.saveLocation.value,
              reset: t.resetToAutomatic.value,
            }}
            onCancel={() => setDraft(null)}
            onSave={handleSave}
            onReset={handleReset}
          />
        </Box>
      </Box>

      {mapMissing ? (
        <Typography style={{ fontSize: 13, color: c.ink500 }}>
          <span>{unavailableMessage}</span>
          {position ? <span> · {formatPoint(position)}</span> : null}
        </Typography>
      ) : (
        <Box
          sx={{
            position: 'relative',
            height: MAP_HEIGHT,
            overflow: 'hidden',
            border: `1px solid ${c.ink150}`,
            borderRadius: tokens.radius.md,
            // Leaflet stacks its panes up to z-index 1000; keep them inside this box.
            isolation: 'isolate',
          }}
        >
          {renderMap()}
        </Box>
      )}

      {mapMissing ? null : (
        <Typography style={{ marginTop: 8, fontSize: 13, color: c.ink500 }}>
          {position ? `${formatPoint(position)} · ${t.moveHint.value}` : t.placeHint.value}
        </Typography>
      )}
    </Box>
  );
}
