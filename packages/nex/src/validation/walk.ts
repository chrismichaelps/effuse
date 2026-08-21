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

import { DirectiveLocation } from '../catalog/directive-locations.js';
import type { FieldNode, SelectionSetNode } from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { checkFragmentArguments } from './rules/fragment-arguments.js';
import type { ValidationContext } from './context.js';
import { checkArguments } from './rules/arguments.js';
import { checkDirectives } from './rules/directives.js';
import { checkSelectionsCanMerge } from './rules/merging.js';
import { checkPipeline } from './rules/pipelines.js';
import {
	isCompositeName,
	isLeafName,
	namedTypeOf,
	typesOverlap,
} from './type-utils.js';

const TYPENAME = '__typename';
const REFERENCE = '__ref';

/**
 * How far a request may walk the catalog's description of itself.
 *
 * The type graph is cyclic - a type has fields, a field has a type - so an
 * introspection request can be made to describe the same handful of types
 * over and over. Counting the repeats keeps the cost of that bounded.
 */
/**
 * How far into the type graph one request may walk.
 *
 * Introspection is recursive, and its cost is not what a field's cost says it
 * is: a handful of nested steps asks a server to write out its whole shape
 * several times over. Three is what a tool that draws a schema needs.
 */
const MAX_INTROSPECTION_DEPTH = 3;

/**
 * The introspection fields that step from one type to another type.
 *
 * `ofType` and `type` are left out: they walk the wrappers of a single type
 * reference, which the parser already bounds, and counting them would refuse
 * an ordinary introspection request.
 */
const RECURSIVE_INTROSPECTION_FIELDS: ReadonlySet<string> = new Set([
	'fields',
	'interfaces',
	'possibleTypes',
	'inputFields',
]);

const TOO_DEEP = `Introspection goes too deep here: at most ${String(MAX_INTROSPECTION_DEPTH)} levels of the type graph are read`;

/**
 * How far a selection set carries on walking the type graph.
 *
 * Only the steps count, not what is checked along the way - the general walk
 * does that where each fragment is defined. Following spreads here is what
 * stops a walk split across fragments from getting past the limit; a fragment
 * already being followed is left alone, since a cycle is reported elsewhere.
 */
const walksTooDeep = (
	context: ValidationContext,
	selectionSet: SelectionSetNode,
	depth: number,
	following: ReadonlySet<string> = new Set()
): boolean => {
	for (const selection of selectionSet.selections) {
		if (selection.kind === Kind.FRAGMENT_SPREAD) {
			const name = selection.name.value;
			if (following.has(name)) continue;

			const fragment = context.fragments.get(name);
			if (fragment === undefined) continue;

			if (
				walksTooDeep(
					context,
					fragment.selectionSet,
					depth,
					new Set([...following, name])
				)
			) {
				return true;
			}
			continue;
		}

		const next =
			selection.kind === Kind.FIELD &&
			RECURSIVE_INTROSPECTION_FIELDS.has(selection.name.value)
				? depth + 1
				: depth;

		if (next >= MAX_INTROSPECTION_DEPTH) return true;

		if (
			selection.selectionSet !== undefined &&
			walksTooDeep(context, selection.selectionSet, next, following)
		) {
			return true;
		}
	}

	return false;
};

const INTROSPECTION_FIELDS: ReadonlySet<string> = new Set([
	'__schema',
	'__type',
]);

