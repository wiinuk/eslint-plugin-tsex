import ts from "typescript";
import { DeclarationSet, setDeclarationSet } from "./declaration-set";

/** @internal */
export function getPosition(source: ts.SourceFile, position: number) {
    const { line, character } = source.getLineAndCharacterOfPosition(position);
    return {
        line: line + 1,
        column: character,
    };
}
/** @internal */
export function getLocation(
    sourceFile: ts.SourceFile,
    start: number,
    end: number
) {
    return {
        start: getPosition(sourceFile, start),
        end: getPosition(sourceFile, end),
    };
}
/** @internal */
export function getExportSymbols(
    program: ts.Program,
    sourceFile: ts.SourceFile
) {
    const checker = program.getTypeChecker();
    const sourceFileSymbol = checker.getSymbolAtLocation(sourceFile);
    if (sourceFileSymbol === undefined) return;
    return checker.getExportsOfModule(sourceFileSymbol);
}
/** @internal */
export function forEachExports(
    program: ts.Program,
    sourceFile: ts.SourceFile,
    action: (declaration: ts.Declaration) => void
) {
    getExportSymbols(program, sourceFile)?.forEach((s) =>
        s.declarations?.forEach(action)
    );
}
/** @internal */
export function collectExports(
    program: ts.Program,
    sourceFile: ts.SourceFile,
    result: DeclarationSet
) {
    return forEachExports(program, sourceFile, (d) =>
        setDeclarationSet(result, d)
    );
}
