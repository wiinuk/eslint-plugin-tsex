/** @internal */
export type defaultValue<TDefaultValue, TNullable> = TNullable extends
    | undefined
    | null
    ? TDefaultValue
    : TNullable;

/** @internal */
export type getOrUndefined<T, K> = K extends keyof T ? T[K] : undefined;

/** @internal */
export type kind<TKind, T extends TKind> = T;
/** @internal */
export type cast<TKind, T> = T extends TKind ? T : TKind;
/** @internal */
export type eq<T, S> = [T] extends [S]
    ? [S] extends [T]
        ? true
        : false
    : false;

/** @internal */
export type NonReadonly<T> = { -readonly [k in keyof T]: T[k] };
