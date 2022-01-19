/* eslint-disable @typescript-eslint/ban-types */
import { unreachable } from "./json-schema";
import { kind } from "./standard-extensions";

type State = {
    remaining: string;
    data: Record<string, unknown>;
};
type createState<source extends string> = kind<
    State,
    {
        remaining: source;
        data: {};
    }
>;

type withState<state extends State, values extends Partial<State>> = kind<
    State,
    {
        [k in keyof state]: k extends keyof values
            ? values[k] extends undefined
                ? state[k]
                : NonNullable<values[k]>
            : state[k];
    }
>;

type consumed<state extends State, remaining extends string> = withState<
    state,
    {
        remaining: remaining;
    }
>;
type addParameter<state extends State, name extends string, type> = withState<
    state,
    {
        data: state["data"] & { [k in name]: type };
    }
>;

/* (?<start> ^ \k<element>* $ )
 * (?<element> \k<character> | \k<interpolate> )
 * (?<character> (?! \{\{ ) . )
 * (?<interpolate> \{\{ \k<parameter> \}\} )
 * (?<parameter> \k<name> ( : \k<type> )? )
 * (?<name> ((?! \{\{ | :) .)* )
 * (?<type> string | number | boolean)
 */

/** @internal */
export type parseTemplateMessageToData<template extends string> = kind<
    Readonly<Record<string, unknown>>,
    flattenIntersection<parseTemplate<createState<template>>["data"]>
>;
// `{ age: number } & { name: string }` を `{ name: string; age: number }` に変換する
type flattenIntersection<data extends Record<string, unknown>> = {
    readonly [k in keyof data]: data[k];
};
type parseTemplate<state extends State> = kind<
    State,
    // 最初に現れる '{{' を探す
    state["remaining"] extends `${infer _chars}{{${infer remaining}`
        ? // '{{' に続くパラメーターを解析する
          parseInterpolateTail<consumed<state, remaining>> extends kind<
              State,
              infer state
          >
            ? // 残りの文字列を解析する
              parseTemplate<state>
            : unreachable
        : // '{{' が無ければ終了
          state
>;
type nonSpecifiedParameterType = unknown;
type parseInterpolateTail<state extends State> = kind<
    State,
    // 最初に現れる ':' と '}}' で区切る
    state["remaining"] extends `${infer name}:${infer typeName}}}${infer remaining}`
        ? consumed<
              addParameter<
                  state,
                  `${name}:${typeName}`,
                  typeNameAsType<typeName>
              >,
              remaining
          >
        : // 最初に現れる '}}' で区切る
        state["remaining"] extends `${infer name}}}${infer remaining}`
        ? consumed<
              addParameter<state, name, nonSpecifiedParameterType>,
              remaining
          >
        : // ( 寛容: `: … }}` も `}}` も見つからない場合、ソースの最後までをパラメータ名とする )
          consumed<
              addParameter<
                  state,
                  state["remaining"],
                  nonSpecifiedParameterType
              >,
              ""
          >
>;

type typeNameAsType<name extends string> =
    name extends keyof primitiveTypeNameToType
        ? primitiveTypeNameToType[name]
        : never;

type primitiveTypeNameToType = {
    string: string;
    number: number;
    boolean: boolean;
};
