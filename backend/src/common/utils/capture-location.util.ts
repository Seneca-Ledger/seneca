export type CaptureLocation = {
  lat: number;
  lng: number;
  accuracyM?: number;
};

/** ~1 m. More digits add nothing for a receipt and only sharpen a user's position. */
export const roundCoordinate = (value: number): number => Math.round(value * 1e5) / 1e5;

export const isValidCoordinatePair = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

/**
 * Multipart fields arrive one by one, so a client can send a latitude without a
 * longitude. That is not worth a cross-field validator: half a point is simply
 * no point.
 */
export const toCaptureLocation = (input?: {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}): CaptureLocation | undefined => {
  if (!(input && isValidCoordinatePair(input.latitude, input.longitude))) {
    return undefined;
  }

  const location: CaptureLocation = {
    lat: roundCoordinate(input.latitude as number),
    lng: roundCoordinate(input.longitude as number),
  };
  if (typeof input.accuracy === 'number' && Number.isFinite(input.accuracy)) {
    location.accuracyM = Math.round(input.accuracy);
  }
  return location;
};
