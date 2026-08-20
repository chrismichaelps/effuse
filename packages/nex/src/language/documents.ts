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
	DefinitionNode,
	DocumentNode,
	FragmentDefinitionNode,
	OperationDefinitionNode,
	SelectionSetNode,
} from './ast/index.js';
import { Kind } from './kinds/index.js';

/** The operation a request will run: by name, or the only one there is. */
export const getOperation = (
	document: DocumentNode,
	operationName?: string | undefined
): OperationDefinitionNode | undefined => {
	const operations = document.definitions.filter(
		(definition): definition is OperationDefinitionNode =>
			definition.kind === Kind.OPERATION_DEFINITION
	);

	return operationName === undefined
		? operations[0]
		: operations.find((operation) => operation.name?.value === operationName);
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

/** The fragments a selection set spreads, directly or through another. */
const reachedFragments = (
	selectionSet: SelectionSetNode,
	fragments: ReadonlyMap<string, FragmentDefinitionNode>,
	reached: Set<string>
): void => {
	for (const selection of selectionSet.selections) {
		switch (selection.kind) {
			case Kind.FIELD:
				if (selection.selectionSet !== undefined) {
					reachedFragments(selection.selectionSet, fragments, reached);
				}
				break;

			case Kind.INLINE_FRAGMENT:
				reachedFragments(selection.selectionSet, fragments, reached);
				break;

			case Kind.FRAGMENT_SPREAD: {
				const name = selection.name.value;
				if (reached.has(name)) break;
				reached.add(name);

				const fragment = fragments.get(name);
				if (fragment === undefined) break;
				reachedFragments(fragment.selectionSet, fragments, reached);
				break;
			}
		}
	}
};

/**
 * Split a document into one document per operation.
 *
 * Each keeps only the fragments its operation reaches, so a server can hold
 * one document per operation without carrying the rest of the file along.
 * An anonymous operation is keyed by the empty string.
 */
export const separateOperations = (
	document: DocumentNode
): Readonly<Record<string, DocumentNode>> => {
	const fragments = fragmentsOf(document);
	const separated: Record<string, DocumentNode> = Object.create(null) as Record<
		string,
		DocumentNode
	>;

	for (const definition of document.definitions) {
		if (definition.kind !== Kind.OPERATION_DEFINITION) continue;

		const reached = new Set<string>();
		reachedFragments(definition.selectionSet, fragments, reached);

		const definitions: DefinitionNode[] = [definition];
		for (const [name, fragment] of fragments) {
			if (reached.has(name)) definitions.push(fragment);
		}

		separated[definition.name?.value ?? ''] = {
			kind: Kind.DOCUMENT,
			definitions,
		};
	}

	return separated;
};

/** Join documents into one, keeping the order their definitions were written. */
export const concatDocuments = (
	...documents: readonly DocumentNode[]
): DocumentNode => ({
	kind: Kind.DOCUMENT,
	definitions: documents.flatMap((document) => document.definitions),
});
