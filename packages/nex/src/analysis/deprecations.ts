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

import type { Catalog } from '../catalog/index.js';
import type {
	DirectiveNode,
	DocumentNode,
	ExpressionNode,
	FragmentDefinitionNode,
	Location,
	SelectionSetNode,
	ValueNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { namedTypeOf } from '../validation/type-utils.js';
import { selectOperation } from './analyze.js';

const DEPRECATED = 'deprecated';

/** One place a request leans on something the catalog has moved on from. */
export interface DeprecationNotice {
	/** What is deprecated, named as a coordinate. */
	readonly coordinate: string;
	/** Why, when the catalog says. */
	readonly reason?: string | undefined;
	/** Ready to log or show. */
	readonly message: string;
	/** Response path to the field that leans on it. */
	readonly path: readonly string[];
	/** Where it was written. */
	readonly location?: Location | undefined;
}

/** What to look at. */
export interface DeprecationOptions {
	/** Which operation to inspect, when the document holds several. */
	readonly operationName?: string | undefined;
}

const reasonOf = (
	directives: readonly DirectiveNode[] | undefined
): { readonly deprecated: boolean; readonly reason?: string } => {
	const directive = directives?.find(
		(candidate) => candidate.name.value === DEPRECATED
	);
	if (directive === undefined) return { deprecated: false };

	const reason = directive.arguments?.find(
		(argument) => argument.name.value === 'reason'
	)?.value;

	return reason?.kind === Kind.STRING
		? { deprecated: true, reason: reason.value }
		: { deprecated: true };
};

/**
 * Find everything a request leans on that the catalog has deprecated.
 *
 * One notice per place, not per name: a request asking for the same retired
 * field twice has two of them to change.
 */
export const findDeprecations = (
	document: DocumentNode,
	catalog: Catalog,
	options: DeprecationOptions = {}
): readonly DeprecationNotice[] => {
	const operation = selectOperation(document, options.operationName);
	const rootType =
		operation === undefined
			? undefined
			: catalog.getRootType(operation.operation);
	if (operation === undefined || rootType === undefined) return [];

	const fragments = new Map<string, FragmentDefinitionNode>();
	for (const definition of document.definitions) {
		if (definition.kind !== Kind.FRAGMENT_DEFINITION) continue;
		if (!fragments.has(definition.name.value)) {
			fragments.set(definition.name.value, definition);
		}
	}

	const notices: DeprecationNotice[] = [];

	const note = (
		coordinate: string,
		found: { readonly deprecated: boolean; readonly reason?: string },
		path: readonly string[],
		location: Location | undefined
	): void => {
		if (!found.deprecated) return;

		notices.push({
			coordinate,
			...(found.reason === undefined ? {} : { reason: found.reason }),
			message:
				found.reason === undefined
					? `"${coordinate}" is deprecated`
					: `"${coordinate}" is deprecated: ${found.reason}`,
			path: [...path],
			...(location === undefined ? {} : { location }),
		});
	};

	/** Enum values written as literals, wherever they appear. */
	const checkValue = (
		value: ValueNode,
		typeName: string,
		path: readonly string[]
	): void => {
		const definition = catalog.getType(typeName);

		if (value.kind === Kind.ENUM) {
			if (definition?.kind !== Kind.ENUM_TYPE_DEFINITION) return;

			const member = definition.values?.find(
				(candidate) => candidate.name.value === value.value
			);
			if (member === undefined) return;

			note(
				`${typeName}.${value.value}`,
				reasonOf(member.directives),
				path,
				value.loc
			);
			return;
		}

		if (value.kind === Kind.LIST) {
			for (const item of value.values) checkValue(item, typeName, path);
			return;
		}

		if (value.kind === Kind.OBJECT) {
			if (definition?.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION) return;

			for (const field of value.fields) {
				const declared = definition.fields?.find(
					(candidate) => candidate.name.value === field.name.value
				);
				if (declared === undefined) continue;

				note(
					`${typeName}.${field.name.value}`,
					reasonOf(declared.directives),
					path,
					field.loc
				);
				checkValue(field.value, namedTypeOf(declared.type), path);
			}
		}
	};

	/** Enum comparisons written inside a filter condition. */
	const checkExpression = (
		expression: ExpressionNode,
		itemTypeName: string,
		path: readonly string[]
	): void => {
		if (expression.kind === Kind.BINARY_EXPRESSION) {
			const { left, right } = expression;

			if (left.kind === Kind.FIELD_PATH && right.kind === Kind.ENUM) {
				let owner = itemTypeName;
				let fieldType: string | undefined;

				for (const segment of left.segments) {
					const field = catalog.getField(owner, segment.value);
					if (field === undefined) return;
					fieldType = namedTypeOf(field.type);
					owner = fieldType;
				}

				if (fieldType !== undefined) checkValue(right, fieldType, path);
				return;
			}

			checkExpression(left, itemTypeName, path);
			checkExpression(right, itemTypeName, path);
			return;
		}

		if (expression.kind === Kind.UNARY_EXPRESSION) {
			checkExpression(expression.expression, itemTypeName, path);
		}
	};

	const walk = (
		typeName: string,
		selectionSet: SelectionSetNode,
		path: readonly string[],
		visited: ReadonlySet<string>
	): void => {
		for (const selection of selectionSet.selections) {
			switch (selection.kind) {
				case Kind.FIELD: {
					const fieldName = selection.name.value;
					const responseKey = selection.alias?.value ?? fieldName;
					const here = [...path, responseKey];
					const definition = catalog.getField(typeName, fieldName);
					if (definition === undefined) break;

					note(
						`${typeName}.${fieldName}`,
						reasonOf(definition.directives),
						here,
						selection.loc
					);

					for (const argument of selection.arguments ?? []) {
						const declared = definition.arguments?.find(
							(candidate) => candidate.name.value === argument.name.value
						);
						if (declared === undefined) continue;

						note(
							`${typeName}.${fieldName}(${argument.name.value}:)`,
							reasonOf(declared.directives),
							here,
							argument.loc
						);
						checkValue(argument.value, namedTypeOf(declared.type), here);
					}

					const fieldTypeName = namedTypeOf(definition.type);

					for (const stage of selection.pipeline ?? []) {
						if (stage.kind !== Kind.FILTER_STAGE) continue;
						checkExpression(stage.condition, fieldTypeName, here);
					}

					if (selection.selectionSet !== undefined) {
						walk(fieldTypeName, selection.selectionSet, here, visited);
					}
					break;
				}

				case Kind.INLINE_FRAGMENT:
					walk(
						selection.typeCondition?.name.value ?? typeName,
						selection.selectionSet,
						path,
						visited
					);
					break;

				case Kind.FRAGMENT_SPREAD: {
					const name = selection.name.value;
					if (visited.has(name)) break;

					const fragment = fragments.get(name);
					if (fragment === undefined) break;

					walk(
						fragment.typeCondition.name.value,
						fragment.selectionSet,
						path,
						new Set([...visited, name])
					);
					break;
				}
			}
		}
	};

	walk(rootType.name.value, operation.selectionSet, [], new Set());

	return notices;
};
