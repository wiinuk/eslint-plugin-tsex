type FileName = string;
type Position = number;

const locationMapBrandSymbol = Symbol("_locationMapBrand");
/** @internal */
export type LocationMap<T> = Map<FileName, Map<Position, T>> & {
    [locationMapBrandSymbol]: unknown;
};

/** @internal */
export function newLocationMap<T>() {
    return new Map() as LocationMap<T>;
}
/** @internal */
export function hasLocationMap<T>(
    map: LocationMap<T>,
    fileName: FileName,
    position: Position
) {
    return !!map.get(fileName)?.has(position);
}
/** @internal */
export function setLocationMap<T>(
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
/** @internal */
export function forEachLocationMap<T>(
    map: LocationMap<T>,
    action: (value: T, fileName: FileName, position: Position) => void
) {
    return map.forEach((fileMap, fileName) =>
        fileMap.forEach((value, position) => action(value, fileName, position))
    );
}
