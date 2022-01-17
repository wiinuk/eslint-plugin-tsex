//spell-checker: ignore TSESLint TSESTree
import utils, { TSESLint } from "@typescript-eslint/experimental-utils";
import ts from "typescript";
import path from "path";
import type { DeepMutableJson, ReadonlyJsonValue } from "../type-level/json";
import type { cast } from "../type-level/standard-extensions";
import type { SchemaList, typeOfSchema } from "../type-level/json-schema";

const error = (template: TemplateStringsArray, ...substitutions: unknown[]) => {
    throw new Error(String.raw(template, ...substitutions));
};

type FileName = string;
type Position = number;
const locationMapBrandSymbol = Symbol("_locationMapBrand");
type LocationMap<T> = Map<FileName, Map<Position, T>> & {
    [locationMapBrandSymbol]: unknown;
};

function newLocationMap<T>() {
    return new Map() as LocationMap<T>;
}
function hasLocationMap<T>(
    map: LocationMap<T>,
    fileName: FileName,
    position: Position
) {
    return !!map.get(fileName)?.has(position);
}
function setLocationMap<T>(
    map: LocationMap<T>,
    fileName: FileName,
    position: Position,
    value: T
) {
    let m = map.get(fileName);
    if (m === undefined) {
        map.set(fileName, (m = new Map()));
    }
    m.set(position, value);
}
function forEachLocationMap<T>(
    map: LocationMap<T>,
    action: (value: T, fileName: FileName, position: Position) => void
) {
    return map.forEach((fileMap, fileName) =>
        fileMap.forEach((value, position) => action(value, fileName, position))
    );
}

type DeclarationSet = LocationMap<ts.Declaration>;
const newDeclarationSet: () => DeclarationSet = newLocationMap;
function hasDeclarationSet<T>(
    set: LocationMap<T>,
    declaration: ts.Declaration
) {
    return hasLocationMap(
        set,
        declaration.getSourceFile().fileName,
        declaration.getStart()
    );
}
function setDeclarationSet(set: DeclarationSet, declaration: ts.Declaration) {
    return setLocationMap(
        set,
        declaration.getSourceFile().fileName,
        declaration.getStart(),
        declaration
    );
}
function popDeclarationSet(set: DeclarationSet) {
    for (const [fileName, fileMap] of set) {
        for (const [position, declaration] of fileMap) {
            fileMap.delete(position);
            if (fileMap.size === 0) {
                set.delete(fileName);
            }
            return declaration;
        }
    }
}
function isEmptyDeclarationSet(set: DeclarationSet) {
    return set.size === 0;
}

function getParserServicesOrError(context: RuleContext) {
    return context.parserServices ?? error`ParserServices not available`;
}

function getExportSymbols(program: ts.Program, sourceFile: ts.SourceFile) {
    const checker = program.getTypeChecker();
    const sourceFileSymbol = checker.getSymbolAtLocation(sourceFile);
    if (sourceFileSymbol === undefined) return;
    return checker.getExportsOfModule(sourceFileSymbol);
}
function forEachExports(
    program: ts.Program,
    sourceFile: ts.SourceFile,
    action: (declaration: ts.Declaration) => void
) {
    getExportSymbols(program, sourceFile)?.forEach((s) =>
        s.declarations?.forEach(action)
    );
}
function collectExports(
    program: ts.Program,
    sourceFile: ts.SourceFile,
    result: DeclarationSet
) {
    return forEachExports(program, sourceFile, (d) =>
        setDeclarationSet(result, d)
    );
}

function isReferenceIdentifier(
    checker: ts.TypeChecker,
    node: ts.Node
): node is ts.Identifier {
    if (!ts.isIdentifier(node)) {
        return false;
    }
    const identifierIsDeclarationName =
        checker
            .getSymbolAtLocation(node)
            ?.declarations?.some((d) => ts.getNameOfDeclaration(d) === node) ??
        false;
    return !identifierIsDeclarationName;
}

const AliasSymbolFlag = ts.SymbolFlags.Alias;
function resolveDeclarationsOfIdentifier(
    program: ts.Program,
    checker: ts.TypeChecker,
    identifier: ts.Identifier,
    result: DeclarationSet
) {
    let symbol = checker.getSymbolAtLocation(identifier);
    if (symbol === undefined) return;
    symbol =
        (symbol.flags & AliasSymbolFlag) !== 0
            ? checker.getAliasedSymbol(symbol)
            : symbol;

    const { declarations } = symbol;
    if (declarations === undefined) return;
    for (const declaration of declarations) {
        if (declaration === undefined) continue;
        const sourceFile = declaration.getSourceFile();
        if (
            program.isSourceFileFromExternalLibrary(sourceFile) ||
            program.isSourceFileDefaultLibrary(sourceFile)
        ) {
            continue;
        }
        setDeclarationSet(result, declaration);
    }
}
function collectAllReferencedDeclarations(
    program: ts.Program,
    node: ts.Node,
    result: DeclarationSet
) {
    const checker = program.getTypeChecker();
    function collect(node: ts.Node) {
        if (isReferenceIdentifier(checker, node)) {
            resolveDeclarationsOfIdentifier(program, checker, node, result);
        }
        node.forEachChild(collect);
    }
    collect(node);
}

