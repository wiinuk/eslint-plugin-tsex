import { TSESLint } from "@typescript-eslint/experimental-utils";
import { error } from "./standard-extensions";
import { DeepMutableJson, ReadonlyJsonValue } from "./type-level/json";
import {
    SchemaList,
    typeOfSchema,
    unreachable,
} from "./type-level/json-schema";
import { cast, kind } from "./type-level/standard-extensions";
import { parseTemplateMessageToData } from "./type-level/template-parser";

const clone = <T extends ReadonlyJsonValue>(json: T) =>
    JSON.parse(JSON.stringify(json)) as DeepMutableJson<T>;

type getMessageIds<TMessages extends MessagesKind> = cast<
    string,
    keyof TMessages
>;
type getOptions<TSchemas extends SchemaList> = {
    -readonly [i in keyof TSchemas]: typeOfSchema<TSchemas[i]>;
};

/** @internal */
export type MessagesKind = Record<string, string>;
/** @internal */
export type MetadataWithoutSchema<TMessages extends MessagesKind> = Omit<
    TSESLint.RuleMetaData<getMessageIds<TMessages>>,
    "schema"
> & {
    messages?: TMessages;
};
type StrongRuleCreator<
    TMessages extends MessagesKind,
    TSchema extends SchemaList,
    TRuleListener extends TSESLint.RuleListener = TSESLint.RuleListener
> = (context: Readonly<StrongRuleContext<TMessages, TSchema>>) => TRuleListener;

interface StrongRuleContext<
    TMessages extends MessagesKind,
    TSchema extends SchemaList
> extends TSESLint.RuleContext<getMessageIds<TMessages>, getOptions<TSchema>> {
    report(descriptor: StrongReportDescriptor<TMessages>): void;
}
/** @internal */
export type messagesToIdAndData<TMessages extends MessagesKind> = {
    [k in keyof TMessages]: parseTemplateMessageToData<
        TMessages[k]
    > extends kind<{ readonly [name: string]: unknown }, infer data>
        ? // メッセージにパラメータがない場合
          // eslint-disable-next-line @typescript-eslint/ban-types
          keyof data extends never
            ? {
                  readonly messageId: k;
                  readonly data?: Readonly<Record<string, never>>;
              }
            : // メッセージに１つ以上のパラメータがある場合
              {
                  readonly messageId: k;
                  readonly data: data;
              }
        : unreachable;
}[keyof TMessages];

/** @internal */
export type StrongReportDescriptor<TMessages extends MessagesKind> =
    TSESLint.ReportDescriptor<getMessageIds<TMessages>> &
        messagesToIdAndData<TMessages> & {
            readonly suggestions?: TSESLint.ReportSuggestionArray<
                getMessageIds<TMessages>
            >;
        };

/** @internal */
export type StrongRuleModule<
    TMessages extends MessagesKind,
    TSchema extends SchemaList,
    TRuleListener extends TSESLint.RuleListener = TSESLint.RuleListener
> = TSESLint.RuleModule<getMessageIds<TMessages>, getOptions<TSchema>> & {
    create: StrongRuleCreator<TMessages, TSchema, TRuleListener>;
};

/** @internal */
export function createRule<
    TMessages extends MessagesKind,
    TSchema extends SchemaList
>(
    meta: MetadataWithoutSchema<TMessages>,
    schema: TSchema,
    create: StrongRuleCreator<TMessages, TSchema>
): StrongRuleModule<TMessages, TSchema> {
    return {
        meta: { ...meta, schema: clone(schema) },
        create,
    };
}
/** @internal */
export function getParserServicesOrError<
    TMessageIds extends string,
    TOptions extends readonly unknown[]
>(context: TSESLint.RuleContext<TMessageIds, TOptions>) {
    return context.parserServices ?? error`ParserServices not available`;
}
