import { TSESLint } from "@typescript-eslint/experimental-utils";
import { error } from "./standard-extensions";
import { DeepMutableJson, ReadonlyJsonValue } from "./type-level/json";
import {
    SchemaList,
    typeOfSchema,
    unreachable,
} from "./type-level/json-schema";
import { cast, kind } from "./type-level/standard-extensions";

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
type messagesToIdAndData<TMessages extends MessagesKind> = {
    [k in keyof TMessages]: parseTemplateMessageToData<
        TMessages[k]
    > extends kind<{ readonly [name: string]: unknown }, infer data>
        ? // メッセージに穴がない場合
          // eslint-disable-next-line @typescript-eslint/ban-types
          data extends {}
            ? {
                  readonly messageId: k;
                  readonly data?: data;
              }
            : // メッセージに１つ以上の穴がある場合
              {
                  readonly messageId: k;
                  readonly data: data;
              }
        : unreachable;
}[keyof TMessages];

type x = messagesToIdAndData<{ a: "A"; b: "B" }>;

type StrongReportDescriptor<TMessages extends MessagesKind> =
    TSESLint.ReportDescriptor<getMessageIds<TMessages>> &
        messagesToIdAndData<TMessages> & {
            readonly suggestions?: TSESLint.ReportSuggestionArray<
                getMessageIds<TMessages>
            >;
        };

/** @internal */
export function createRule<
    TMessages extends MessagesKind,
    TSchema extends SchemaList
>(
    meta: MetadataWithoutSchema<TMessages>,
    schema: TSchema,
    create: StrongRuleCreator<TMessages, TSchema>
): TSESLint.RuleModule<getMessageIds<TMessages>, getOptions<TSchema>> {
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
