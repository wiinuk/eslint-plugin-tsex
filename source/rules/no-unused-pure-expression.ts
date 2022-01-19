/* eslint-disable no-fallthrough */
import { TSESTree } from "@typescript-eslint/experimental-utils";
import { RuleFixer } from "@typescript-eslint/experimental-utils/dist/ts-eslint";
import ts, { SyntaxKind } from "typescript";
import { error } from "../standard-extensions";
import { createRule } from "../ts-eslint-extensions";
import { NonReadonly } from "../type-level/standard-extensions";

function hasDirective(
    statements: ts.NodeArray<ts.Statement>,
    directive: ts.StringLiteral
) {
    for (const statement of statements) {
        if (ts.isExpressionStatement(statement)) {
            const { expression } = statement;
            if (ts.isStringLiteral(expression)) {
                if (expression === directive) {
                    return true;
                } else {
                    continue;
                }
            }
        }
        break;
    }
    return false;
}
/** @internal */
export function isDirectiveExpression(
    expression: ts.Node
): expression is ts.StringLiteral {
    if (!ts.isStringLiteral(expression)) return false;

    const parent = expression.parent;
    if (!ts.isExpressionStatement(parent)) return false;

    const container = parent.parent;
    if (
        // `function f() { "use strict"; }`
        ts.isFunctionDeclaration(container) ||
        // `class C { f() { "use strict"; } }`
        ts.isMethodDeclaration(container) ||
        // `class C { constructor() { "use strict"; } }`
        ts.isConstructorDeclaration(container) ||
        // `class C { get f() { "use strict"; } }`
        ts.isAccessor(container) ||
        // `function() { "use strict"; }`
        ts.isFunctionExpression(container) ||
        // `() => { "use strict"; }`
        ts.isArrowFunction(container)
    ) {
        const { body } = container;
        if (body && ts.isBlock(body)) {
            return hasDirective(body.statements, expression);
        }
    }
    if (
        // `"use strict";`
        ts.isSourceFile(container)
    ) {
        return hasDirective(container.statements, expression);
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

function isPrimitiveType(checker: ts.TypeChecker, node: ts.Node) {
    const type = checker.getApparentType(checker.getTypeAtLocation(node));
    return (type.flags & ts.TypeFlags.NonPrimitive) === 0;
}
function isSideEffectNode(checker: ts.TypeChecker, node: ts.Node) {
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
                return true;

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
            case SyntaxKind.InKeyword: {
                // 両方の被演算式の型がプリミティブなら valueOf や toString を呼ばないので副作用がない
                if (
                    isPrimitiveType(checker, node.left) &&
                    isPrimitiveType(checker, node.right)
                ) {
                    return false;
                }
                return true;
            }
        }
    }
    // `await e`
    if (ts.isAwaitExpression(node)) return true;
    // `f()`, `new C`, `f```, `@d`, `<t>`
    if (ts.isCallLikeExpression(node)) return true;
    // `delete e`
    if (ts.isDeleteExpression(node)) return true;
    if (ts.isPrefixUnaryExpression(node)) {
        switch (node.operator) {
            // 副作用
            // `++e`
            case SyntaxKind.PlusPlusToken:
            // `--e`
            case SyntaxKind.MinusMinusToken:
                return true;

            // valueOf が呼ばれるかも
            // `-e`
            case SyntaxKind.MinusToken:
            // `+e`
            case SyntaxKind.PlusToken:
            // `!`
            case SyntaxKind.ExclamationToken:
            // `~`
            case SyntaxKind.TildeToken: {
                // 被演算式の型がプリミティブなら valueOf や toString を呼ばないので副作用がない
                if (isPrimitiveType(checker, node.operand)) return false;
                return true;
            }
        }
    }
    // `e++`, `e--`
    if (ts.isPostfixUnaryExpression(node)) return true;
    // `yield e`
    if (ts.isYieldExpression(node)) return true;
    // `e.p``
    if (ts.isPropertyAccessExpression(node)) return true;
    // `e[i]`
    if (ts.isElementAccessExpression(node)) return true;

    return false;
}
/** @internal */
export function findSideEffectNode(checker: ts.TypeChecker, node: ts.Node) {
    function visit(node: ts.Node): ts.Node | undefined {
        if (isSideEffectNode(checker, node)) return node;
        return ts.forEachChild(node, visit);
    }
    return visit(node);
}
/** @internal */
export const enum Precedence {
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
/** @internal */
export function getPrecedence(node: ts.Node) {
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
    return Precedence.Parenthesis;
}
/** @internal */
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
    } as const,
    [],
    (context) => {
        type Suggest = NonReadonly<
            NonNullable<Parameters<typeof context.report>[0]["suggest"]>
        >[number];

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
        function validateExpression(
            parentNode:
                | TSESTree.SequenceExpression
                | TSESTree.ExpressionStatement,
            node: TSESTree.Expression
        ) {
            const expression = parserServices.esTreeNodeToTSNodeMap.get(node);
            const type = checker.getTypeAtLocation(expression);

            // void または undefined 型は副作用を表す
            if (type.getFlags() & typeFlagVoidLike) return;

            // `"use strict"` などは無視する
            if (isDirectiveExpression(expression)) return;

            // 純粋でないっぽい式は無視する
            if (findSideEffectNode(checker, expression) !== undefined) return;

            const suggest: Suggest[] = [
                // void を付けて明示的に無視する提案
                {
                    messageId: "add_void_to_explicitly_ignore_the_value",
                    fix(fixer) {
                        const precedence =
                            getPrecedence(expression) ?? Precedence.MinValue;
                        const voidPrecedence = Precedence.Prefix;
                        if (precedence < voidPrecedence) {
                            return [
                                fixer.insertTextBefore(node, "void ("),
                                fixer.insertTextAfter(node, ")"),
                            ];
                        } else {
                            return fixer.insertTextBefore(node, "void ");
                        }
                    },
                },
            ];

            const parent = parserServices.esTreeNodeToTSNodeMap.get(parentNode);

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
            // 削除する提案
            const removeFix = {
                messageId: "remove_unused_expressions",
                fix(fixer: RuleFixer) {
                    const range = getRemoveExpressionRange(parent);
                    return fixer.removeRange(range);
                },
            } as const;
            // 本当に純粋なら削除提案を自動修正の対象にする
            if (findSideEffectNode(checker, expression) === undefined) {
                context.report({
                    messageId: removeFix.messageId,
                    node,
                    fix: removeFix.fix,
                    suggest,
                });
            } else {
                suggest.push(removeFix);
                context.report({
                    node,
                    messageId: "the_calculation_results_will_not_be_used",
                    suggest,
                });
            }
        }

        return {
            SequenceExpression(node) {
                const { expressions } = node;
                expressions.forEach((expression, index) => {
                    // 最後の要素を除く
                    if (index === expressions.length - 1) return;

                    validateExpression(node, expression);
                });
            },
            ExpressionStatement(node) {
                validateExpression(node, node.expression);
            },
        };
    }
);
