import { Linter } from "@typescript-eslint/experimental-utils/dist/ts-eslint";
import { id } from "./standard-extensions";
import noUnusedOptionalChain from "./rules/no-unused-optional-chain";
import noUnusedAwait from "./rules/no-unused-await";
import noUnusedPureExpression from "./rules/no-unused-pure-expression";

export = id<Linter.Plugin>({
    rules: {
        "no-unused-optional-chain": noUnusedOptionalChain,
        "no-unused-await": noUnusedAwait,
        "no-unused-pure-expression": noUnusedPureExpression,
    },
});
