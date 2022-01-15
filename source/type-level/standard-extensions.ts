export type defaultValue<TDefaultValue, TNullable> = TNullable extends
    | undefined
    | null
    ? TDefaultValue
    : TNullable;

export type getOrUndefined<T, K> = K extends keyof T ? T[K] : undefined;

export type kind<TKind, T extends TKind> = T;
export type cast<TKind, T> = T extends TKind ? T : TKind;
export type eq<T, S> = [T] extends [S]
    ? [S] extends [T]
        ? true
        : false
    : false;
