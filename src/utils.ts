export function mapKeys<K extends string, R>(keys: readonly K[], mapper: (key: K, index: number) => R): Record<K, R> {
  return Object.fromEntries(keys.map((key, index) => ([key, mapper(key, index)]))) as Record<K, R>;
}
