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
	FieldNode,
	FragmentDefinitionNode,
	SelectionSetNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { selectionsFor } from './fragment-arguments.js';
import { typesOverlap } from '../validation/type-utils.js';
import { valueFromNode } from './values.js';

const readCondition = (
	directives: readonly DirectiveNode[] | undefined,
	name: string,
	variables: Readonly<Record<string, unknown>>
): boolean | undefined => {
	const directive = directives?.find(
		(candidate) => candidate.name.value === name
	);
	if (directive === undefined) return undefined;

	const argument = directive.arguments?.find(
		(candidate) => candidate.name.value === 'if'
	);
	if (argument === undefined) return undefined;

	return valueFromNode(argument.value, variables) === true;
};

/** Whether `@include` and `@skip` leave this selection in the request. */
export const isIncluded = (
	directives: readonly DirectiveNode[] | undefined,
	variables: Readonly<Record<string, unknown>>
): boolean => {
	if (readCondition(directives, 'skip', variables) === true) return false;
	return readCondition(directives, 'include', variables) !== false;
};

/**
 * Gather the fields to run for one runtime type, in the order they were
 * written, flattening fragments and merging fields that share a response key.
 */
export const collectFields = (
	catalog: Catalog,
	runtimeTypeName: string,
	selectionSet: SelectionSetNode,
	variables: Readonly<Record<string, unknown>>,
	fragments: ReadonlyMap<string, FragmentDefinitionNode>
): ReadonlyMap<string, readonly FieldNode[]> => {
	const collected = new Map<string, FieldNode[]>();
	const visited = new Set<string>();

	const walk = (set: SelectionSetNode): void => {
		for (const selection of set.selections) {
			if (!isIncluded(selection.directives, variables)) continue;

			switch (selection.kind) {
				case Kind.FIELD: {
					const key = selection.alias?.value ?? selection.name.value;
					const group = collected.get(key);
					if (group === undefined) collected.set(key, [selection]);
					else group.push(selection);
					break;
				}

				case Kind.INLINE_FRAGMENT: {
					const condition = selection.typeCondition?.name.value;
					if (
						condition !== undefined &&
						!typesOverlap(catalog, condition, runtimeTypeName)
					) {
						break;
					}
					walk(selection.selectionSet);
					break;
				}

				case Kind.FRAGMENT_SPREAD: {
					const name = selection.name.value;
					if (visited.has(name)) break;
					visited.add(name);

					const fragment = fragments.get(name);
					if (fragment === undefined) break;
					if (
						!typesOverlap(
							catalog,
							fragment.typeCondition.name.value,
							runtimeTypeName
						)
					) {
						break;
					}

					walk(selectionsFor(fragment, selection));
					break;
				}
			}
		}
	};

	walk(selectionSet);

	return collected;
};

/** Merge the selection sets of fields that share a response key. */
export const mergeSelectionSets = (
	fields: readonly FieldNode[]
): SelectionSetNode | undefined => {
	const sets = fields
		.map((field) => field.selectionSet)
		.filter((set): set is SelectionSetNode => set !== undefined);

	if (sets.length === 0) return undefined;
	if (sets.length === 1) return sets[0];

	return {
		kind: Kind.SELECTION_SET,
		selections: sets.flatMap((set) => set.selections),
	};
};
