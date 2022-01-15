/* eslint-disable no-fallthrough */
import { TSESTree } from "@typescript-eslint/experimental-utils";
import ts, { SyntaxKind } from "typescript";
import { error } from "../standard-extensions";
import { createRule } from "../ts-eslint-extensions";
import { NonReadonly } from "../type-level/standard-extensions";

function getUseStrictPosition(parent: ts.Node) {
    if (
        // `function f() { "use strict"; }`
        ts.isFunctionDeclaration(parent) ||
        // `class C { f() { "use strict"; } }`
        ts.isMethodDeclaration(parent) ||
        // `class C { constructor() { "use strict"; } }`
        ts.isConstructorDeclaration(parent) ||
        // `class C { get f() { "use strict"; } }`
        ts.isAccessor(parent) ||
        // `function() { "use strict"; }`
        ts.isFunctionExpression(parent) ||
        // `() => { "use strict"; }`
        ts.isArrowFunction(parent)
    ) {
        const { body } = parent;
        return body && ts.isBlock(body) ? body.statements[0] : body;
    }
    if (
        // `"use strict";`
        ts.isSourceFile(parent)
    ) {
        return parent.statements[0];
    }
}
function isDirective(expression: ts.Node) {
    if (ts.isStringLiteral(expression) && expression.text === "use strict") {
        return getUseStrictPosition(expression.parent) === expression;
    }
    return false;
}
function uniqueName(symbolTable: Set<ts.__String>, prefix: string) {
    if (!symbolTable.has(ts.escapeLeadingUnderscores(prefix))) {
        return prefix;
    }

    let counter = 1;
    let name;
    do {
        name = `${prefix}_${++counter}`;
    } while (symbolTable.has(ts.escapeLeadingUnderscores(name)));
    return name;
}
function findSideEffectNode(node: ts.Node) {
    function visit(node: ts.Node): ts.Node | undefined {
        if (ts.isBinaryExpression(node)) {
            switch (node.operatorToken.kind) {
                // 代入演算子
                // `=`
                case SyntaxKind.FirstAssignment:
                // `+=`
                case SyntaxKind.PlusEqualsToken:
                // `-=`
                case SyntaxKind.MinusEqualsToken:
                // `*=`
                case SyntaxKind.AsteriskEqualsToken:
                // `/=`
                case SyntaxKind.SlashEqualsToken:
                // `%=`
                case SyntaxKind.PercentEqualsToken:
                // `<<=`
                case SyntaxKind.LessThanLessThanEqualsToken:
                // `>>=`
                case SyntaxKind.GreaterThanGreaterThanEqualsToken:
                // `>>>=`
                case SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
                // `&=`
                case SyntaxKind.AmpersandEqualsToken:
                // `^=`
                case SyntaxKind.CaretEqualsToken:
                // `|=`
                case SyntaxKind.BarEqualsToken:

                // valueOf が呼ばれるかも
                // `==`
                case SyntaxKind.EqualsEqualsToken:
                // `!=`
                case SyntaxKind.ExclamationEqualsToken:
                // `<`
                case SyntaxKind.LessThanToken:
                // `>`
                case SyntaxKind.GreaterThanToken:
                // `<=`
                case SyntaxKind.LessThanEqualsToken:
                // `>=`
                case SyntaxKind.GreaterThanEqualsToken:
                // `<<`
                case SyntaxKind.LessThanLessThanToken:
                // `>>`
                case SyntaxKind.GreaterThanGreaterThanToken:
                // `>>>`
                case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                // `+`
                case SyntaxKind.PlusToken:
                // `-`
                case SyntaxKind.MinusToken:
                // `*`
                case SyntaxKind.AsteriskToken:
                // `/`
                case SyntaxKind.SlashToken:
                // `%`
                case SyntaxKind.PercentToken:
                // `&`
                case SyntaxKind.AmpersandToken:
                // `^`
                case SyntaxKind.CaretToken:
                // `|`
                case SyntaxKind.BarToken:
                // `in`
                case SyntaxKind.InKeyword:
                    return node;
            }
        }
        // `await e`
        if (ts.isAwaitExpression(node)) return node;
        // `f()`, `new C`, `f```, `@d`, `<t>`
        if (ts.isCallLikeExpression(node)) return node;
        // `delete e`
        if (ts.isDeleteExpression(node)) return node;
        if (ts.isPrefixUnaryExpression(node)) {
            switch (node.operator) {
                // 副作用
                // `++e`
                case SyntaxKind.PlusPlusToken:
                // `--e`
                case SyntaxKind.MinusMinusToken:

                // valueOf が呼ばれるかも
                // `-e`
                case SyntaxKind.MinusToken:
                // `+e`
                case SyntaxKind.PlusToken:
                // `!`
                case SyntaxKind.ExclamationToken:
                // `~`
                case SyntaxKind.TildeToken:
                    return node;
            }
        }
        // `e++`, `e--`
        if (ts.isPostfixUnaryExpression(node)) {
            return node;
        }
        // `yield e`
        if (ts.isYieldExpression(node)) return node;
        // `e.p``
        if (ts.isPropertyAccessExpression(node)) return node;
        // `e[i]`
        if (ts.isElementAccessExpression(node)) return node;

        return ts.forEachChild(node, visit);
    }
    return visit(node);
}
const enum Precedence {
    Parenthesis = 19,
    MaxValue = Parenthesis,
    Call = 18,
    NewWithoutParenthesis = 17,
    Postfix = 16,
    Prefix = 15,
    AsteriskAsterisk = 14,
    Asterisk = 13,
    Plus = 12,
    LessThanLessThan = 11,
    LessThan = 10,
    EqualsEquals = 9,
    Ampersand = 8,
    Caret = 7,
    Bar = 6,
    AmpersandAmpersand = 5,
    BarBar = 4,
    Conditional = 3,
    Equals = 2,
    Comma = 1,
    MinValue = Comma,
}
function getPrecedence(node: ts.Node) {
    if (ts.isParenthesizedExpression(node)) {
        return Precedence.Parenthesis;
    }
    if (
        ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node) ||
        // `new C()`
        (ts.isNewExpression(node) && node.arguments?.length !== undefined) ||
        ts.isCallExpression(node)
    ) {
        return Precedence.Call;
    }
    // `new C`
    if (ts.isNewExpression(node)) {
        return Precedence.NewWithoutParenthesis;
    }
    if (ts.isPostfixUnaryExpression(node)) {
        return Precedence.Postfix;
    }
    if (
        ts.isPrefixUnaryExpression(node) ||
        ts.isTypeOfExpression(node) ||
        ts.isVoidExpression(node) ||
        ts.isDeleteExpression(node) ||
        ts.isAwaitExpression(node)
    ) {
        return Precedence.Prefix;
    }
    if (ts.isBinaryExpression(node)) {
        switch (node.operatorToken.kind) {
            case SyntaxKind.AsteriskAsteriskToken:
                return Precedence.AsteriskAsterisk;
            case SyntaxKind.AsteriskToken:
            case SyntaxKind.SlashToken:
            case SyntaxKind.PercentToken:
                return Precedence.Asterisk;
            case SyntaxKind.PlusToken:
            case SyntaxKind.MinusToken:
                return Precedence.Plus;
            case SyntaxKind.LessThanLessThanToken:
            case SyntaxKind.GreaterThanGreaterThanToken:
            case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                return Precedence.LessThanLessThan;
            case SyntaxKind.LessThanToken:
            case SyntaxKind.GreaterThanToken:
            case SyntaxKind.LessThanEqualsToken:
            case SyntaxKind.GreaterThanEqualsToken:
            case SyntaxKind.InKeyword:
            case SyntaxKind.InstanceOfKeyword:
                return Precedence.LessThan;
            case SyntaxKind.EqualsEqualsToken:
            case SyntaxKind.ExclamationEqualsToken:
            case SyntaxKind.EqualsEqualsEqualsToken:
            case SyntaxKind.ExclamationEqualsEqualsToken:
                return Precedence.EqualsEquals;
            case SyntaxKind.AmpersandToken:
                return Precedence.Ampersand;
            case SyntaxKind.CaretToken:
                return Precedence.Caret;
            case SyntaxKind.BarToken:
                return Precedence.Bar;
            case SyntaxKind.AmpersandAmpersandToken:
                return Precedence.AmpersandAmpersand;
            case SyntaxKind.BarBarToken:
            case SyntaxKind.QuestionQuestionToken:
                return Precedence.BarBar;
            case SyntaxKind.EqualsToken:
            case SyntaxKind.PlusEqualsToken:
            case SyntaxKind.MinusEqualsToken:
            case SyntaxKind.AsteriskAsteriskEqualsToken:
            case SyntaxKind.AsteriskEqualsToken:
            case SyntaxKind.SlashEqualsToken:
            case SyntaxKind.PercentEqualsToken:
            case SyntaxKind.LessThanLessThanEqualsToken:
            case SyntaxKind.GreaterThanGreaterThanEqualsToken:
            case SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
            case SyntaxKind.AmpersandEqualsToken:
            case SyntaxKind.CaretEqualsToken:
            case SyntaxKind.BarEqualsToken:
            case SyntaxKind.AmpersandAmpersandEqualsToken:
            case SyntaxKind.BarBarEqualsToken:
            case SyntaxKind.QuestionQuestionEqualsToken:
                return Precedence.Equals;
            case SyntaxKind.CommaToken:
                return Precedence.Comma;
        }
    }
    if (ts.isYieldExpression(node)) {
        return Precedence.Equals;
    }
    if (ts.isConditionalExpression(node)) {
        return Precedence.Conditional;
    }
}
export default createRule(
    {
        docs: {
            description: "Detect unused expression.",
            recommended: "warn",
            suggestion: true,
            requiresTypeChecking: true,
        },
        fixable: "code",
        hasSuggestions: true,
        messages: {
            the_calculation_results_will_not_be_used:
                "The calculation results will not be used.",
            add_void_to_explicitly_ignore_the_value:
                "Add `void` to explicitly ignore the value.",
            remove_unused_expressions: "Remove unused expression.",
            assign_to_a_new_variable: "Assign to a new variable.",
        },
        type: "suggestion",
    },
    [],
    (context) => {
        const parserServices =
            context.parserServices ?? error`parserServices is undefined`;
        const checker = parserServices.program.getTypeChecker();

        function getRemoveExpressionRange(
            parent: ts.ExpressionStatement | ts.BinaryExpression
        ) {
            if (ts.isExpressionStatement(parent)) {
                // `expr ;`
                //  ^     ^
                return [parent.getStart(), parent.getEnd()] as const;
            } else {
                // `expr , expr`
                //  ^     ^
                return [
                    parent.left.getStart(),
                    parent.operatorToken.getEnd(),
                ] as const;
            }
        }

        const typeFlagVoidLike = ts.TypeFlags.VoidLike;
        function validateExpression(node: TSESTree.Expression) {
            const expression = parserServices.esTreeNodeToTSNodeMap.get(node);
            const type = checker.getTypeAtLocation(expression);

            // `"use strict"` は無視する
            if (isDirective(expression)) return;

            // void または undefined 型は副作用を表す
            if (type.getFlags() & typeFlagVoidLike) return;

            // 純粋でないっぽい式は無視する
            if (findSideEffectNode(expression) !== undefined) return;

            // void を付けて明示的に無視する提案
            const suggest: NonReadonly<
                NonNullable<Parameters<typeof context.report>[0]["suggest"]>
            > = [
                {
                    messageId: "add_void_to_explicitly_ignore_the_value",
                    fix(fixer) {
                        if (
                            getPrecedence(expression) ??
                            Precedence.MinValue < Precedence.Prefix
                        ) {
                            return [
                                fixer.insertTextAfter(node, "void ("),
                                fixer.insertTextBefore(node, ")"),
                            ];
                        } else {
                            return fixer.insertTextAfter(node, "void ");
                        }
                    },
                },
            ];

            // 本当に pure なら削除する提案
            const { parent } = expression;
            if (
                findSideEffectNode(expression) !== undefined &&
                (ts.isExpressionStatement(parent) ||
                    ts.isBinaryExpression(parent))
            ) {
                suggest.push({
                    messageId: "remove_unused_expressions",
                    fix(fixer) {
                        const range = getRemoveExpressionRange(parent);
                        return fixer.removeRange(range);
                    },
                });
            }

            // 親要素が statement であれば代入を生成する提案
            if (ts.isExpressionStatement(parent)) {
                suggest.push({
                    messageId: "assign_to_a_new_variable",
                    fix(fixer) {
                        const symbols = new Set(
                            checker
                                .getSymbolsInScope(
                                    parent,
                                    ts.SymbolFlags.Variable
                                )
                                .map((s) => s.escapedName)
                        );
                        return fixer.insertTextBefore(
                            node,
                            `const ${uniqueName(symbols, "x")} = `
                        );
                    },
                });
            }
            context.report({
                node,
                messageId: "the_calculation_results_will_not_be_used",
                suggest,
            });
        }

        return {
            SequenceExpression(node) {
                const { expressions } = node;
                expressions.forEach((expression, index) => {
                    // 最後の要素を除く
                    if (index === expressions.length - 1) return;

                    validateExpression(expression);
                });
            },
            ExpressionStatement(node) {
                validateExpression(node.expression);
            },
        };
    }
);