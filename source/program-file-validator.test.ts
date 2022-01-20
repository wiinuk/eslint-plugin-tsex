import { TSESLint } from "@typescript-eslint/experimental-utils";
import { createProgramFileValidator } from "./program-file-validator";

const haltRule: TSESLint.RuleModule<"error", []> = {
    meta: {
        type: "problem",
        messages: {
            error: "ERROR!",
        },
        schema: [],
    },
    create(context) {
        return {
            Program(node) {
                context.report({
                    node,
                    messageId: "error",
                });
            },
        };
    },
};
it("main.ts, lib.ts", () => {
    const validator = createProgramFileValidator({
        ruleName: "halt",
        rule: haltRule,
        sourceFiles: [
            {
                filePath: "/dir/lib.ts",
                source: `export function add(a: number, b: number) { return a + b; }`,
            },
            {
                filePath: "/dir/main.ts",
                source: `import { add } from "/dir/lib";`,
            },
        ],
    });
    expect(validator.validateFile("/dir/main.ts")).toMatchObject({
        fixed: false,
        messages: [{ messageId: "error" }],
    });
});
