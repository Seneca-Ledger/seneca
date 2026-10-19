import exifr from 'exifr';
import { isValidCoordinatePair, roundCoordinate } from './capture-location.util';

/**
 * GPS tag of a photo, if the camera wrote one. Mobile browsers usually strip it
 * from camera captures, so a miss is the normal case, not an error.
 */
export const readExifGps = async (buffer: Buffer): Promise<{ lat: number; lng: number } | null> => {
  try {
    const gps = await exifr.gps(buffer);
    if (!(gps && isValidCoordinatePair(gps.latitude, gps.longitude))) {
      return null;
    }

    // Cameras without a fix write zeros rather than omitting the tag.
    if (gps.latitude === 0 && gps.longitude === 0) {
      return null;
    }

    return { lat: roundCoordinate(gps.latitude), lng: roundCoordinate(gps.longitude) };
  } catch {
    return null;
  }
};
