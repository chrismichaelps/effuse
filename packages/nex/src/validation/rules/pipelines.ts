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

import type {
	ArgumentNode,
	ExpressionNode,
	FieldDefinitionNode,
	FieldNode,
	FieldPathNode,
	PipelineStageNode,
	TypeNode,
	ValueNode,
} from '../../language/ast/index.js';
import { Kind } from '../../language/kinds/index.js';
import type { ValidationContext } from '../context.js';
import {
	isLeafName,
	isListType,
	listItemType,
	namedTypeOf,
} from '../type-utils.js';
import { checkValue, displayValue, isIntegerValue } from './values.js';

const intType = (): TypeNode => ({
	kind: Kind.NAMED_TYPE,
	name: { kind: Kind.NAME, value: 'Int' },
});

const cursorType = (): TypeNode => ({
	kind: Kind.NAMED_TYPE,
	name: { kind: Kind.NAME, value: 'String' },
});

/**
 * A count written on a stage must be an Int. A variable stands in for one, and
 * is recorded so the operation that declares it gets checked too.
 */
const checkCount = (
	context: ValidationContext,
	value: ValueNode,
	subject: string,
	node: PipelineStageNode | ArgumentNode
): void => {
	if (value.kind === Kind.VARIABLE) {
		context.recordVariableUsage(value, intType(), subject);
		return;
	}
	if (!isIntegerValue(context, value)) {
		context.report(
			`${subject} needs an Int count, found ${displayValue(value)}`,
			node
		);
		return;
	}

	// A negative count is nonsense, and each stage made a different kind of
	// nonsense of it: taking all but the last, keeping only the last, or
	// answering with everything whatever the server allows.
	if (value.kind === Kind.INT && Number(value.value) < 0) {
		context.report(
			`${subject} needs a count of none or more, found ${displayValue(value)}`,
			node
		);
	}
};

const FORWARD_ARGUMENTS = ['first', 'after'];
const BACKWARD_ARGUMENTS = ['last', 'before'];
const PAGE_ARGUMENTS = new Set([...FORWARD_ARGUMENTS, ...BACKWARD_ARGUMENTS]);

/** Spell a path the way it was written, for error messages. */
const displayPath = (path: FieldPathNode): string =>
	path.segments.map((segment) => segment.value).join('.');

/**
 * Follow a dotted path from the item type of a pipeline.
 *
 * Returns the type the path lands on, or the segment that could not be
 * resolved so the caller can explain what went wrong.
 */
const resolvePath = (
	context: ValidationContext,
	itemTypeName: string,
	path: FieldPathNode
): { readonly type: TypeNode } | { readonly missing: string } => {
	let owner = itemTypeName;
	let type: TypeNode | undefined;

	for (const segment of path.segments) {
		const definition = context.catalog.getField(owner, segment.value);
		if (definition === undefined) return { missing: segment.value };

		type = definition.type;
		owner = namedTypeOf(definition.type);
	}

	return type === undefined ? { missing: displayPath(path) } : { type };
};

/** Every field path a filter condition mentions, with its comparison partner. */
const collectComparisons = (
	expression: ExpressionNode
): readonly {
	readonly path: FieldPathNode;
	readonly against?: ValueNode | undefined;
}[] => {
	switch (expression.kind) {
		case Kind.FIELD_PATH:
			return [{ path: expression }];
		case Kind.UNARY_EXPRESSION:
			return collectComparisons(expression.expression);
		case Kind.BINARY_EXPRESSION: {
			const { left, right } = expression;
			if (left.kind === Kind.FIELD_PATH && right.kind !== Kind.FIELD_PATH) {
				const isValue =
					right.kind !== Kind.BINARY_EXPRESSION &&
					right.kind !== Kind.UNARY_EXPRESSION;
				return [{ path: left, ...(isValue ? { against: right } : {}) }];
			}
			return [...collectComparisons(left), ...collectComparisons(right)];
		}
		default:
			return [];
	}
};

const checkFilterStage = (
	context: ValidationContext,
	condition: ExpressionNode,
	itemTypeName: string
): void => {
	for (const comparison of collectComparisons(condition)) {
		const resolved = resolvePath(context, itemTypeName, comparison.path);

		if ('missing' in resolved) {
			context.report(
				`Cannot filter on "${displayPath(comparison.path)}": "${resolved.missing}" is not a field of "${itemTypeName}"`,
				comparison.path
			);
			continue;
		}

		if (comparison.against !== undefined) {
			checkValue(
				context,
				comparison.against,
				resolved.type,
				`Filter on "${displayPath(comparison.path)}"`
			);
		}
	}
};

