import { TSESLint } from "@typescript-eslint/experimental-utils";
import ts, { __String } from "typescript";
import { DeclarationSet, setDeclarationSet } from "./declaration-set";
import { getParserServicesOrError } from "./ts-eslint-extensions";
import RuleContext = TSESLint.RuleContext;
import * as path from "path";
import { collectExports, getExportSymbols } from "./ts-node-extensions";

type ReportDescriptorWithoutLocation<TMessageIds extends string> = Omit<
    TSESLint.ReportDescriptor<TMessageIds>,
    "loc" | "node"
>;

/** @internal */
export interface RootCollector<
    TMessageIds extends string,
    TOptions extends readonly unknown[]
> {
    context: RuleContext<TMessageIds, TOptions>;
    checker: ts.TypeChecker;
    program: ts.Program;
    rootDeclarations: DeclarationSet;
    configLoadErrors: ReportDescriptorWithoutLocation<TMessageIds>[];
    createRootFileNotFoundError: (
        rootFile: string
    ) => ReportDescriptorWithoutLocation<TMessageIds>;
    createExportNameNotFoundError: (
        rootFile: string,
        exportName: string
    ) => ReportDescriptorWithoutLocation<TMessageIds>;
}
/** @internal */
export function createCollector<
    TMessageIds extends string,
    TOptions extends readonly unknown[]
>(
    context: RuleContext<TMessageIds, TOptions>,
    rootDeclarations: DeclarationSet,
    configLoadErrors: ReportDescriptorWithoutLocation<TMessageIds>[],
    createRootFileNotFoundError: RootCollector<
        TMessageIds,
        TOptions
    >["createRootFileNotFoundError"],
    createExportNameNotFoundError: RootCollector<
        TMessageIds,
        TOptions
    >["createExportNameNotFoundError"]
): RootCollector<TMessageIds, TOptions> {
    const parserServices = getParserServicesOrError(context);
    const { program } = parserServices;
    return {
        context,
        checker: program.getTypeChecker(),
        program,
        rootDeclarations,
        configLoadErrors,
        createRootFileNotFoundError,
        createExportNameNotFoundError,
    };
}

/** @internal */
export function appendRoot<
    TMessageIds extends string,
    TOptions extends readonly unknown[]
>(
    {
        context,
        checker,
        program,
        rootDeclarations,
        configLoadErrors,
        createRootFileNotFoundError,
        createExportNameNotFoundError,
    }: RootCollector<TMessageIds, TOptions>,
    rootFile: string,
    exportName: string | undefined
) {
    // 絶対パスに変換
    if (!path.isAbsolute(rootFile) && context.getCwd) {
        rootFile = path.join(context.getCwd(), rootFile);
    }
    // ソースファイルを取得
    const sourceFile = program.getSourceFile(rootFile);
    if (sourceFile === undefined) {
        configLoadErrors.push(createRootFileNotFoundError(rootFile));
        return;
    }
    if (exportName === undefined) {
        // エクスポート名が指定されていないなら全てのエクスポートを対象にする
        collectExports(program, sourceFile, rootDeclarations);
    } else {
        // エクスポート名が指定されているなら名前が一致するエクスポートを対象にする
        const exportSymbols = (
            getExportSymbols(program, sourceFile) ?? []
        ).filter((s) => checker.symbolToString(s) === exportName);

        if (exportSymbols.length === 0) {
            configLoadErrors.push(
                createExportNameNotFoundError(exportName, rootFile)
            );
        } else {
            exportSymbols.forEach((s) =>
                s.declarations?.forEach((d) =>
                    setDeclarationSet(rootDeclarations, d)
                )
            );
        }
    }
}
