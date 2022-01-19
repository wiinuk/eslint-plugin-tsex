import ts from "typescript";
import {
    DeclarationSet,
    hasDeclarationSet,
    newDeclarationSet,
    popDeclarationSet,
    setDeclarationSet,
} from "./declaration-set";
import { forEachLocationMap } from "./location-map";

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
/** @internal */
export function collectAllReferencedDeclarations(
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

/** @internal */
export function resolveUsingDeclarationsByRoots(
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
