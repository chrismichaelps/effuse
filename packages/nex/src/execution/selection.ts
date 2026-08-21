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
	FragmentDefinitionNode,
	SelectionSetNode,
} from '../language/ast/index.js';
import { printStage } from '../language/printer/pipeline.js';
import { namedTypeOf } from '../validation/type-utils.js';
import { collectFields, mergeSelectionSets } from './collect.js';
import type { SelectedField } from './resolvers.js';
import type { NexScalars } from './scalars.js';
import { coerceArgumentValues } from './values.js';

const NOTHING: Readonly<Record<string, unknown>> = Object.freeze(
	Object.create(null) as Record<string, unknown>
);

/** What working out a selection needs from the run it belongs to. */
export interface SelectionContext {
	readonly catalog: Catalog;
	readonly variables: Readonly<Record<string, unknown>>;
	readonly fragments: ReadonlyMap<string, FragmentDefinitionNode>;
	readonly scalars?: NexScalars | undefined;
}

/**
 * What a request asked for below one field, as plain values.
 *
 * Fragments are followed and `@skip` and `@include` applied, so this is what
 * the response will carry rather than what was typed. The catalog says what
 * type each step is, so nested selections are read against the type they
 * belong to rather than whatever was last seen.
 *
 * Written once and used by both the runner and the live path: what was asked
 * for is a property of the request, and a request does not change its mind
 * depending on which of the two is reading it.
 */
export const selectionUnder = (
	context: SelectionContext,
	typeName: string,
	selectionSet: SelectionSetNode | undefined
): readonly SelectedField[] => {
	if (selectionSet === undefined) return [];

	const collected = collectFields(
		context.catalog,
		typeName,
		selectionSet,
		context.variables,
		context.fragments
	);

	const selected: SelectedField[] = [];

	for (const [responseKey, nodes] of collected) {
		const node = nodes[0];
		if (node === undefined) continue;

		const name = node.name.value;
		const declared = context.catalog.getField(typeName, name);

		selected.push({
			name,
			alias: responseKey,
			pipeline: (node.pipeline ?? []).map(printStage),
			arguments:
				declared === undefined
					? NOTHING
					: coerceArgumentValues(
							declared,
							node.arguments,
							context.variables,
							context.catalog,
							context.scalars ?? {}
						),
			fields:
				declared === undefined
					? []
					: selectionUnder(
							context,
							namedTypeOf(declared.type),
							mergeSelectionSets(nodes)
						),
		});
	}

	return selected;
};
