/**
 * The enum member a contract literal names. Request bodies decode to plain
 * string literals (packages/contracts cannot import backend enums), while
 * entities and services use TS enums with the same values. The parameter is
 * typed as the enum's values, so a contract literal the enum lacks does not
 * compile; null and undefined pass through.
 */
export function toEnum<
  E extends Record<string, string>,
  V extends `${E[keyof E]}` | null | undefined,
>(_values: E, value: V): V extends string ? E[keyof E] : V {
  return value as V extends string ? E[keyof E] : V;
}
