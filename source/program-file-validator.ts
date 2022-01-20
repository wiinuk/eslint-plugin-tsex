import { TSESLint } from "@typescript-eslint/experimental-utils";
import ts, { ModuleResolutionKind } from "typescript";
import {
    parseAndGenerateServices,
    visitorKeys,
} from "@typescript-eslint/typescript-estree";
import { analyze } from "@typescript-eslint/scope-manager";
import { error } from "./standard-extensions";
import { createVirtualHost } from "./ts-node-extensions";

type Primitive = undefined | null | boolean | number | bigint | string | symbol;
type DeepNonReadonly<T> = T extends Primitive
    ? T
    : { -readonly [P in keyof T]: DeepNonReadonly<T[P]> };

interface CreateValidatorOptions<
    TMessages extends string,
    TOptions extends readonly unknown[]
> {
    rule: TSESLint.RuleModule<TMessages, TOptions>;
    ruleName: string;
    sourceFiles: Iterable<Readonly<{ filePath: string; source: string }>>;
}
interface ValidateSettings<TOptions extends readonly unknown[]> {
    options?: TOptions;
}
/** @internal */
export function createProgramFileValidator<
    TMessages extends string,
    TOptions extends readonly unknown[]
>({
    ruleName,
    rule,
    sourceFiles,
}: Readonly<CreateValidatorOptions<TMessages, TOptions>>) {
    const locale = Intl.NumberFormat().resolvedOptions().locale;

    const files = Array.from(sourceFiles);
    const host = createVirtualHost(
        files.map(({ filePath, source }) => [filePath, source])
    );
    const program = ts.createProgram({
        host,
        rootNames: files.map(({ filePath }) => filePath),
        options: {
            locale,
            target: ts.ScriptTarget.ES2015,
            moduleResolution: ModuleResolutionKind.NodeJs,
        },
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length !== 0) {
        return error`${ts.formatDiagnostics(diagnostics, host)}`;
    }
    function getSourceText(filePath: string) {
        return (
            program.getSourceFile(filePath)?.getText() ??
            error`'${filePath}' にソースコードが見つかりませんでした。`
        );
    }

    const parser = "@typescript-eslint/parser";
    const parserModule: TSESLint.Linter.ParserModule = {
        parseForESLint(code, options) {
            const filePath = options?.filePath;
            if (code !== "" || filePath === undefined) {
                return error`コードを指定することはできません。options.filePath でソースコードのパスを指定してください。`;
            }
            code = getSourceText(filePath);
            const { ast, services } = parseAndGenerateServices(code, {
                filePath,
                errorOnTypeScriptSyntacticAndSemanticIssues: true,
                errorOnUnknownASTType: true,
                programs: [program],
                tokens: true,
                comment: true,
                loc: true,
                range: true,
            });
            const analyzeOptions = {};
            const mutableVisitorKeys: DeepNonReadonly<typeof visitorKeys> =
                Object.create(null);
            for (const k of Object.keys(visitorKeys)) {
                const keys = visitorKeys[k];
                mutableVisitorKeys[k] = keys ? Array.from(keys) : undefined;
            }
            return {
                ast,
                services,
                parserServices: services,
                visitorKeys: JSON.parse(JSON.stringify(visitorKeys)),
                scopeManager: analyze(ast, analyzeOptions),
            };
        },
    };
    const linter = new TSESLint.Linter();
    linter.defineParser(parser, parserModule);
    linter.defineRule(ruleName, rule);

    return {
        validateFile(
            filename: string,
            settings: Readonly<ValidateSettings<TOptions>> = {}
        ) {
            const { options = [] } = settings;
            return linter.verifyAndFix(
                "",
                {
                    parser,
                    rules: {
                        [ruleName]: ["error", ...options],
                    },
                },
                { filename }
            );
        },
    };
}
