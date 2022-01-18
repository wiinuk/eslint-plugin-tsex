import utils from "@typescript-eslint/experimental-utils";
import { DeepReadonlyJson, JsonValue } from "./json";
import { defaultValue, eq, getOrUndefined, kind } from "./standard-extensions";

type Schema = DeepReadonlyJson<utils.JSONSchema.JSONSchema4>;

/** @internal */
export type SchemaList = readonly Schema[];
type unreachable = never;
type notImplementedErrorMessage = "❌error: not implemented";

type getPropertyNameSet<TRequired extends Schema["required"]> =
    TRequired extends readonly string[]
        ? number extends TRequired["length"]
            ? notImplementedErrorMessage
            : TRequired[number]
        : TRequired extends boolean
        ? notImplementedErrorMessage
        : never;

type typeOfObjectSchema<
    TProperties extends NonNullable<Schema["properties"]>,
    TRequired extends Schema["required"]
> = getPropertyNameSet<TRequired> extends kind<string, infer requiredKeys>
    ? // 必須プロパティがない
      eq<requiredKeys, never> extends true
        ? {
              -readonly [k in keyof TProperties]?: typeOfSchema<TProperties[k]>;
          }
        : // すべてのプロパティが必須
        keyof TProperties extends requiredKeys
        ? {
              -readonly [k in keyof TProperties]: typeOfSchema<TProperties[k]>;
          }
        : // 必須プロパティとオプショナルプロパティの混在
          {
              -readonly [k in requiredKeys]: typeOfSchema<TProperties[k]>;
          } & {
              -readonly [k in Exclude<
                  keyof TProperties,
                  requiredKeys
              >]?: typeOfSchema<TProperties[k]>;
          }
    : unreachable;

type typeOfTupleSchema<
    TItems extends SchemaList,
    TAdditionalItems extends Schema["additionalItems"]
> =
    // `{ items: s[] }` や `{ items: [s1, s2, ...s3[]] }` などの不定長配列の場合エラーとする
    number extends TItems["length"]
        ? notImplementedErrorMessage
        : // 固定長配列の場合
        { -readonly [i in keyof TItems]: typeOfSchema<TItems[i]> } extends kind<
              JsonValue[],
              infer fixedItems
          >
        ? TAdditionalItems extends false
            ? fixedItems
            : [...fixedItems, ...JsonValue[]]
        : unreachable;

type typeOfArraySchema<
    TItems extends Schema["items"],
    TAdditionalItems extends Schema["additionalItems"]
> = TItems extends SchemaList
    ? typeOfTupleSchema<TItems, TAdditionalItems>
    : TItems extends Schema
    ? typeOfSchema<TItems>[]
    : JsonValue[];

type typeOfTypeProperty<
    TSchema extends Schema,
    TName extends Schema["type"]
> = TName extends "object"
    ? typeOfObjectSchema<
          defaultValue<
              // eslint-disable-next-line @typescript-eslint/ban-types
              {},
              getOrUndefined<TSchema, "properties">
          >,
          getOrUndefined<TSchema, "required">
      >
    : TName extends "array"
    ? typeOfArraySchema<
          getOrUndefined<TSchema, "items">,
          getOrUndefined<TSchema, "additionalItems">
      >
    : TName extends "boolean"
    ? boolean
    : TName extends "number" | "integer"
    ? number
    : TName extends "string"
    ? string
    : TName extends "null"
    ? null
    : TName extends "any" | undefined
    ? JsonValue
    : notImplementedErrorMessage;

type typeOfAnyOfProperty<TSchemas extends NonNullable<Schema["anyOf"]>> =
    // `{ anyOf: [] }` や `{ }` なら許容型はすべての型
    TSchemas extends []
        ? JsonValue
        : // `{ anyOf: s[] }` や { anyOf: [s1, s2, ...s3[]] } のような不定長配列の場合はエラーとする
        number extends TSchemas["length"]
        ? notImplementedErrorMessage
        : // `{ anyOf: [s1, s2] }` のような固定長配列の場合許容型はそれぞれの要素の許容型のユニオン型
          {
              -readonly [i in keyof TSchemas]: typeOfSchema<TSchemas[i]>;
          }[number];

/** @internal */
export type typeOfSchema<TSchema extends Schema> =
    // type プロパティがある場合
    "type" extends keyof TSchema
        ? typeOfTypeProperty<
              TSchema,
              getOrUndefined<TSchema, "type">
          > extends infer t1
            ? "anyOf" extends keyof TSchema
                ? // type プロパティと anyOf プロパティがある場合
                  t1 &
                      typeOfAnyOfProperty<
                          defaultValue<[], getOrUndefined<TSchema, "anyOf">>
                      >
                : // type プロパティのみがある場合
                  t1
            : unreachable
        : // type プロパティがない場合
          typeOfAnyOfProperty<
              defaultValue<[], getOrUndefined<TSchema, "anyOf">>
          >;
