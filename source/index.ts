import { Linter } from "@typescript-eslint/experimental-utils/dist/ts-eslint";
import { id } from "./standard-extensions";
import noUnusedOptionalChain from "./rules/no-unused-optional-chain";

export = id<Linter.Plugin>({
    rules: {
        "no-unused-optional-chain": noUnusedOptionalChain,
    },
});
