'use client';

import { Box } from '@mui/material';
import { apiBaseUrl } from '@/app/lib/api';
import type { MapStyle } from './map-style';

type MapStylePickerProps = {
  label: string;
  styles: MapStyle[];
  activeStyleId: string;
  accentColor: string;
  borderColor: string;
  onSelect: (styleId: string) => void;
};

// A low-zoom tile every style renders, so the thumbnails compare like for like.
const previewTileUrl = (styleId: string): string =>
  `${apiBaseUrl}/maps/tiles/${encodeURIComponent(styleId)}/2/2/1.png`;

export function MapStylePicker({
  label,
  styles,
  activeStyleId,
  accentColor,
  borderColor,
  onSelect,
}: MapStylePickerProps): React.JSX.Element | null {
  if (styles.length < 2) {
    return null;
  }

  return (
    <Box
      role="group"
      aria-label={label}
      sx={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 1000,
        display: 'flex',
        gap: 0.75,
        p: 0.75,
        bgcolor: 'background.paper',
        border: `1px solid ${borderColor}`,
        boxShadow: 1,
      }}
    >
      {styles.map(style => {
        const active = style.id === activeStyleId;
        return (
          <Box
            key={style.id}
            component="button"
            type="button"
            title={style.name}
            aria-label={style.name}
            aria-pressed={active}
            onClick={() => onSelect(style.id)}
            sx={{
              width: 44,
              height: 44,
              p: 0,
              cursor: 'pointer',
              overflow: 'hidden',
              bgcolor: 'transparent',
              border: `2px solid ${active ? accentColor : borderColor}`,
              '&:focus-visible': { outline: `2px solid ${accentColor}`, outlineOffset: 2 },
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: the tile sits behind the session cookie, which next/image's optimizer would not forward */}
            <img
              src={previewTileUrl(style.id)}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
