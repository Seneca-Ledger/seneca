/**
 * The bundled backgrounds: one muted series (cloud, fog, cold water), graded
 * alike — saturation down about a fifth and a faint warm tint — so the gallery
 * reads as a set. Louder frames (northern lights, sunsets, dusk) were taken out
 * of the list; their files stay so workspaces that already use them still show.
 */
export const AVAILABLE_BACKGROUNDS = [
  'ferdinand-stohr-W1FIkdPAB7E-unsplash.jpg',
  'michael-fousert-0962p7mcux4-unsplash.jpg',
  'valdemaras-d-khbjgGAerPU-unsplash.jpg',
  'vidar-nordli-mathisen-641pLhGEEyg-unsplash.jpg',
  'mikita-karasiou--67uQbVmZ-A-unsplash.jpg',
  'michael-fousert-lE5-z4nTCTQ-unsplash.jpg',
];

export const DEFAULT_BACKGROUND = 'vidar-nordli-mathisen-641pLhGEEyg-unsplash.jpg';

/** Stored in place of a file name: no photo, a flat warm surface instead. */
export const PLAIN_BACKGROUND = 'plain';

/** What each bundled photo shows, for its alt text. */
export const BACKGROUND_ALT: Record<string, string> = {
  'ferdinand-stohr-W1FIkdPAB7E-unsplash.jpg': 'Fjord between grey peaks under clouds',
  'michael-fousert-0962p7mcux4-unsplash.jpg': 'Farms on a green shore below misty mountains',
  'valdemaras-d-khbjgGAerPU-unsplash.jpg': 'Preikestolen cliff over a fjord in fog',
  'vidar-nordli-mathisen-641pLhGEEyg-unsplash.jpg': 'Mountains in clouds above a harbour',
  'mikita-karasiou--67uQbVmZ-A-unsplash.jpg': 'Snowy valley with a red cabin',
  'michael-fousert-lE5-z4nTCTQ-unsplash.jpg': 'Bergen waterfront under a grey sky',
};

/** "ferdinand-stohr-W1FIkdPAB7E-unsplash.jpg" → "Ferdinand Stohr · Unsplash". */
export function backgroundCredit(file: string): string | null {
  const match = /^(.+)-[A-Za-z0-9_-]{11}-unsplash\.\w+$/.exec(file);
  if (!match) {
    return null;
  }
  const name = match[1]
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return `${name} · Unsplash`;
}
