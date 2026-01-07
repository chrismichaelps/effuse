/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export const NodeTypes = {
	MEMBER_EXPRESSION: 'MemberExpression',
	OPTIONAL_MEMBER_EXPRESSION: 'OptionalMemberExpression',
	CALL_EXPRESSION: 'CallExpression',
	OPTIONAL_CALL_EXPRESSION: 'OptionalCallExpression',
	BINARY_EXPRESSION: 'BinaryExpression',
	LOGICAL_EXPRESSION: 'LogicalExpression',
	CONDITIONAL_EXPRESSION: 'ConditionalExpression',
	UNARY_EXPRESSION: 'UnaryExpression',
	TEMPLATE_LITERAL: 'TemplateLiteral',
	ARRAY_EXPRESSION: 'ArrayExpression',
	OBJECT_EXPRESSION: 'ObjectExpression',
	OBJECT_PROPERTY: 'ObjectProperty',
	IDENTIFIER: 'Identifier',
	ARROW_FUNCTION_EXPRESSION: 'ArrowFunctionExpression',
	FUNCTION_EXPRESSION: 'FunctionExpression',
	JSX_EXPRESSION_CONTAINER: 'JSXExpressionContainer',
	JSX_ATTRIBUTE: 'JSXAttribute',
	JSX_IDENTIFIER: 'JSXIdentifier',
	JSX_EMPTY_EXPRESSION: 'JSXEmptyExpression',
	JSX_NAMESPACED_NAME: 'JSXNamespacedName',
	ASSIGNMENT_EXPRESSION: 'AssignmentExpression',
	UPDATE_EXPRESSION: 'UpdateExpression',
	SPREAD_ELEMENT: 'SpreadElement',
} as const;

export type NodeType = (typeof NodeTypes)[keyof typeof NodeTypes];

export const DefaultSignalAccessors = ['.value'] as const;

export const DefaultEventHandlerPrefixes = ['on', 'handle'] as const;

export const DefaultExtensions = ['.tsx', '.jsx'] as const;

export const DefaultExcludePatterns = ['node_modules', 'dist'] as const;

export const ServiceIds = {
	COMPILER_CONFIG: 'effuse/compiler/Config',
	AST_ANALYZER: 'effuse/compiler/AstAnalyzer',
	SOURCE_CACHE: 'effuse/compiler/SourceCache',
} as const;

export const ErrorCodes = {
	PARSE_ERROR: 'PARSE_ERROR',
	TRANSFORM_ERROR: 'TRANSFORM_ERROR',
	GENERATE_ERROR: 'GENERATE_ERROR',
	CONFIG_ERROR: 'CONFIG_ERROR',
	CACHE_ERROR: 'CACHE_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export const PerformanceThresholds = {
	CACHE_TTL_MS: 5 * 60 * 1000,
} as const;

export const VitePluginConfig = {
	NAME: 'effuse-compiler',
	ENFORCE: 'pre',
} as const;
