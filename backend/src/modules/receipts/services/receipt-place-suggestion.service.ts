import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Receipt, ReceiptLocationSource } from '../../../entities/receipt.entity';
import { GeocodingService, type NearbyPlace } from '../../geocoding/geocoding.service';
import { NEARBY_PLACE_TYPES } from '../../geocoding/nearby-place-types';

export type PlaceCandidate = NearbyPlace & { distanceM: number; matchesVendor: boolean };

export type PlaceSuggestions =
  | { needed: false }
  | {
      needed: true;
      receiptId: string;
      vendor: string | null;
      amount: number | null;
      currency: string | null;
      date: string | null;
      candidates: PlaceCandidate[];
    };

type Fix = { latitude: number; longitude: number; accuracy?: number };

const MIN_RADIUS_M = 150;
const MAX_RADIUS_M = 500;
const DEFAULT_RADIUS_M = 250;
const MAX_CANDIDATES = 8;
const PARALLEL_LOOKUPS = 8;
const EARTH_RADIUS_M = 6_371_000;
// The geocoder snaps the search centre to ~100 m for caching; pad the box so
// that shift cannot cut off places inside the radius.
const SNAP_PADDING_M = 80;

// The store is already known, or the user placed the point themselves.
const SETTLED_SOURCES = new Set<ReceiptLocationSource | null>([
  ReceiptLocationSource.MERCHANT_ADDRESS,
  ReceiptLocationSource.MANUAL,
  ReceiptLocationSource.PLACE,
]);

// Legal forms and words for "shop" say nothing about which shop it was.
const IGNORED_TOKENS = new Set([
  'ооо',
  'тоо',
  'ип',
  'ао',
  'зао',
  'оао',
  'llc',
  'ltd',
  'inc',
  'gmbh',
  'sarl',
  'sas',
  'sam',
  'srl',
  'spa',
  'the',
  'магазин',
  'супермаркет',
  'store',
  'shop',
  'market',
  'supermarket',
]);

/**
 * Shops near a GPS fix taken after the receipt was photographed without one:
 * the phone usually loses GPS indoors and gets it back outside the door.
 */
@Injectable()
export class ReceiptPlaceSuggestionService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    private readonly geocodingService: GeocodingService,
  ) {}

  /** Null when the statement has no receipt in this workspace. */
  async suggest(
    statementId: string,
    workspaceId: string,
    fix: Fix,
  ): Promise<PlaceSuggestions | null> {
    const receipt = await this.receiptRepository.findOne({
      where: { statementId, workspaceId },
      order: { createdAt: 'DESC' },
    });
    if (!receipt) {
      return null;
    }
    if (SETTLED_SOURCES.has(receipt.locationSource)) {
      return { needed: false };
    }

    const vendor = receipt.parsedData?.vendor?.trim() || null;
    const radiusM = this.radiusFor(fix.accuracy);
    const center = { lat: fix.latitude, lng: fix.longitude };

    const searches = [
      ...(vendor ? [{ name: vendor }] : []),
      ...NEARBY_PLACE_TYPES.map(placeType => ({ placeType })),
    ];
    const found: NearbyPlace[] = [];
    for (let i = 0; i < searches.length; i += PARALLEL_LOOKUPS) {
      const batch = searches.slice(i, i + PARALLEL_LOOKUPS);
      const results = await Promise.all(
        batch.map(search =>
          this.geocodingService.searchNearby({
            ...center,
            radiusM: radiusM + SNAP_PADDING_M,
            ...search,
          }),
        ),
      );
      found.push(...results.flat());
    }

    return {
      needed: true,
      receiptId: receipt.id,
      vendor,
      amount: receipt.parsedData?.amount ?? null,
      // OCR leaves empty strings for fields it could not read.
      currency: receipt.parsedData?.currency || null,
      date: receipt.parsedData?.date || null,
      candidates: this.rank(found, center, radiusM, vendor),
    };
  }

  private radiusFor(accuracy?: number): number {
    if (typeof accuracy !== 'number' || !Number.isFinite(accuracy)) {
      return DEFAULT_RADIUS_M;
    }
    return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(accuracy * 1.5)));
  }

  // A name that matches the receipt goes first, then the nearest. The padded
  // box reaches past the radius, so the far corners are cut here.
  private rank(
    places: NearbyPlace[],
    center: { lat: number; lng: number },
    radiusM: number,
    vendor: string | null,
  ): PlaceCandidate[] {
    // A town name in "Carrefour Monaco" would otherwise match every shop in Monaco.
    const localityTokens = new Set(places.flatMap(place => [...tokens(place.locality ?? '')]));
    const vendorTokens = new Set(
      [...tokens(vendor ?? '')].filter(token => !localityTokens.has(token)),
    );
    const unique = new Map<string, PlaceCandidate>();

    for (const place of places) {
      const key = `${place.osmType}:${place.osmId}`;
      if (unique.has(key)) {
        continue;
      }
      const distanceM = Math.round(distanceBetween(center, place));
      if (distanceM > radiusM) {
        continue;
      }
      const nameTokens = tokens(place.name);
      const matchesVendor = [...nameTokens].some(token => vendorTokens.has(token));
      unique.set(key, { ...place, distanceM, matchesVendor });
    }

    return [...unique.values()]
      .sort(
        (a, b) => Number(b.matchesVendor) - Number(a.matchesVendor) || a.distanceM - b.distanceM,
      )
      .slice(0, MAX_CANDIDATES);
  }
}

const tokens = (value: string): Set<string> =>
  new Set(
    value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(token => token.length >= 3 && !IGNORED_TOKENS.has(token)),
  );

const distanceBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};
