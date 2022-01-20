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
it("main.ts", () => {
    expect(validator.validateFile("/dir/main.ts")).toMatchObject({
        fixed: false,
        messages: [
            messageMatcher({ line: 5, name: "main" }),
            messageMatcher({ line: 10, name: "_a" }),
            messageMatcher({ line: 32, name: "Main" }),
            messageMatcher({ line: 33, name: "_A" }),
        ],
    });
});
it("lib.ts", () => {
    expect(validator.validateFile("/dir/lib.ts")).toMatchObject({
        fixed: false,
        messages: [
            messageMatcher({ line: 3, name: "sub" }),
            messageMatcher({ line: 7, name: "Sub" }),
        ],
    });
});
