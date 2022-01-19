import ts from "typescript";
import { error } from "../standard-extensions";
import { createTester } from "../ts-eslint-tester-extensions";
import rule, {
    findSideEffectNode,
    getPrecedence,
    isDirectiveExpression,
    Precedence,
} from "./no-unused-pure-expression";

function createVirtualHost(
    initialFiles: Iterable<readonly [fileName: string, contents: string]>
): ts.CompilerHost {
    const virtualFs = new Map<string, string>(initialFiles);
    return {
        getSourceFile(fileName, languageVersion) {
            const sourceText =
                virtualFs.get(fileName) || ts.sys.readFile(fileName);
            return sourceText !== undefined
                ? ts.createSourceFile(fileName, sourceText, languageVersion)
                : undefined;
        },
        getDefaultLibFileName(options) {
            return ts.getDefaultLibFilePath(options);
        },
        writeFile(fileName, content) {
            virtualFs.set(fileName, content);
        },
        fileExists(fileName) {
            return virtualFs.has(fileName) || ts.sys.fileExists(fileName);
        },
        readFile(fileName) {
            return virtualFs.get(fileName) || ts.sys.readFile(fileName);
        },
        getCanonicalFileName(fileName) {
            return this.useCaseSensitiveFileNames()
                ? fileName
                : fileName.toLowerCase();
        },
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine() {
            return ts.sys.newLine;
        },
        useCaseSensitiveFileNames() {
            return ts.sys.useCaseSensitiveFileNames;
        },
    };
}
function tsFile(template: TemplateStringsArray, ...substitutions: unknown[]) {
    const source = String.raw(template, ...substitutions);
    const fileName = "test.ts";
    const host = createVirtualHost([[fileName, source]]);
    const program = ts.createProgram({
        rootNames: [fileName],
        host,
        options: { target: ts.ScriptTarget.ES2015 },
    });
    const diagnostics = [
        ...program.getOptionsDiagnostics(),
        ...program.getSyntacticDiagnostics(),
        ...program.getSemanticDiagnostics(),
    ];
    if (diagnostics.length !== 0) {
        throw new Error(ts.formatDiagnostics(diagnostics, host));
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return { program, sourceFile: program.getSourceFile(fileName)! };
}
function tsExpr(template: TemplateStringsArray, ...substitutions: unknown[]) {
    const file = tsFile`${String.raw(template, ...substitutions)};`;
    const s0 = file.sourceFile.statements[0] ?? error`no statement`;
    return ts.isExpressionStatement(s0)
        ? { ...file, expression: s0.expression }
        : error`no expression`;
}
function print(node: ts.Node | undefined) {
    if (!node) {
        return undefined;
    }
    return ts
        .createPrinter()
        .printNode(ts.EmitHint.Unspecified, node, node.getSourceFile());
}
it("findSideEffectNode", () => {
    const { sourceFile, program } = tsFile`1 === 1;`;
    const sideEffectNode = findSideEffectNode(
        program.getTypeChecker(),
        sourceFile
    );
    expect(print(sideEffectNode)).toBe(undefined);
    sourceFile;
});
describe("getPrecedence", () => {
    it("===", () => {
        expect(getPrecedence(tsExpr`1 === 1`.expression)).toBe(
            Precedence.EqualsEquals
        );
    });
    it("0", () => {
        expect(getPrecedence(tsExpr`0`.expression)).toBe(
            Precedence.Parenthesis
        );
    });
});
it("isDirectiveExpression", () => {
    const { sourceFile } = tsFile`"use strict";`;
    const s0 = sourceFile.statements[0] ?? error`no statement`;
    const e0 = ts.isExpressionStatement(s0)
        ? s0.expression
        : error`no expression`;
    expect(isDirectiveExpression(e0)).toBe(true);
});
function pureStatementInvalid(
    code: string,
    output: string,
    output1: string,
    output2: string
) {
    return {
        code,
        output,
        errors: [
            {
                messageId: "remove_unused_expressions",
                suggestions: [
                    {
                        messageId: "add_void_to_explicitly_ignore_the_value",
                        output: output1,
                    },
                    {
                        messageId: "assign_to_a_new_variable",
                        output: output2,
                    },
                ],
            },
        ],
    } as const;
}
function pureSequenceInvalid(code: string, output: string, output1: string) {
    return {
        code,
        output,
        errors: [
            {
                messageId: "remove_unused_expressions",
                suggestions: [
                    {
                        messageId: "add_void_to_explicitly_ignore_the_value",
                        output: output1,
                    },
                ],
            },
        ],
    } as const;
}
const tester = createTester();
tester.run("no-unused-pure-expression", rule, {
    valid: [
        // 副作用のある式
        {
            code: `Date.now();`,
        },
        {
            code: `var _ = (Date.now(), 0);`,
        },
        // 副作用のある式 (number + object)
        {
            code: `1 + { valueOf() { console.log(); return 2 } };`,
        },
        // ディレクティブには何もしない
        {
            code: `"use strict"; "unknown directive";`,
        },
        {
            code: `"unknown directive"; "use strict";`,
        },
        // undefined 型
        {
            code: `undefined;`,
        },
    ],
    invalid: [
        // 本当に純粋な式は自動削除できる
        pureStatementInvalid(`0;`, ``, `void 0;`, `const x = 0;`),
        pureStatementInvalid(
            `0 === 0;`,
            ``,
            `void (0 === 0);`,
            `const x = 0 === 0;`
        ),
        pureSequenceInvalid(
            `(0, console.log());`,
            `( console.log());`,
            `(void 0, console.log());`
        ),
        // 純粋な式 ( number + number )
        pureStatementInvalid(`1 + 2;`, ``, `void (1 + 2);`, `const x = 1 + 2;`),
        // ディレクティブっぽいけどディレクティブでない式
        pureStatementInvalid(
            `console.log(); "use strict";`,
            `console.log(); `,
            `console.log(); void "use strict";`,
            `console.log(); const x = "use strict";`
        ),
        pureStatementInvalid(
            `console.log(); "unknown directive";`,
            `console.log(); `,
            `console.log(); void "unknown directive";`,
            `console.log(); const x = "unknown directive";`
        ),
    ],
});
