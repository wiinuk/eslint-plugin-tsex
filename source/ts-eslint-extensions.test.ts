/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
    createRule,
    messagesToIdAndData,
    StrongReportDescriptor,
} from "./ts-eslint-extensions";
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

type x = StrongReportDescriptor<{
    a: "{{name:string}} {{age:number}}";
    b: "B";
}>;
type a = x["data"];

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
                        // @ts-expect-error "age:string" がないのでエラーになる
                        context.report({
                            node,
                            messageId: "nameAndAge",
                            data: { "name:string": "Alice" },
                        });
                        // @ts-expect-error age:number が string 型なのでエラーになる
                        context.report({
                            node,
                            messageId: "nameAndAge",
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
                        // @ts-expect-error name が指定されているのでエラーになる
                        context.report({
                            node,
                            messageId: "message",
                            data: { name: "Alice" },
                        });
                    },
                };
            }
        );
    });
});
