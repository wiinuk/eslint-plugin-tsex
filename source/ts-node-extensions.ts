import ts from "typescript";

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
