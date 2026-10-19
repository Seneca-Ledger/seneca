/**
 * Пресеты заливки для колонок и опций. Цвет хранится как #rrggbbaa с
 * небольшой прозрачностью: так тон ложится и на светлую, и на тёмную тему,
 * а текст ячейки остаётся штатным и читаемым.
 */
export interface ColorPreset {
  id: string;
  /** Насыщенный базовый цвет — для чипов и рамок. */
  base: string;
  /** Полупрозрачная заливка для td/th. */
  fill: string;
}

/** 0x2e ≈ 18% непрозрачности. */
export const FILL_ALPHA_HEX = '2e';

export const withFillAlpha = (hex: string): string => `${hex.slice(0, 7)}${FILL_ALPHA_HEX}`;

const BASES: Array<[string, string]> = [
  ['red', '#ef4444'],
  ['orange', '#f97316'],
  ['amber', '#f59e0b'],
  ['green', '#22c55e'],
  ['teal', '#14b8a6'],
  ['blue', '#3b82f6'],
  ['violet', '#8b5cf6'],
  ['gray', '#6b7280'],
];

export const COLOR_PRESETS: ColorPreset[] = BASES.map(([id, base]) => ({
  id,
  base,
  fill: withFillAlpha(base),
}));
