import { describe, expect, it } from 'vitest';

import {
  applyMention,
  collectMentionedIds,
  filterCandidates,
  findActiveMention,
  splitByMentions,
} from './mentions.utils';

const CANDIDATES = [
  { id: 'u1', name: 'Анна' },
  { id: 'u2', name: 'Анна Петрова' },
  { id: 'u3', name: 'Пётр' },
];

describe('findActiveMention', () => {
  it('finds the mention being typed at the caret', () => {
    expect(findActiveMention('привет @Ан', 10)).toEqual({ start: 7, query: 'Ан' });
  });

  it('opens on a bare @ at the start of the line', () => {
    expect(findActiveMention('@', 1)).toEqual({ start: 0, query: '' });
  });

  it('ignores an @ glued to the previous word so emails do not trigger it', () => {
    expect(findActiveMention('ivan@example.com', 16)).toBeNull();
  });

  it('gives up once the query grows past a two-word name', () => {
    expect(findActiveMention('@Анна Петрова тут', 17)).toBeNull();
  });
});

describe('applyMention', () => {
  it('replaces the typed fragment and puts the caret after the name', () => {
    const result = applyMention('смотри @Ан сюда', { start: 7, query: 'Ан' }, 'Анна Петрова');
    expect(result.text).toBe('смотри @Анна Петрова сюда');
    expect(result.caret).toBe(20);
  });

  it('adds the trailing space only when the text does not already have one', () => {
    const result = applyMention('смотри @Ан', { start: 7, query: 'Ан' }, 'Пётр');
    expect(result.text).toBe('смотри @Пётр ');
    expect(result.caret).toBe(13);
  });
});

describe('filterCandidates', () => {
  it('matches case-insensitively and returns everyone on an empty query', () => {
    expect(filterCandidates(CANDIDATES, 'анна').map(c => c.id)).toEqual(['u1', 'u2']);
    expect(filterCandidates(CANDIDATES, '  ')).toHaveLength(3);
  });
});

describe('collectMentionedIds', () => {
  it('reads mentions off the final text, not the click history', () => {
    expect(collectMentionedIds('привет @Пётр', CANDIDATES)).toEqual(['u3']);
    expect(collectMentionedIds('никого не звал', CANDIDATES)).toEqual([]);
  });
});

describe('splitByMentions', () => {
  it('prefers the longest name so a prefix does not swallow it', () => {
    const segments = splitByMentions('эй @Анна Петрова, глянь', ['Анна', 'Анна Петрова']);
    expect(segments).toEqual([
      { text: 'эй ', isMention: false },
      { text: '@Анна Петрова', isMention: true },
      { text: ', глянь', isMention: false },
    ]);
  });

  it('returns the body untouched when there is nobody to highlight', () => {
    expect(splitByMentions('просто текст', [])).toEqual([
      { text: 'просто текст', isMention: false },
    ]);
  });
});
