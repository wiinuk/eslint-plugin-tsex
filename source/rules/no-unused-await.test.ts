import { TSESLint } from "@typescript-eslint/experimental-utils";
import rule from "./no-unused-await";

const tester = new TSESLint.RuleTester({
    parser: require.resolve("@typescript-eslint/parser"),
});
tester.run("no-unused-await", rule, {
    valid: [
        {
            code: "async function f(x: Promise<string>) { return await x; }",
        },
    ],
    invalid: [
        {
            code: `async function f(x: number) { return await x; }`,
            output: "async function f(x: number) { return  x; }",
            errors: [{ messageId: "remove_unneeded_await" }],
        },
    ],
});
