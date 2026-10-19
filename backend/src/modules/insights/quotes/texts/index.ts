import { be } from './be';
import { bg } from './bg';
import { bs } from './bs';
import { cs } from './cs';
import { da } from './da';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fi } from './fi';
import { fo } from './fo';
import { fr } from './fr';
import { hi } from './hi';
import { hr } from './hr';
import { hsb } from './hsb';
import { id } from './id';
import { is } from './is';
import { it } from './it';
import { ja } from './ja';
import { kk } from './kk';
import { ko } from './ko';
import { mk } from './mk';
import { nb } from './nb';
import { nl } from './nl';
import { nn } from './nn';
import { pl } from './pl';
import { pt } from './pt';
import { ru } from './ru';
import { sk } from './sk';
import { sl } from './sl';
import { sr } from './sr';
import { sv } from './sv';
import { tr } from './tr';
import type { QuoteTexts } from './types';
import { uk } from './uk';
import { vi } from './vi';
import { zh } from './zh';

/** Quote texts by locale; the analyzer falls back to English. */
export const QUOTE_TEXTS: Record<string, QuoteTexts> = {
  ru,
  en,
  kk,
  de,
  fr,
  es,
  pt,
  tr,
  uk,
  zh,
  pl,
  it,
  sk,
  ja,
  ko,
  hi,
  nl,
  sv,
  vi,
  id,
  da,
  nb,
  nn,
  fi,
  is,
  fo,
  cs,
  hr,
  sl,
  bs,
  bg,
  sr,
  mk,
  be,
  hsb,
};
