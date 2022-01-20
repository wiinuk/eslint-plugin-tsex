import { Add, add } from "./lib";

// ルート
// 未使用 ( ルート未指定時 )
export const main = () => {
    console.log(add(1, 2));
};

// 使用 ( 無視設定時 )
export function _a() {
    return 10;
}

// 未使用 ( ルート指定時 )
export function isEven(n: number): boolean {
    if (n === 0) {
        return true;
    } else {
        return isOdd(n - 1);
    }
}
// 未使用 ( ルート指定時 )
export function isOdd(n: number): boolean {
    if (n === 0) {
        return false;
    } else {
        return isEven(n - 1);
    }
}

/** @entry */
export type Main = Add<[0], [0, 0]>;
export type _A = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export type IsEven<n extends unknown[]> = n extends [unknown, ...infer rest]
    ? IsOdd<rest>
    : true;

export type IsOdd<n extends unknown[]> = n extends [unknown, ...infer rest]
    ? IsEven<rest>
    : false;
