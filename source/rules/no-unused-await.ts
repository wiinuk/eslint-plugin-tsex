import ts from "typescript";
import * as tsutils from "tsutils";
import { TSESLint } from "@typescript-eslint/experimental-utils";
import { error, id } from "../standard-extensions";

function isFunctionType(
    checker: ts.TypeChecker,
    symbol: ts.Symbol,
    location: ts.Node
) {
    const symbolType = checker.getTypeOfSymbolAtLocation(symbol, location);
    for (const t of tsutils.unionTypeParts(symbolType)) {
        if (t.getCallSignatures().length !== 0) {
            return true;
        }
    }
    return false;
}
function isPromiseLike(checker: ts.TypeChecker, node: ts.Node) {
    const nodeType = checker.getTypeAtLocation(node);
    for (const t of tsutils.unionTypeParts(checker.getApparentType(nodeType))) {
        // then プロパティがあるか
        const then = t.getProperty("then");
        if (then === undefined) {
            continue;
        }

        const thenType = checker.getTypeOfSymbolAtLocation(then, node);
        for (const t of tsutils.unionTypeParts(thenType)) {
            if (
                t.getCallSignatures().some(
                    ({ parameters }) =>
                        // 引数が2つの関数を受け取るか
                        2 <= parameters.length &&
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        isFunctionType(checker, parameters[0]!, node) &&
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        isFunctionType(checker, parameters[1]!, node)
                )
            ) {
                return true;
            }
        }
    }
    return false;
}
function getPosition(sourceFile: ts.SourceFile, position: number) {
    const { line, character } =
        sourceFile.getLineAndCharacterOfPosition(position);
    return {
        line: line + 1,
        column: character,
    };
}
function getLocation(sourceFile: ts.SourceFile, start: number, end: number) {
    return {
        start: getPosition(sourceFile, start),
        end: getPosition(sourceFile, end),
    };
}

type MessageIds = "remove_unneeded_await";

export default id<TSESLint.RuleModule<MessageIds>>({
    meta: {
        docs: {
            description: "Detect unneeded 'await'.",
            recommended: "warn",
            suggestion: true,
            requiresTypeChecking: true,
        },
        fixable: "code",
        hasSuggestions: true,
        messages: {
            remove_unneeded_await: "Remove unneeded 'await'.",
        },
        schema: [],
        type: "suggestion",
    },
    create(context) {
        const parserServices =
            context.parserServices ?? error`parserServices is undefined`;
        const checker = parserServices.program.getTypeChecker();

        return {
            AwaitExpression(node) {
                const awaitExpression =
                    parserServices.esTreeNodeToTSNodeMap.get(node);
                const argument = awaitExpression.expression;

                if (!isPromiseLike(checker, argument)) {
                    const start = awaitExpression.getStart();
                    const end = argument.getFullStart();

                    context.report({
                        loc: getLocation(
                            awaitExpression.getSourceFile(),
                            start,
                            end
                        ),
                        messageId: "remove_unneeded_await",
                        fix(fixer) {
                            return fixer.removeRange([start, end]);
                        },
                    });
                }
            },
        };
    },
});
