/** @internal */
export function error(
    template: TemplateStringsArray,
    ...substitutions: unknown[]
): never {
    throw new Error(String.raw(template, ...substitutions));
}
/** @internal */
export function unreachable() {
    return error`Unreachable`;
}
/** @internal */
export function id<T>(x: T) {
    return x;
}
