import rule from "./no-unused-await";
import { createTester } from "../ts-eslint-tester-extensions";

const tester = createTester();
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
