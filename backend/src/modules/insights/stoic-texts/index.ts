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
import type { StoicMessageKey, StoicTextMap } from './types';
import { uk } from './uk';
import { vi } from './vi';
import { zh } from './zh';

export const STOIC_TEXTS: Record<string, StoicTextMap> = {
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
  bg,
  hr,
  sr,
  sl,
  mk,
  be,
  bs,
  hsb,
};

export function isStoicKey(key: string): key is StoicMessageKey {
  return key in en;
}
