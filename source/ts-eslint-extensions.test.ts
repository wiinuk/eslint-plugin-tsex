/* eslint-disable @typescript-eslint/ban-ts-comment */
import { createRule, messagesToIdAndData } from "./ts-eslint-extensions";
import { eq } from "./type-level/standard-extensions";

function assert<_T extends true>() {
    /* 型レベルアサーション関数 */
}

describe("messagesToIdAndData", () => {
    it(`{ a: "A", b: "B" }`, () => {
        type a = messagesToIdAndData<{ a: "A"; b: "B" }>;
        type x =
            | { messageId: "a"; data?: Record<string, never> }
            | { messageId: "b"; data?: Record<string, never> };
        assert<eq<a, x>>();
    });
});
describe("createRule", () => {
    it("nameAndAge", () => {
        createRule(
            {
                messages: {
                    nameAndAge: "name: {{name:string}}, age: {{age:number}}.",
                    message: "message",
                },
                type: "suggestion",
            } as const,
            [],
            (context) => {
                return {
                    Program(node) {
                        // OK
                        context.report({
                            node,
                            messageId: "nameAndAge",
                            data: { "name:string": "Bob", "age:number": 2 },
                        });
                        // @ts-expect-error data が指定されていないのでエラーになる
                        context.report({
                            node,
                            messageId: "nameAndAge",
                        });
                        context.report({
                            node,
                            messageId: "nameAndAge",
                            // @ts-expect-error "age:string" がないのでエラーになる
                            data: { "name:string": "Alice" },
                        });
                        context.report({
                            node,
                            messageId: "nameAndAge",
                            // @ts-expect-error "age:number" が string 型なのでエラーになる
                            data: { "name:string": "Bob", "age:number": "2" },
                        });

                        // OK
                        context.report({
                            node,
                            messageId: "message",
                        });
                        // OK
                        context.report({
                            node,
                            messageId: "message",
                            data: {},
                        });
                        context.report({
                            node,
                            messageId: "message",
                            // @ts-expect-error name が指定されているのでエラーになる
                            data: { name: "Alice" },
                        });
                    },
                };
            }
        );
    });
});
