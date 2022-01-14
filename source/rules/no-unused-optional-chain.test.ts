import { TSESLint } from "@typescript-eslint/experimental-utils";
import rule from "./no-unused-optional-chain";

const tester = new TSESLint.RuleTester({
    parser: require.resolve("@typescript-eslint/parser"),
});
tester.run("no-unused-optional-chain", rule, {
    valid: [
        {
            code: "('' as ('' | '❗NULL'))?.toLowerCase()",
        },
        {
            code: "('' as ('' | '❗NULL'))?.[0]",
        },
    ],
    invalid: [
        {
            code: `''?.toLowerCase()`,
            output: "''.toLowerCase()",
            errors: [{ messageId: "replace_unneeded_QuestionDot_with_Dot" }],
        },
        {
            code: `''?.[0]`,
            output: "''[0]",
            errors: [{ messageId: "remove_unneeded_QuestionDot" }],
        },
    ],
});
