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
	FragmentDefinitionNode,
	FragmentSpreadNode,
	SelectionNode,
	SelectionSetNode,
	ValueNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';

/**
 * What each of a fragment's variables stands for at one spread.
 *
 * A spread may pass a literal or hand on one of the operation's own
 * variables, and either is a value node - so what goes in is what was written,
 * rather than something read and written back out.
 */
const boundAt = (
	fragment: FragmentDefinitionNode,
	written: readonly ArgumentNode[] | undefined
): ReadonlyMap<string, ValueNode> => {
	const given = new Map(
		(written ?? []).map((argument) => [argument.name.value, argument.value])
	);
	const bound = new Map<string, ValueNode>();

	for (const declared of fragment.variableDefinitions ?? []) {
		const name = declared.variable.name.value;
		const value = given.get(name) ?? declared.defaultValue;
		if (value !== undefined) bound.set(name, value);
	}

	return bound;
};

/** Replace a fragment's own variables wherever they were written. */
const inValue = (
	value: ValueNode,
	bound: ReadonlyMap<string, ValueNode>
): ValueNode => {
	if (value.kind === Kind.VARIABLE) {
		return bound.get(value.name.value) ?? value;
	}

	if (value.kind === Kind.LIST) {
		return { ...value, values: value.values.map((one) => inValue(one, bound)) };
	}

	if (value.kind === Kind.OBJECT) {
		return {
			...value,
			fields: value.fields.map((field) => ({
				...field,
				value: inValue(field.value, bound),
			})),
		};
	}

	return value;
};

const inArguments = (
	written: readonly ArgumentNode[] | undefined,
	bound: ReadonlyMap<string, ValueNode>
): readonly ArgumentNode[] | undefined =>
	written === undefined
		? undefined
		: written.map((argument) => ({
				...argument,
				value: inValue(argument.value, bound),
			}));

const inSelection = (
	selection: SelectionNode,
	bound: ReadonlyMap<string, ValueNode>
): SelectionNode => {
	const directives = selection.directives?.map((directive) => ({
		...directive,
		...(directive.arguments === undefined
			? {}
			: { arguments: inArguments(directive.arguments, bound) }),
	}));

	const carried = directives === undefined ? {} : { directives };

	if (selection.kind === Kind.FIELD) {
		return {
			...selection,
			...carried,
			...(selection.arguments === undefined
				? {}
				: { arguments: inArguments(selection.arguments, bound) }),
			...(selection.selectionSet === undefined
				? {}
				: { selectionSet: inSelectionSet(selection.selectionSet, bound) }),
		};
	}

	if (selection.kind === Kind.INLINE_FRAGMENT) {
		return {
			...selection,
			...carried,
			selectionSet: inSelectionSet(selection.selectionSet, bound),
		};
	}

	// A spread inside a fragment passes on what it was given, so a fragment
	// built out of others still says what it needs at the top.
	return {
		...selection,
		...carried,
		...(selection.arguments === undefined
			? {}
			: { arguments: inArguments(selection.arguments, bound) }),
	};
};

const inSelectionSet = (
	set: SelectionSetNode,
	bound: ReadonlyMap<string, ValueNode>
): SelectionSetNode => ({
	...set,
	selections: set.selections.map((one) => inSelection(one, bound)),
});

/**
 * Substitution is per spread and the document does not change, so the work is
 * done once however many rows the fragment is collected for.
 *
 * What this is really keeping is the identity of the selection set: field
 * collection is memoized against it, and a fresh one each time would miss
 * every lookup. Measured at 6.46ms against 6.74ms over 2000 rows behind a
 * fragment - small, and in the direction the reasoning says.
 */
const cache = new WeakMap<FragmentSpreadNode, SelectionSetNode>();

/**
 * What a fragment selects at one spread, with what it takes filled in.
 *
 * A fragment that reads an operation's variables can only be spread into
 * operations that happen to declare them. One that says what it takes is the
 * same fragment wherever it is used, and may be used twice with different
 * values - so what it takes is filled in here, where it is used, rather than
 * being looked up from wherever it ended up.
 */
export const selectionsFor = (
	fragment: FragmentDefinitionNode,
	spread: FragmentSpreadNode
): SelectionSetNode => {
	if ((fragment.variableDefinitions ?? []).length === 0) {
		return fragment.selectionSet;
	}

	const already = cache.get(spread);
	if (already !== undefined) return already;

	const built = inSelectionSet(
		fragment.selectionSet,
		boundAt(fragment, spread.arguments)
	);
	cache.set(spread, built);
	return built;
};
