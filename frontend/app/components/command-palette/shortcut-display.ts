/**
 * Turns a tinykeys binding into the chips we draw next to a command, so the
 * binding string stays the single source of truth for both the handler and the
 * hint. A space separates presses of a sequence ('KeyG KeyA' → G then A); a plus
 * separates keys of one combination ('Alt+Shift+KeyT' → ALT ⇧ T).
 *
 * Bindings name physical keys, so the chips show what is printed on a US
 * keyboard — which is also what the `KeyA` style spec means.
 */
export type HintToken = { kind: 'key'; text: string } | { kind: 'sep' };

/** Physical keys whose printed label is not simply the suffix of the code. */
const CODE_LABELS: Record<string, string> = {
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
  Space: 'Space',
};

const NAMED_KEYS: Record<string, string> = {
  shift: '⇧',
  control: 'Ctrl',
  ctrl: 'Ctrl',
  meta: '⌘',
  escape: 'Esc',
  enter: '↵',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  backspace: '⌫',
  delete: 'Del',
};

export function keyLabel(key: string, isMac: boolean): string {
  if (key === '$mod') {
    return isMac ? '⌘' : 'Ctrl';
  }
  if (CODE_LABELS[key]) {
    return CODE_LABELS[key];
  }
  // KeyA -> A, Digit1 -> 1.
  const physical = key.match(/^(?:Key([A-Z])|Digit([0-9]))$/);
  if (physical) {
    return physical[1] ?? physical[2];
  }
  if (key.toLowerCase() === 'alt') {
    return isMac ? '⌥' : 'ALT';
  }
  const named = NAMED_KEYS[key.toLowerCase()];
  if (named) {
    return named;
  }
  return key.length === 1 ? key.toUpperCase() : key;
}

export function bindingToTokens(binding: string, isMac: boolean): HintToken[] {
  const presses = binding.trim().split(/\s+/).filter(Boolean);
  const tokens: HintToken[] = [];
  presses.forEach((press, index) => {
    if (index > 0) {
      tokens.push({ kind: 'sep' });
    }
    for (const key of press.split('+')) {
      tokens.push({ kind: 'key', text: keyLabel(key, isMac) });
    }
  });
  return tokens;
}
