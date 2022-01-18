import ts from "typescript";
import {
    hasLocationMap,
    LocationMap,
    newLocationMap,
    setLocationMap,
} from "./location-map";

/** @internal */
export type DeclarationSet = LocationMap<ts.Declaration>;
/** @internal */
export const newDeclarationSet: () => DeclarationSet = newLocationMap;

/** @internal */
export function hasDeclarationSet<T>(
    set: LocationMap<T>,
    declaration: ts.Declaration
) {
    return hasLocationMap(
        set,
        declaration.getSourceFile().fileName,
        declaration.getStart()
    );
}
/** @internal */
export function setDeclarationSet(
    set: DeclarationSet,
    declaration: ts.Declaration
) {
    return setLocationMap(
        set,
        declaration.getSourceFile().fileName,
        declaration.getStart(),
        declaration
    );
}
/** @internal */
export function popDeclarationSet(set: DeclarationSet) {
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
/** @internal */
export function isEmptyDeclarationSet(set: DeclarationSet) {
    return set.size === 0;
}
