import * as tsutils from "tsutils";
import ts from "typescript";
import { TSESLint } from "@typescript-eslint/experimental-utils";
import { error, id, unreachable } from "../standard-extensions";

const nullOrUndefinedTypeFlag = ts.TypeFlags.Null | ts.TypeFlags.Undefined;

function isNullableType(checker: ts.TypeChecker, node: ts.Node) {
    const nodeType = checker.getTypeAtLocation(node);
    for (const t of tsutils.unionTypeParts(checker.getApparentType(nodeType))) {
        if (t.flags & nullOrUndefinedTypeFlag) return true;
    }
    return false;
}
function getPosition(source: ts.SourceFile, position: number) {
    const { line, character } = source.getLineAndCharacterOfPosition(position);
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

type MessageIds =
    | "DEBUG_show"
    | "replace_unneeded_QuestionDot_with_Dot"
    | "remove_unneeded_QuestionDot";

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
            DEBUG_show: "{{message}}",
            replace_unneeded_QuestionDot_with_Dot:
                "Replace unneeded '?.' with '.'.",
            remove_unneeded_QuestionDot: "Remove unneeded '?.'.",
        },
        schema: [],
        type: "suggestion",
    },
    create(context) {
        const parserServices =
            context.parserServices ?? error`No parser services available`;
        const checker = parserServices.program.getTypeChecker();

        return {
            MemberExpression(node) {
                if (!node.optional) return;
                // `o.p` や `o[k]` のような場合

                const member = parserServices.esTreeNodeToTSNodeMap.get(node);

                if (!isNullableType(checker, member.expression)) {
                    const { questionDotToken = unreachable() } = member;
                    const start = questionDotToken.getStart();
                    const end = questionDotToken.getEnd();
                    const loc = getLocation(member.getSourceFile(), start, end);
                    const range = [start, end] as const;

                    if (ts.isPropertyAccessExpression(member)) {
                        // `o.?p` のような場合 `o.p` に置き換え
                        context.report({
                            loc,
                            messageId: "replace_unneeded_QuestionDot_with_Dot",
                            fix(fixer) {
                                return fixer.replaceTextRange(range, ".");
                            },
                        });
                    } else {
                        // `o.?[k]` のような場合 `o[k]` に置き換え
                        context.report({
                            loc,
                            messageId: "remove_unneeded_QuestionDot",
                            fix(fixer) {
                                return fixer.removeRange(range);
                            },
                        });
                    }
                }
            },
        };
    },
});
