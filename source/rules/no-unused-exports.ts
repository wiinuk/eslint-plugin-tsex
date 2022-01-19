import utils from "@typescript-eslint/experimental-utils";
import ts from "typescript";
import {
    DeclarationSet,
    hasDeclarationSet,
    isEmptyDeclarationSet,
    newDeclarationSet,
    setDeclarationSet,
} from "../declaration-set";
import { forEachLocationMap } from "../location-map";
import {
    collectAllReferencedDeclarations,
    resolveUsingDeclarationsByRoots,
} from "../alive-declaration-resolver";
import { createRule, getParserServicesOrError } from "../ts-eslint-extensions";
import { appendRoot, createCollector, RootCollector } from "../root-collector";
import { collectExports, forEachExports } from "../ts-node-extensions";

type RuleContext = Parameters<typeof rule["create"]>[0];
type ReportDescriptorWithoutLocation = Omit<
    Parameters<RuleContext["report"]>[0],
    "loc" | "node"
>;

function forEachSourceFilesWithoutExternalLibrary(
    context: RuleContext,
    action: (sourceFile: ts.SourceFile) => void
) {
    const { program } = getParserServicesOrError(context);
    for (const sourceFile of program.getSourceFiles()) {
        if (
            program.isSourceFileDefaultLibrary(sourceFile) ||
            program.isSourceFileFromExternalLibrary(sourceFile)
        ) {
            continue;
        }
        action(sourceFile);
    }
}
function resolveUsingDeclarationsByAnyFile(context: RuleContext) {
    const referencedDeclarations = newDeclarationSet();
    const { program } = getParserServicesOrError(context);
    forEachSourceFilesWithoutExternalLibrary(context, (sourceFile) => {
        collectAllReferencedDeclarations(
            program,
            sourceFile,
            referencedDeclarations
        );
    });
    return referencedDeclarations;
}
const defaultTootTagNames = ["root", "entrypoint"];
function resolveRootsByJsDocTag(context: RuleContext) {
    const { program } = getParserServicesOrError(context);
    const { rootTags } = context.options[0];
    const rootTagNames =
        rootTags === true ? defaultTootTagNames : rootTags ? rootTags : [];

    const result = newDeclarationSet();
    forEachSourceFilesWithoutExternalLibrary(context, (sourceFile) => {
        forEachExports(program, sourceFile, (exported) => {
            for (const tag of ts.getJSDocTags(exported)) {
                if (rootTagNames.includes(tag.tagName.text)) {
                    setDeclarationSet(result, exported);
                }
            }
        });
    });
    return result;
}

interface ProgramSemantics {
    configLoadErrors: ReportDescriptorWithoutLocation[];
    aliveSet: DeclarationSet;
}
function checkAllFileSemantics(context: RuleContext): ProgramSemantics {
    const { roots = [] } = context.options[0];
    const configLoadErrors: ReportDescriptorWithoutLocation[] = [];

    const rootDeclarations = resolveRootsByJsDocTag(context);
    if (roots.length === 0 && isEmptyDeclarationSet(rootDeclarations)) {
        // roots が見つからないなら
        // どれかのソースファイルで参照されている宣言のみを使用していると判定する。
        // この場合、自己参照している宣言は常に使用しているとみなされる。
        const aliveSet = resolveUsingDeclarationsByAnyFile(context);
        return {
            configLoadErrors,
            aliveSet,
        };
    } else {
        const collector = createCollector(
            context,
            rootDeclarations,
            configLoadErrors,
            (rootFile) => ({
                messageId: "__rootFile__not_found",
                data: { rootFile },
            }),
            (rootFile, exportName) => ({
                messageId: "could_not_find_the__exportName__in__rootFile__",
                data: {
                    exportName,
                    rootFile,
                },
            })
        );
        // roots オプションが指定されているなら
        // ユーザーが指定したルートから辿れる宣言のみを使用していると判定する。
        // この場合、自己参照している宣言はルートからたどれる場合のみ使用しているとみなされる。
        collectRoots(collector, roots);

        const aliveSet = resolveUsingDeclarationsByRoots(
            getParserServicesOrError(context).program,
            rootDeclarations
        );

        return {
            configLoadErrors,
            aliveSet,
        };
    }
}
interface Reporter {
    context: RuleContext;
    ignoreRegex: RegExp | null;
    parserServices: utils.ParserServices;
}
function reportUnusedDeclaration(
    { context, ignoreRegex, parserServices }: Reporter,
    declaration: ts.Declaration
) {
    // 名前を表す要素を取得
    const declarationName = ts.getNameOfDeclaration(declaration);
    const varName = declarationName?.getText();

    // 名前が無視パターンにマッチするなら無視する
    if (ignoreRegex && varName && ignoreRegex.test(varName)) return;

    // 宣言全体を報告すると鬱陶しいので、名前要素のみ報告する
    const reportNode = parserServices.tsNodeToESTreeNodeMap.get(
        declarationName ?? declaration
    );
    const suggest: Parameters<typeof context.report>[0]["suggest"] = [
        {
            messageId: "remove_unused_element",
            fix(fixer) {
                return fixer.removeRange([
                    declaration.getStart(),
                    declaration.getEnd(),
                ]);
            },
        },
    ];
    if (varName === undefined) {
        context.report({
            node: reportNode,
            messageId: "this_export_is_declared_but_never_used",
            suggest,
        });
    } else {
        context.report({
            node: reportNode,
            messageId: "__varName__is_declared_but_never_used",
            data: { varName },
            suggest,
        });
    }
}
function collectRoots<
    TMessageIds extends string,
    TOptions extends readonly unknown[]
