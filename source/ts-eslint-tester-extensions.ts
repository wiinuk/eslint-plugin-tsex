import { TSESLint } from "@typescript-eslint/experimental-utils";

/** @internal */
export function createTester() {
    const parserOptions = {
        ecmaVersion: 2018,
        project: "./tsconfig.json",
        createDefaultProgram: true,
    } as const;
    return new TSESLint.RuleTester({
        parser: require.resolve("@typescript-eslint/parser"),
        parserOptions,
    });
}
