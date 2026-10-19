export type MapStyle = {
  id: string;
  name: string;
};

export type MapStylesResponse = {
  styles: MapStyle[];
  defaultStyleId: string | null;
};

// Styles readable on a dark page. Only used until the user picks one.
const DARK_STYLE_IDS = ['dark-matter'];

/**
 * The user's pick wins while the tile server still offers it; otherwise a dark
 * style follows a dark theme, and the server default covers the rest.
 */
export const resolveMapStyleId = (
  config: MapStylesResponse | undefined,
  preference: string | null | undefined,
  isDark: boolean,
): string | null => {
  const styles = config?.styles ?? [];
  if (preference && styles.some(style => style.id === preference)) {
    return preference;
  }

  if (isDark) {
    const darkStyle = styles.find(style => DARK_STYLE_IDS.includes(style.id));
    if (darkStyle) {
      return darkStyle.id;
    }
  }

  return config?.defaultStyleId ?? styles[0]?.id ?? null;
};
