import { Injectable, Optional } from '@nestjs/common';
import { ApplicationSettingsService } from '../application-settings/application-settings.service';
import type { SuggestImportDto } from './dto/suggest-import.dto';
import { AiImportMapperHelper } from './helpers/ai-import-mapper.helper';
import { parseImportDate, parseImportNumber } from './helpers/import-values';
import {
  headerMatchScore,
  IMPORT_TARGET_KINDS,
  type ImportTargetKind,
  normalizeHeader,
  TARGET_FIELDS,
  TARGET_HINTS,
} from './target-aliases';

export interface ImportSuggestion {
  target: ImportTargetKind | 'table';
  confidence: number;
  columns: Array<{ index: number; role: string | null }>;
  alternatives: Array<{ target: ImportTargetKind; confidence: number }>;
  source: 'heuristic' | 'ai';
}

/** Below this the sheet is offered as a plain table, above it as an entity import. */
const TABLE_THRESHOLD = 0.35;
/** Below this the model is asked for a second opinion, when one is configured. */
const AI_THRESHOLD = 0.7;

type ColumnProfile = {
  index: number;
  header: string;
  numeric: number;
  dates: number;
  filled: number;
};

const profileColumns = (headers: string[], samples: string[][]): ColumnProfile[] =>
  headers.map((header, index) => {
    let numeric = 0;
    let dates = 0;
    let filled = 0;
    for (const row of samples) {
      const cell = String(row?.[index] ?? '').trim();
      if (!cell) {
        continue;
      }
      filled += 1;
      if (parseImportDate(cell)) {
        dates += 1;
      } else if (parseImportNumber(cell).value !== null) {
        numeric += 1;
      }
    }
    return { index, header, numeric, dates, filled };
  });

const typeFits = (profile: ColumnProfile, type: string): boolean => {
  if (!profile.filled) {
    return true;
  }
  if (type === 'number') {
    return profile.numeric / profile.filled >= 0.6;
  }
  if (type === 'date') {
    return profile.dates / profile.filled >= 0.6;
  }
  return true;
};

@Injectable()
export class ImportSuggestService {
  private readonly aiMapper = new AiImportMapperHelper();

  constructor(@Optional() private readonly applicationSettings?: ApplicationSettingsService) {}

  /** Greedy header → field assignment for one target; returns score and mapping. */
  private scoreTarget(
    kind: ImportTargetKind,
    profiles: ColumnProfile[],
  ): { score: number; columns: Map<number, string> } {
    const fields = TARGET_FIELDS[kind];
    const candidates: Array<{ index: number; key: string; score: number }> = [];
    for (const profile of profiles) {
      for (const field of fields) {
        const match = headerMatchScore(profile.header, field.aliases);
        if (match > 0 && typeFits(profile, field.type)) {
          candidates.push({ index: profile.index, key: field.key, score: match });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const columns = new Map<number, string>();
    const usedFields = new Set<string>();
    for (const candidate of candidates) {
      if (columns.has(candidate.index) || usedFields.has(candidate.key)) {
        continue;
      }
      columns.set(candidate.index, candidate.key);
      usedFields.add(candidate.key);
    }
    const required = fields.filter(field => field.required);
    const requiredHit = required.filter(field => usedFields.has(field.key)).length;
    if (requiredHit < required.length) {
      // A target missing a required column cannot be imported; keep it as a weak alternative.
      return { score: (requiredHit / Math.max(required.length, 1)) * 0.3, columns };
    }
    const hintHits = profiles.filter(profile =>
      TARGET_HINTS[kind].some(hint =>
        normalizeHeader(profile.header).includes(normalizeHeader(hint)),
      ),
    ).length;
    const coverage = usedFields.size / fields.length;
    const score = 0.5 + coverage * 0.3 + Math.min(hintHits, 3) * 0.07;
    return { score: Math.min(score, 0.99), columns };
  }

  async suggest(workspaceId: string, dto: SuggestImportDto): Promise<ImportSuggestion> {
    const headers = dto.headers.map(header => String(header ?? ''));
    const samples = dto.samples ?? [];
    const profiles = profileColumns(headers, samples);
    const scored = IMPORT_TARGET_KINDS.map(kind => ({
      kind,
      ...this.scoreTarget(kind, profiles),
    })).sort((a, b) => b.score - a.score);
    const best = scored[0];
    let suggestion: ImportSuggestion = {
      target: best.score >= TABLE_THRESHOLD ? best.kind : 'table',
      confidence: Number(best.score.toFixed(2)),
      columns: profiles.map(profile => ({
        index: profile.index,
        role: best.score >= TABLE_THRESHOLD ? (best.columns.get(profile.index) ?? null) : null,
      })),
      alternatives: scored.slice(1, 3).map(item => ({
        target: item.kind,
        confidence: Number(item.score.toFixed(2)),
      })),
      source: 'heuristic',
    };

    if (best.score < AI_THRESHOLD && this.applicationSettings) {
      try {
        const settings = await this.applicationSettings.getAiSettingsForWorkspaceId(workspaceId);
        this.aiMapper.configureAiClient(settings);
        const ai = await this.aiMapper.suggest(headers, samples);
        if (ai) {
          const roles = new Map(ai.columns.map(column => [column.index, column.role]));
          suggestion = {
            ...suggestion,
            target: ai.target,
            confidence: Math.max(suggestion.confidence, 0.75),
            columns: profiles.map(profile => ({
              index: profile.index,
              role: roles.get(profile.index) ?? null,
            })),
            source: 'ai',
          };
        }
      } catch {
        // The model is a second opinion; the heuristic answer stands on its own.
      }
    }
    return suggestion;
  }
}
