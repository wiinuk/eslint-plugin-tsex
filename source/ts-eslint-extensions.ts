import { TSESLint } from "@typescript-eslint/experimental-utils";
import { error } from "./standard-extensions";
import { DeepMutableJson, ReadonlyJsonValue } from "./type-level/json";
import { SchemaList, typeOfSchema } from "./type-level/json-schema";
import { cast } from "./type-level/standard-extensions";

const clone = <T extends ReadonlyJsonValue>(json: T) =>
    JSON.parse(JSON.stringify(json)) as DeepMutableJson<T>;

type getMessageIds<TMessages extends MessagesKind> = cast<
    string,
    keyof TMessages
>;
type getOptions<TSchemas extends SchemaList> = {
    -readonly [i in keyof TSchemas]?: typeOfSchema<TSchemas[i]>;
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
/** @internal */
export function createRule<
    TMessages extends MessagesKind,
    TSchema extends SchemaList
>(
    meta: MetadataWithoutSchema<TMessages>,
    schema: TSchema,
    create: TSESLint.RuleCreateFunction<
        getMessageIds<TMessages>,
        getOptions<TSchema>
    >
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
