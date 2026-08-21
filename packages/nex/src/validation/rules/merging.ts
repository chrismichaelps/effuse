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
	FieldNode,
	SelectionSetNode,
} from '../../language/ast/index.js';
import { Kind } from '../../language/kinds/index.js';
import { printValue } from '../../language/printer/index.js';
import type { ValidationContext } from '../context.js';
import { displayType } from '../type-utils.js';

/** A field written somewhere in a selection, with the type it was written on. */
interface Written {
	readonly field: FieldNode;
	readonly parentTypeName: string;
}

/** Spell a field's arguments so two call sites can be compared. */
const argumentSignature = (args: readonly ArgumentNode[] | undefined): string =>
	[...(args ?? [])]
		.map((argument) => `${argument.name.value}:${printValue(argument.value)}`)
		.sort()
		.join(',');

/**
 * Gather the fields a selection set contributes to each response key,
 * following fragments so a key written across two of them is still compared.
 */
const gather = (
	context: ValidationContext,
	parentTypeName: string,
	selectionSet: SelectionSetNode,
	into: Map<string, Written[]>,
	visited: Set<string>
): void => {
	for (const selection of selectionSet.selections) {
		switch (selection.kind) {
			case Kind.FIELD: {
				const key = selection.alias?.value ?? selection.name.value;
				const group = into.get(key);
				const written = { field: selection, parentTypeName };
				if (group === undefined) into.set(key, [written]);
				else group.push(written);
				break;
			}

			case Kind.INLINE_FRAGMENT:
				gather(
					context,
					selection.typeCondition?.name.value ?? parentTypeName,
					selection.selectionSet,
					into,
					visited
				);
				break;

			case Kind.FRAGMENT_SPREAD: {
				const name = selection.name.value;
				if (visited.has(name)) break;
				visited.add(name);

				const fragment = context.fragments.get(name);
				if (fragment === undefined) break;
				gather(
					context,
					fragment.typeCondition.name.value,
					fragment.selectionSet,
					into,
					visited
				);
				break;
			}
		}
	}
};

/**
 * Two selections that share a response key have to describe the same thing:
 * a client reading the response sees one key, so the server has to be able to
 * write one value into it.
 *
 * Selections written on types that can never both apply - two branches of a
 * union, say - are left alone: only one of them can ever run.
 */
/** The type a written field answers with, as it reads. */
const shapeOf = (context: ValidationContext, written: Written): string => {
	const declared = context.catalog.getField(
		written.parentTypeName,
		written.field.name.value
	);

	return declared === undefined ? 'nothing' : displayType(declared.type);
};

/**
 * Whether two branches answer with the same kind of value.
 *
 * Branches that cannot both apply may carry different fields under one key -
 * that is what makes a union worth reading - so long as what comes back is
 * the same kind of thing whichever branch answered.
 */
const sameShape = (
	context: ValidationContext,
	first: Written,
	other: Written
): boolean => shapeOf(context, first) === shapeOf(context, other);

export const checkSelectionsCanMerge = (
	context: ValidationContext,
	parentTypeName: string,
	selectionSet: SelectionSetNode
): void => {
	const byKey = new Map<string, Written[]>();
	gather(context, parentTypeName, selectionSet, byKey, new Set());

	// Whether anything here says which type an answer came from. Two branches
	// may answer under one key with different kinds of value, but only if a
	// reader is given some way to tell which it got.
	const discriminated = byKey.has('__typename');

	for (const [key, written] of byKey) {
		const [first, ...rest] = written;
		if (first === undefined) continue;

		for (const other of rest) {
			const exclusive =
				first.parentTypeName !== other.parentTypeName &&
				context.catalog.getType(first.parentTypeName)?.kind ===
					Kind.OBJECT_TYPE_DEFINITION &&
				context.catalog.getType(other.parentTypeName)?.kind ===
					Kind.OBJECT_TYPE_DEFINITION;
			if (exclusive) {
				if (discriminated || sameShape(context, first, other)) continue;

				context.report(
					`"${key}" answers with "${shapeOf(context, first)}" on "${first.parentTypeName}" and "${shapeOf(context, other)}" on "${other.parentTypeName}"; select "__typename" so a reader can tell which it got`,
					other.field
				);
				continue;
			}

			if (first.field.name.value !== other.field.name.value) {
				context.report(
					`"${key}" cannot be both "${first.field.name.value}" and "${other.field.name.value}": one response key carries one value`,
					other.field
				);
				continue;
			}

			if (
				argumentSignature(first.field.arguments) !==
				argumentSignature(other.field.arguments)
			) {
				context.report(
					`"${key}" is asked for twice with different arguments`,
					other.field
				);
			}
		}
	}
};
