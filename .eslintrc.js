//@ts-check
/** @type {import("eslint").Linter.Config<import("eslint").Linter.RulesRecord>} */
const config = {
    root: true,
    env: {
        es6: true,
        browser: true,
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 2018,
        ecmaFeatures: {
            jsx: true,
        },
        sourceType: "module",
        project: "./tsconfig.json",
    },
    plugins: ["@typescript-eslint"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
    ],
    ignorePatterns: "*.js",
    rules: {
        "@typescript-eslint/no-floating-promises": [
            "warn",
            { ignoreVoid: true },
        ],
        "object-shorthand": "warn",
        "no-useless-rename": "warn",
        "no-duplicate-imports": "warn",
    },
};
module.exports = config;
