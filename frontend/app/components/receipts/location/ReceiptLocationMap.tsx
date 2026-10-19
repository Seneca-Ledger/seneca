'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { apiBaseUrl } from '@/app/lib/api';

export type LatLng = [number, number];

type ReceiptLocationMapProps = {
  position: LatLng | null;
  styleId: string;
  markerColor: string;
  onPick: (point: LatLng) => void;
};

const WORLD_CENTER: LatLng = [20, 0];
const WORLD_ZOOM = 2;
const POINT_ZOOM = 16;
const TILE_ATTRIBUTION =
  '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

export const buildTileUrl = (styleId: string): string =>
  `${apiBaseUrl}/maps/tiles/${encodeURIComponent(styleId)}/{z}/{x}/{y}.png`;

// Inline SVG pin: Leaflet's default marker images resolve to broken URLs once bundled.
const buildPinIcon = (color: string): L.DivIcon =>
  L.divIcon({
    className: '',
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 40 14 40s14-15.7 14-26.1C28 6.2 21.7 0 14 0z" fill="${color}"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
  });

/**
 * Leaflet driven directly rather than through react-leaflet, whose Hippocratic
 * licence is outside the project's licence allowlist. The map is created once;
 * the tile layer, the view and the marker follow the props.
 */
export function ReceiptLocationMap({
  position,
  styleId,
  markerColor,
  onPick,
}: ReceiptLocationMapProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  // Leaflet handlers are bound once, so they read the latest callback through a ref.
  const onPickRef = useRef(onPick);
  const lat = position?.[0] ?? null;
  const lng = position?.[1] ?? null;

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const map = L.map(container, { scrollWheelZoom: false }).setView(WORLD_CENTER, WORLD_ZOOM);
    map.on('click', (event: L.LeafletMouseEvent) => {
      onPickRef.current([event.latlng.lat, event.latlng.lng]);
    });
    mapRef.current = map;
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const layer = L.tileLayer(buildTileUrl(styleId), {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);
    return () => {
      layer.remove();
    };
  }, [styleId]);

  // Follows the point when it changes from outside (saved, reset, first click).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat === null || lng === null) {
      return;
    }
    map.setView([lat, lng], Math.max(map.getZoom(), POINT_ZOOM));
  }, [lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat === null || lng === null) {
      return;
    }
    const marker = L.marker([lat, lng], {
      draggable: true,
      icon: buildPinIcon(markerColor),
    }).addTo(map);
    marker.on('dragend', () => {
      const point = marker.getLatLng();
      onPickRef.current([point.lat, point.lng]);
    });
    return () => {
      marker.remove();
    };
  }, [lat, lng, markerColor]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
