type JsonPrimitive = null | boolean | number | string;
/** @internal */
export type JsonValue =
    | JsonPrimitive
    | JsonArray
    | { [key: string]: JsonValue };
type JsonArray = JsonValue[];
/** @internal */
export type ReadonlyJsonValue =
    | JsonPrimitive
    | ReadonlyJsonArray
    | { readonly [key: string]: ReadonlyJsonValue };
type ReadonlyJsonArray = readonly ReadonlyJsonValue[];

/** @internal */
export type DeepMutableJson<T> = T extends JsonPrimitive
    ? T
    : { -readonly [k in keyof T]: DeepMutableJson<T[k]> };

/** @internal */
export type DeepReadonlyJson<T> = T extends JsonPrimitive
    ? T
    : T extends readonly (infer e)[]
    ? readonly DeepReadonlyJson<e>[]
    : { readonly [k in keyof T]: DeepReadonlyJson<T[k]> };
