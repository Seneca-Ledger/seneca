import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DateFormatPreference, ThemePreference, UiDensity } from '@/entities/user.entity';

export enum AppLocale {
  RU = 'ru',
  EN = 'en',
  KK = 'kk',
  ZH = 'zh',
  DE = 'de',
  FR = 'fr',
  ES = 'es',
  UK = 'uk',
  PL = 'pl',
  SK = 'sk',
  PT = 'pt',
  TR = 'tr',
  IT = 'it',
  JA = 'ja',
  KO = 'ko',
  HI = 'hi',
  NL = 'nl',
  SV = 'sv',
  VI = 'vi',
  ID = 'id',
  DA = 'da',
  NB = 'nb',
  NN = 'nn',
  FI = 'fi',
  IS = 'is',
  FO = 'fo',
  CS = 'cs',
  BG = 'bg',
  HR = 'hr',
  SR = 'sr',
  SL = 'sl',
  MK = 'mk',
  BE = 'be',
  BS = 'bs',
  HSB = 'hsb',
}

export class UpdateMyPreferencesDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(AppLocale)
  locale?: AppLocale;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string | null;

  @IsOptional()
  @IsEnum(ThemePreference)
  themePreference?: ThemePreference;

  @IsOptional()
  @IsEnum(DateFormatPreference)
  dateFormat?: DateFormatPreference;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  firstDayOfWeek?: number | null;

  @IsOptional()
  @IsEnum(UiDensity)
  uiDensity?: UiDensity;

  @IsOptional()
  @IsBoolean()
  reduceMotion?: boolean;

  @IsOptional()
  @IsBoolean()
  showDailyQuote?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  mapStylePreference?: string | null;
}