const checkSortStage = (
	context: ValidationContext,
	path: FieldPathNode,
	itemTypeName: string
): void => {
	const resolved = resolvePath(context, itemTypeName, path);

	if ('missing' in resolved) {
		context.report(
			`Cannot sort on "${displayPath(path)}": "${resolved.missing}" is not a field of "${itemTypeName}"`,
			path
		);
		return;
	}

	if (!isLeafName(context.catalog, namedTypeOf(resolved.type))) {
		context.report(
			`Cannot sort on "${displayPath(path)}": it is not a leaf field`,
			path
		);
	}
};

const checkPageStage = (
	context: ValidationContext,
	stage: { readonly arguments: readonly ArgumentNode[] },
	node: PipelineStageNode,
	isConnection: boolean,
	fieldName: string
): void => {
	if (!isConnection) {
		context.report(
			`Field "${fieldName}" is not marked @connection, so "| page" cannot be applied to it`,
			node
		);
	}

	const provided = new Map<string, ArgumentNode>();

	for (const argument of stage.arguments) {
		const name = argument.name.value;

		if (!PAGE_ARGUMENTS.has(name)) {
			context.report(`Unknown argument "${name}" on "| page"`, argument);
			continue;
		}
		if (provided.has(name)) {
			context.report(`Argument "${name}" is provided more than once`, argument);
			continue;
		}

		provided.set(name, argument);

		if (name === 'first' || name === 'last') {
			checkCount(context, argument.value, `"| page ${name}"`, argument);
			continue;
		}

		if (argument.value.kind === Kind.VARIABLE) {
			context.recordVariableUsage(
				argument.value,
				cursorType(),
				`"| page ${name}"`
			);
			continue;
		}
		if (argument.value.kind !== Kind.STRING) {
			context.report(
				`"| page ${name}" needs a cursor, found ${displayValue(argument.value)}`,
				argument
			);
		}
	}

	const forward = FORWARD_ARGUMENTS.some((name) => provided.has(name));
	const backward = BACKWARD_ARGUMENTS.some((name) => provided.has(name));

	if (forward && backward) {
		context.report(
			'"| page" cannot mix forward paging (first, after) with backward paging (last, before)',
			node
		);
		return;
	}

	if (!provided.has('first') && !provided.has('last')) {
		context.report('"| page" needs "first" or "last" to size the page', node);
	}
};

/** Check the pipeline written on a field against what the catalog declares. */
export const checkPipeline = (
	context: ValidationContext,
	field: FieldNode,
	definition: FieldDefinitionNode,
	parentTypeName: string
): void => {
	const stages = field.pipeline;
	if (stages === undefined || stages.length === 0) return;

	const fieldName = field.name.value;

	if (!isListType(definition.type)) {
		context.report(
			`Pipeline stages can only be applied to a list field; "${fieldName}" is not a list`,
			stages[0]
		);
		return;
	}

	const itemType = listItemType(definition.type);
	const itemTypeName = itemType === undefined ? '' : namedTypeOf(itemType);
	const isConnection = context.catalog.isConnectionField(
		parentTypeName,
		fieldName
	);

	for (const [index, stage] of stages.entries()) {
		if (stage.kind === Kind.PAGE_STAGE && index !== stages.length - 1) {
			context.report(
				'"| page" must be the last stage: it turns the rows into a page',
				stages[index + 1]
			);
		}

		switch (stage.kind) {
			case Kind.FILTER_STAGE:
				checkFilterStage(context, stage.condition, itemTypeName);
				break;
			case Kind.SORT_STAGE:
				checkSortStage(context, stage.field, itemTypeName);
				break;
			case Kind.TAKE_STAGE:
			case Kind.SKIP_STAGE: {
				const keyword = stage.kind === Kind.TAKE_STAGE ? 'take' : 'skip';
				checkCount(context, stage.count, `"| ${keyword}"`, stage);
				break;
			}
			case Kind.PAGE_STAGE:
				checkPageStage(context, stage, stage, isConnection, fieldName);
				break;
			case Kind.UNIQUE_STAGE:
			case Kind.CUSTOM_STAGE:
				break;
		}
	}
};