const walkField = (
	context: ValidationContext,
	parentTypeName: string,
	field: FieldNode,
	introspectionDepth: number
): void => {
	const fieldName = field.name.value;

	if (fieldName === TYPENAME || fieldName === REFERENCE) {
		checkDirectives(context, field.directives, DirectiveLocation.FIELD);
		if (field.selectionSet !== undefined) {
			context.report(
				`Field "${fieldName}" cannot have a selection of subfields`,
				field
			);
			return;
		}

		if (
			fieldName === REFERENCE &&
			context.catalog.identityField(parentTypeName) === undefined
		) {
			context.report(
				`"${parentTypeName}" does not say what identifies it, so it has no "${REFERENCE}"; mark it @identity`,
				field
			);
		}
		return;
	}

	if (
		context.catalog.getType(parentTypeName)?.kind === Kind.UNION_TYPE_DEFINITION
	) {
		context.report(
			`Cannot query field "${fieldName}" directly on union type "${parentTypeName}"; spread an inline fragment instead`,
			field
		);
		return;
	}

	if (INTROSPECTION_FIELDS.has(fieldName) && !context.introspection) {
		context.report(
			`Introspection is turned off, so "${fieldName}" cannot be asked for`,
			field
		);
		return;
	}

	const nextDepth = parentTypeName.startsWith('__')
		? introspectionDepth +
			(RECURSIVE_INTROSPECTION_FIELDS.has(fieldName) ? 1 : 0)
		: 0;

	if (nextDepth >= MAX_INTROSPECTION_DEPTH) {
		context.report(TOO_DEEP, field);
		return;
	}

	const definition = context.catalog.getField(parentTypeName, fieldName);
	if (definition === undefined) {
		context.report(
			`Cannot query field "${fieldName}" on type "${parentTypeName}"`,
			field
		);
		return;
	}

	checkArguments(
		context,
		field.arguments,
		definition.arguments,
		`field "${fieldName}"`,
		field
	);
	checkDirectives(context, field.directives, DirectiveLocation.FIELD);
	checkPipeline(context, field, definition, parentTypeName);

	const fieldTypeName = namedTypeOf(definition.type);

	if (isLeafName(context.catalog, fieldTypeName)) {
		if (field.selectionSet !== undefined) {
			context.report(
				`Field "${fieldName}" of type "${fieldTypeName}" cannot have a selection of subfields`,
				field.selectionSet
			);
		}
		return;
	}

	if (!isCompositeName(context.catalog, fieldTypeName)) return;

	if (field.selectionSet === undefined) {
		context.report(
			`Field "${fieldName}" of type "${fieldTypeName}" must have a selection of subfields`,
			field
		);
		return;
	}

	walkSelectionSet(context, fieldTypeName, field.selectionSet, nextDepth);
};

/** Check every selection written against `parentTypeName`. */
export const walkSelectionSet = (
	context: ValidationContext,
	parentTypeName: string,
	selectionSet: SelectionSetNode,
	introspectionDepth = 0
): void => {
	checkSelectionsCanMerge(context, parentTypeName, selectionSet);

	for (const selection of selectionSet.selections) {
		switch (selection.kind) {
			case Kind.FIELD:
				context.withPath(selection.alias?.value ?? selection.name.value, () => {
					walkField(context, parentTypeName, selection, introspectionDepth);
				});
				break;

			case Kind.FRAGMENT_SPREAD: {
				const name = selection.name.value;
				checkDirectives(
					context,
					selection.directives,
					DirectiveLocation.FRAGMENT_SPREAD
				);
				context.recordFragmentSpread(name);

				const fragment = context.fragments.get(name);
				if (fragment === undefined) {
					context.report(`Unknown fragment "${name}"`, selection);
					break;
				}

				checkFragmentArguments(context, fragment, selection);

				const condition = fragment.typeCondition.name.value;
				if (
					isCompositeName(context.catalog, condition) &&
					!typesOverlap(context.catalog, condition, parentTypeName)
				) {
					context.report(
						`Fragment "${name}" on type "${condition}" can never apply to type "${parentTypeName}"`,
						selection
					);
				}

				// A fragment is checked where it is defined, but how far into
				// the type graph it goes depends on where it was spread from -
				// and splitting a walk across fragments would otherwise get
				// past the limit that walking it in one place runs into.
				if (walksTooDeep(context, fragment.selectionSet, introspectionDepth)) {
					context.report(TOO_DEEP, selection);
				}
				break;
			}

			case Kind.INLINE_FRAGMENT: {
				checkDirectives(
					context,
					selection.directives,
					DirectiveLocation.INLINE_FRAGMENT
				);

				const condition = selection.typeCondition?.name.value ?? parentTypeName;
				if (!isCompositeName(context.catalog, condition)) {
					context.report(
						`Unknown type "${condition}" in inline fragment`,
						selection
					);
					break;
				}
				if (!typesOverlap(context.catalog, condition, parentTypeName)) {
					context.report(
						`Inline fragment on type "${condition}" can never apply to type "${parentTypeName}"`,
						selection
					);
					break;
				}

				walkSelectionSet(
					context,
					condition,
					selection.selectionSet,
					introspectionDepth
				);
				break;
			}
		}
	}
};