>(
    collector: RootCollector<TMessageIds, TOptions>,
    roots: NonNullable<Options[0]["roots"]>
) {
    for (const root of roots) {
        // ファイルの指定された名前の export 要素をルートに追加する
        typeof root === "string"
            ? appendRoot(collector, root, undefined)
            : appendRoot(collector, ...root);
    }
}
function checkProgram(
    context: RuleContext,
    programSemantics: ProgramSemantics,
    node: utils.TSESTree.Program
) {
    const { configLoadErrors, aliveSet } = programSemantics;
    const parserServices = getParserServicesOrError(context);
    const { program } = parserServices;

    for (const error of configLoadErrors) {
        context.report({ ...error, node });
    }

    const { ignorePattern = null } = context.options[0];
    const ignoreRegex = ignorePattern ? new RegExp(ignorePattern) : null;

    const reporter: Reporter = {
        context,
        ignoreRegex,
        parserServices,
    };
    // export されている要素をそれぞれに対して
    const exports = newDeclarationSet();
    const sourceFile = parserServices.esTreeNodeToTSNodeMap.get(node);
    collectExports(program, sourceFile, exports);
    forEachLocationMap(exports, (exportedDeclaration) => {
        // 生きているか確認
        if (hasDeclarationSet(aliveSet, exportedDeclaration)) return;
        // 生きていないなら報告
        reportUnusedDeclaration(reporter, exportedDeclaration);
    });
}

type Options = Parameters<typeof rule["create"]>[0]["options"];
const rule = createRule(
    {
        docs: {
            description: "Detect unused exports",
            recommended: "warn",
            suggestion: true,
            requiresTypeChecking: true,
        },
        hasSuggestions: true,
        messages: {
            DEBUG_message: "{{message}}",
            __varName__is_declared_but_never_used:
                "'{{varName}}' is declared but never used.",
            this_export_is_declared_but_never_used:
                "this export is declared but never used.",
            remove_unused_element: "remove unused element.",
            __rootFile__not_found: "'{{rootFile}}' not found.",
            could_not_find_the__exportName__in__rootFile__:
                "could not find the '{{exportName}}' in '{{rootFile}}'.",
        },
        type: "suggestion",
    },
    [
        {
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
                rootTags: {
                    anyOf: [
                        {
                            type: "boolean",
                        },
                        {
                            type: "array",
                            items: { type: "string" },
                        },
                    ],
                },
            },
            additionalProperties: false,
        },
    ] as const,
    (context) => {
        const programSemantics = checkAllFileSemantics(context);
        return {
            Program(node) {
                checkProgram(context, programSemantics, node);
            },
        };
    }
);
export default rule;
