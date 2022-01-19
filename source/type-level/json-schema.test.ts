import { DeepMutableJson, JsonValue } from "./json";
import { typeOfSchema } from "./json-schema";
import { eq } from "./standard-extensions";

function assert<_T extends true>() {
    /* 型レベルアサーション関数 */
}

const schema = {
    type: "object",
    properties: {
        ignorePattern: {
            type: "string",
        },
        roots: {
            type: "array",
            items: {
                anyOf: [
                    {
                        type: "string",
                    },
                    {
                        type: "array",
                        items: [{ type: "string" }, { type: "string" }],
                        additionalItems: false,
                    },
                ],
            },
        },
    },
    additionalProperties: false,
} as const;

it("DeepMutableJson", () => {
    type a = DeepMutableJson<readonly [1, 2]>;
    type x = [1, 2];
    assert<eq<a, x>>();
});
describe("typeOfSchema", () => {
    type stringSchema = { type: "string" };
    type numberSchema = { type: "number" };
    it("{ ignorePattern?: string;, roots?: (string | [string, string])[] }", () => {
        type a = typeOfSchema<DeepMutableJson<typeof schema>>;
        type x = {
            ignorePattern?: string;
            roots?: (string | [file: string, exportName: string])[];
        };
        type ar = a["roots"] extends (infer e)[] | undefined ? e : never;
        const ar: ar = ["", ""];
        const _ar2: ar = "";
        assert<eq<a["roots"], x["roots"]>>();
    });
    it("[string, number, ...JsonValue[]]", () => {
        type a = typeOfSchema<{
            type: "array";
            items: [stringSchema, numberSchema];
            additionalItems: true;
        }>;
        type x = [string, number, ...JsonValue[]];
        assert<eq<a, x>>();
    });
    it("string | [string, string]", () => {
        type a = typeOfSchema<{
            type: "array";
            items: {
                anyOf: [
                    {
                        type: "string";
                    },
                    {
                        type: "array";
                        items: [{ type: "string" }, { type: "string" }];
                        additionalItems: false;
                    }
                ];
            };
        }>;
        type x = (string | [string, string])[];
        assert<eq<a, x>>();
    });
    it("`string | [string, string]` ( readonly )", () => {
        type a = typeOfSchema<{
            readonly type: "array";
            readonly items: {
                readonly anyOf: readonly [
                    {
                        readonly type: "string";
                    },
                    {
                        readonly type: "array";
                        readonly items: readonly [
                            {
                                readonly type: "string";
                            },
                            {
                                readonly type: "string";
                            }
                        ];
                        readonly additionalItems: false;
                    }
                ];
            };
        }>;
        type e = (string | [string, string])[];
        assert<eq<a, e>>();
    });
    it("{ a: number, b?: string }", () => {
        type a = typeOfSchema<{
            type: "object";
            properties: { a: numberSchema; b: stringSchema };
            required: ["a"];
        }>;
        type x = { a: number; b?: string };
        assert<eq<a, x>>();
    });
    it("{ a?: number, b?: string }", () => {
        type a = typeOfSchema<{
            type: "object";
            properties: { a: numberSchema; b: stringSchema };
        }>;
        type x = { a?: number; b?: string };
        assert<eq<a, x>>();
    });
    it("{ a: number, b: string }", () => {
        type a = typeOfSchema<{
            type: "object";
            properties: { a: numberSchema; b: stringSchema };
            required: ["a", "b"];
        }>;
        type x = { a: number; b: string };
        assert<eq<a, x>>();
    });
    it("`{ a: number, b: string }` ( required: c )", () => {
        type a = typeOfSchema<{
            type: "object";
            properties: { a: numberSchema; b: stringSchema };
            required: ["a", "b", "c"];
        }>;
        type x = { a: number; b: string };
        assert<eq<a, x>>();
    });
});
