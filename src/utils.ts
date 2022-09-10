import { IntersectEvaluate, IntersectReduce, Kind, SchemaOptions, TSchema, Type } from "@sinclair/typebox";

export function mapKeys<K extends string, R>(keys: readonly K[], mapper: (key: K, index: number) => R): Record<K, R> {
  return Object.fromEntries(keys.map((key, index) => ([key, mapper(key, index)]))) as Record<K, R>;
}

export type IntersectSchemaArray<T extends TSchema[]> = IntersectReduce<unknown, IntersectEvaluate<T, []>>

export type TIntersectAllOf<T extends TSchema[]> = ReturnType<typeof IntersectAllOf<T>>

export interface IntersectAllOfOptions extends SchemaOptions { unevaluatedProperties?: boolean }

export const IntersectAllOf = <T extends TSchema[]>(allOf: [...T], options: IntersectAllOfOptions = {}) =>
  Type.Unsafe<IntersectSchemaArray<T>>({ ...options, [Kind]: 'IntersectAllOf', allOf })

export const Nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()]);
