import type { SystemCategoryKey } from '../../categories/system-categories';

/**
 * Which default category a brand's OSM tag means. NSI files every brand under
 * one tag (`brands/shop/supermarket`), which is already a taxonomy, so a
 * known brand needs no guess beyond this table. Tags left out (banks, ATMs,
 * insurers, estate agents, post offices, hairdressers, government) name no
 * spending category of ours, and a brand there suggests nothing.
 *
 * Used when the brand index is built (scripts/build-brand-index.ts); the
 * index stores the resolved key.
 */
const BY_TAG: Record<string, Record<string, SystemCategoryKey>> = {
  shop: {
    ...fill('groceries', [
      'supermarket',
      'convenience',
      'grocery',
      'greengrocer',
      'butcher',
      'bakery',
      'pastry',
      'deli',
      'frozen_food',
      'health_food',
      'organic',
      'seafood',
      'cheese',
      'dairy',
      'confectionery',
      'beverages',
      'alcohol',
      'wine',
      'coffee',
      'tea',
    ]),
    ...fill('phone_internet', ['mobile_phone', 'telecommunication']),
    ...fill('health', ['optician', 'hearing_aids', 'medical_supply']),
    ...fill('vehicle', ['car_repair', 'tyres', 'car_parts', 'car', 'motorcycle']),
    ...fill('travel', ['travel_agency']),
    ...fill('shopping', [
      'clothes',
      'shoes',
      'department_store',
      'electronics',
      'furniture',
      'doityourself',
      'hardware',
      'sports',
      'toys',
      'books',
      'variety_store',
      'jewelry',
      'cosmetics',
      'houseware',
      'gift',
      'chemist',
      'bag',
      'boutique',
      'computer',
      'appliance',
      'garden_centre',
      'pet',
      'stationery',
      'outdoor',
      'bed',
      'bicycle',
      'fabric',
      'florist',
      'kitchen',
      'interior_decoration',
      'mall',
      'music',
      'video_games',
      'perfumery',
      'watches',
      'second_hand',
      'baby_goods',
      'craft',
      'lighting',
      'paint',
    ]),
  },
  amenity: {
    ...fill('dining', [
      'restaurant',
      'fast_food',
      'cafe',
      'bar',
      'pub',
      'food_court',
      'ice_cream',
      'biergarten',
    ]),
    // Charging networks are often power companies: their name is on the electricity bill too.
    ...fill('fuel', ['fuel']),
    ...fill('transport', ['car_rental', 'taxi', 'bicycle_rental', 'car_sharing', 'parking']),
    ...fill('health', ['pharmacy', 'clinic', 'dentist', 'doctors', 'hospital']),
    ...fill('vehicle', ['car_wash']),
  },
  healthcare: fill('health', ['laboratory', 'clinic', 'pharmacy', 'dentist', 'optometrist']),
  tourism: fill('travel', ['hotel', 'motel', 'hostel', 'guest_house']),
  office: fill('phone_internet', ['telecommunication']),
};

function fill(
  key: SystemCategoryKey,
  values: readonly string[],
): Record<string, SystemCategoryKey> {
  return Object.fromEntries(values.map(value => [value, key]));
}

/**
 * Which facet of a brand is the one people pay at, when NSI lists it under
 * several: Tesco is a supermarket that also runs petrol stations, Shell a
 * petrol station with a shop, IKEA a furniture store with a restaurant.
 * Lower wins; facets not listed rank last.
 */
const FACET_RANK: readonly string[] = [
  'shop/supermarket',
  'amenity/fuel',
  'shop/department_store',
  'shop/furniture',
  'shop/clothes',
  'shop/electronics',
  'shop/doityourself',
  'shop/shoes',
  'shop/sports',
  'amenity/restaurant',
  'amenity/fast_food',
  'amenity/cafe',
  'amenity/pharmacy',
  'shop/mobile_phone',
  'shop/telecommunication',
];

/** The rank of a brand path's facet; see FACET_RANK. */
export function facetRank(path: string): number {
  const facet = path.split('/').slice(1, 3).join('/');
  const rank = FACET_RANK.indexOf(facet);
  return rank === -1 ? FACET_RANK.length : rank;
}

/** The category for an NSI brand path such as `brands/shop/supermarket`; null when none fits. */
export function categoryForBrandPath(path: string): SystemCategoryKey | null {
  const [tree, key, value] = path.split('/');
  if (tree !== 'brands' || !key || !value) {
    return null;
  }
  return BY_TAG[key]?.[value] ?? null;
}
