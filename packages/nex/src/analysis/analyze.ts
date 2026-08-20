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
	DocumentNode,
	FieldNode,
	FragmentDefinitionNode,
	OperationDefinitionNode,
	SelectionSetNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { isListType, namedTypeOf } from '../validation/type-utils.js';
import { expectedRowCount } from './page-size.js';

const COST_DIRECTIVE = 'cost';
const TYPENAME = '__typename';

/** What a request will cost to run, and how deeply it nests. */
export interface RequestAnalysis {
	/** Estimated units of work, from `@cost` and the rows each list yields. */
	readonly cost: number;
	/** Longest chain of nested selections. */
	readonly depth: number;
}

/** How to read a request that has not run yet. */
export interface AnalysisOptions {
	/** Variables the request will run with, used to size its pages. */
	readonly variables?: Readonly<Record<string, unknown>> | undefined;
	/** Which operation to analyse, when the document holds several. */
	readonly operationName?: string | undefined;
}

/** The operation an analysis or execution should look at. */
export const selectOperation = (
	document: DocumentNode,
	operationName?: string | undefined
): OperationDefinitionNode | undefined => {
	const operations = document.definitions.filter(
		(definition): definition is OperationDefinitionNode =>
			definition.kind === Kind.OPERATION_DEFINITION
	);

	if (operationName === undefined) return operations[0];
	return operations.find(
		(operation) => operation.name?.value === operationName
	);
};

const fragmentsOf = (
	document: DocumentNode
): ReadonlyMap<string, FragmentDefinitionNode> => {
	const fragments = new Map<string, FragmentDefinitionNode>();

	for (const definition of document.definitions) {
		if (definition.kind !== Kind.FRAGMENT_DEFINITION) continue;
		if (!fragments.has(definition.name.value)) {
			fragments.set(definition.name.value, definition);
		}
	}

	return fragments;
};

const declaredCost = (
	catalog: Catalog,
	parentTypeName: string,
	field: FieldNode
): number => {
	const definition = catalog.getField(parentTypeName, field.name.value);
	const directive = definition?.directives?.find(
		(candidate) => candidate.name.value === COST_DIRECTIVE
	);
	const value = directive?.arguments?.find(
		(argument) => argument.name.value === 'value'
	)?.value;

	return value?.kind === Kind.INT ? Number.parseInt(value.value, 10) : 1;
};

/**
 * Price a request and measure how deep it goes, without running it.
 *
 * A field costs whatever `@cost` says, one unit otherwise, plus the cost of
 * everything it selects. A list multiplies its subtree by the rows it is
 * expected to yield, so a page of ten posts costs ten times one post.
 */
export const analyzeDocument = (
	document: DocumentNode,
	catalog: Catalog,
	options: AnalysisOptions = {}
): RequestAnalysis => {
	const operation = selectOperation(document, options.operationName);
	if (operation === undefined) return { cost: 0, depth: 0 };

	const fragments = fragmentsOf(document);
	const variables = options.variables ?? {};
	const rootType = catalog.getRootType(operation.operation);
	if (rootType === undefined) return { cost: 0, depth: 0 };

	let deepest = 0;

	const walkSelectionSet = (
		parentTypeName: string,
		selectionSet: SelectionSetNode,
		depth: number,
		active: ReadonlySet<string>
	): number => {
		let cost = 0;

		for (const selection of selectionSet.selections) {
			switch (selection.kind) {
				case Kind.FIELD: {
					deepest = Math.max(deepest, depth);

					if (selection.name.value === TYPENAME) {
						cost += 1;
						break;
					}

					const definition = catalog.getField(
						parentTypeName,
						selection.name.value
					);
					let subtree = 0;

					if (
						selection.selectionSet !== undefined &&
						definition !== undefined
					) {
						subtree = walkSelectionSet(
							namedTypeOf(definition.type),
							selection.selectionSet,
							depth + 1,
							active
						);
					}

					const rows =
						definition !== undefined && isListType(definition.type)
							? expectedRowCount(selection, variables)
							: 1;

					cost +=
						declaredCost(catalog, parentTypeName, selection) + rows * subtree;
					break;
				}

				case Kind.INLINE_FRAGMENT: {
					const condition =
						selection.typeCondition?.name.value ?? parentTypeName;
					cost += walkSelectionSet(
						condition,
						selection.selectionSet,
						depth,
						active
					);
					break;
				}

				case Kind.FRAGMENT_SPREAD: {
					const name = selection.name.value;
					if (active.has(name)) break;

					const fragment = fragments.get(name);
					if (fragment === undefined) break;

					cost += walkSelectionSet(
						fragment.typeCondition.name.value,
						fragment.selectionSet,
						depth,
						new Set([...active, name])
					);
					break;
				}
			}
		}

		return cost;
	};

	const cost = walkSelectionSet(
		rootType.name.value,
		operation.selectionSet,
		1,
		new Set()
	);

	return { cost, depth: deepest };
};
