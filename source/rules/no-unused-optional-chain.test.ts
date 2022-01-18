import { createTester } from "../ts-eslint-tester-extensions";
import rule from "./no-unused-optional-chain";

const tester = createTester();
tester.run("no-unused-optional-chain", rule, {
    valid: [
        {
            code: `(Math.random() ? "" : null)?.toLowerCase()`,
        },
        {
            code: `(Math.random() ? "" : null)?.[0]`,
        },
    ],
    invalid: [
        {
            code: `""?.toLowerCase()`,
            output: `"".toLowerCase()`,
            errors: [{ messageId: "replace_unneeded_QuestionDot_with_Dot" }],
        },
        {
            code: `""?.[0]`,
            output: `""[0]`,
            errors: [{ messageId: "remove_unneeded_QuestionDot" }],
        },
    ],
});
