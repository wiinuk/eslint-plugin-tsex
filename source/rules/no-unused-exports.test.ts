import rule from "./no-unused-exports";
import { createProgramFileValidator } from "../program-file-validator";
import fs from "fs";
import path from "path";

function readTestFile(name: string) {
    return fs.readFileSync(
        path.join(__dirname, `./no-unused-exports.test.files/${name}.ts`),
        "utf8"
    );
}
function messageMatcher({ line, name }: { line: number; name: string }) {
    return {
        line,
        message: expect.stringMatching(`'${name}'`),
        messageId: "__varName__is_declared_but_never_used",
        suggestions: [
            {
                messageId: "remove_unused_element",
            },
        ],
    } as const;
}
function reportMatcher(...messages: [line: number, name: string][]) {
    return {
        fixed: false,
        messages: messages.map(([line, name]) =>
            messageMatcher({ line, name })
        ),
    };
}

const validator = createProgramFileValidator({
    ruleName: "no-unused-exports",
    rule,
    sourceFiles: [
        {
            filePath: "/dir/lib.ts",
            source: readTestFile("lib"),
        },
        {
            filePath: "/dir/main.ts",
            source: readTestFile("main"),
        },
    ],
});
describe("main.ts, lib.ts", () => {
    it("標準設定", () => {
        expect(validator.validateFile("/dir/main.ts")).toMatchObject(
            reportMatcher([5, "main"], [10, "_a"], [32, "Main"], [33, "_A"])
        );
        expect(validator.validateFile("/dir/lib.ts")).toMatchObject(
            reportMatcher([3, "sub"], [7, "Sub"])
        );
    });
    it("無視設定", () => {
        function validate(path: string) {
            return validator.validateFile(path, {
                options: [{ ignorePattern: "^_" }],
            });
        }
        expect(validate("/dir/main.ts")).toMatchObject(
            reportMatcher([5, "main"], [32, "Main"])
        );
        expect(validate("/dir/lib.ts")).toMatchObject(
            reportMatcher([3, "sub"], [7, "Sub"])
        );
    });
    describe("ルート指定", () => {
        it("設定ファイル", () => {
            function validate(path: string) {
                return validator.validateFile(path, {
                    options: [{ roots: ["/dir/main", "main"] }],
                });
            }
            expect(validate("/dir/main.ts")).toStrictEqual(
                {}
                // reportMatcher(
                //     [10, "_a"],
                //     [15, "isEven"],
                //     [23, "isOdd"],
                //     [33, "_A"],
                //     [35, "IsEven"],
                //     [39, "IsOdd"]
                // )
            );
        });
    });
});