function resolveUsingDeclarationsByRoots(
    program: ts.Program,
    roots: Readonly<DeclarationSet>
) {
    const aliveSet = newDeclarationSet();

    const visitingDeclarations = newDeclarationSet();
    forEachLocationMap(roots, (d) =>
        setDeclarationSet(visitingDeclarations, d)
    );

    let visitingDeclaration;
    while (
        // 訪問中セットから1つ抜き出す
        (visitingDeclaration = popDeclarationSet(visitingDeclarations))
    ) {
        // 既に生存確認済みなら次へ
        if (hasDeclarationSet(aliveSet, visitingDeclaration)) continue;
        setDeclarationSet(aliveSet, visitingDeclaration);

        // 訪問中の宣言を参照している宣言を訪問中セットに追加する
        collectAllReferencedDeclarations(
            program,
            visitingDeclaration,
            visitingDeclarations
        );
    }
    return aliveSet;
}

type RuleContext = Parameters<typeof rule["create"]>[0];
type ReportDescriptorWithoutLocation = Omit<
    Parameters<RuleContext["report"]>[0],
    "loc" | "node"
>;
interface RootCollector {
    context: RuleContext;
    checker: ts.TypeChecker;
    program: ts.Program;
    rootDeclarations: DeclarationSet;
    configLoadErrors: ReportDescriptorWithoutLocation[];
}
function createCollector(
    context: RuleContext,
    rootDeclarations: DeclarationSet,
    configLoadErrors: ReportDescriptorWithoutLocation[]
): RootCollector {
    const parserServices = getParserServicesOrError(context);
    const { program } = parserServices;
    return {
        context,
        checker: program.getTypeChecker(),
        program,
        rootDeclarations,
        configLoadErrors,
    };
}

function appendRoot(
    {
        context,
        checker,
        program,
        rootDeclarations,
        configLoadErrors,
    }: RootCollector,
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
        configLoadErrors.push({
            messageId: "__rootFile__not_found",
            data: { rootFile },
        });
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
            configLoadErrors.push({
                messageId: "could_not_find_the__exportName__in__rootFile__",
                data: {
                    exportName,
                    rootFile,
                },
            });
        } else {
            exportSymbols.forEach((s) =>
                s.declarations?.forEach((d) =>
                    setDeclarationSet(rootDeclarations, d)
                )
            );
        }
    }
}
function collectRoots(
    collector: RootCollector,
    roots: NonNullable<Options[0]["roots"]>
) {
    for (const root of roots) {
        // ファイルの指定された名前の export 要素をルートに追加する
        typeof root === "string"
            ? appendRoot(collector, root, undefined)
            : appendRoot(collector, ...root);
    }
}
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
        // 自己参照している宣言は使用しているとみなされる。
        const aliveSet = resolveUsingDeclarationsByAnyFile(context);
        return {
            configLoadErrors,
            aliveSet,
        };
    } else {
        const collector = createCollector(
            context,
            rootDeclarations,
            configLoadErrors
        );
        // roots オプションが指定されているなら
        // 指定されたルートから辿れる宣言のみを使用していると判定する。
        // 自己参照している宣言はルートからたどれる場合のみ使用しているとみなされる。
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
    reporter: Reporter,
    declaration: ts.Declaration
) {
    const { context, ignoreRegex, parserServices } = reporter;

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

    /** @type {Reporter} */
    const reporter = {
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

// spell-checker:ignore TSESLint
const clone = <T extends ReadonlyJsonValue>(json: T) =>
    JSON.parse(JSON.stringify(json)) as DeepMutableJson<T>;

type getMessageIds<TMessages extends MessagesKind> = cast<
    string,
    keyof TMessages
>;
type getOptions<TSchemas extends SchemaList> = {
    -readonly [i in keyof TSchemas]: typeOfSchema<TSchemas[i]>;
};

type MessagesKind = Record<string, string>;
type MetadataWithoutSchema<TMessages extends MessagesKind> = Omit<
    TSESLint.RuleMetaData<getMessageIds<TMessages>>,
    "schema"
> & {
    messages?: TMessages;
};

const createRule = <TMessages extends MessagesKind, TSchema extends SchemaList>(
    meta: MetadataWithoutSchema<TMessages>,
    schema: TSchema,
    create: TSESLint.RuleCreateFunction<
        getMessageIds<TMessages>,
        getOptions<TSchema>
    >
): TSESLint.RuleModule<getMessageIds<TMessages>, getOptions<TSchema>> => ({
    meta: { ...meta, schema: clone(schema) },
    create,
});

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
