import ts from "typescript";

export function getPosition(source: ts.SourceFile, position: number) {
    const { line, character } = source.getLineAndCharacterOfPosition(position);
    return {
        line: line + 1,
        column: character,
    };
}
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
