export const add = (a: number, b: number) => a + b;
// 未使用
export const sub = (a: number, b: number) => a - b;

export type Add<a extends unknown[], b extends unknown[]> = [...a, ...b];
// 未使用
export type Sub<a extends unknown[], b extends unknown[]> = [...a, ...b]; // テスト用適当実装
