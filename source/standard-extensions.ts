export function error(
    template: TemplateStringsArray,
    ...substitutions: unknown[]
): never {
    throw new Error(String.raw(template, ...substitutions));
}
export function unreachable() {
    return error`Unreachable`;
}
