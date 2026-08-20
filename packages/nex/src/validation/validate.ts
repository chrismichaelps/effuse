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
import type { Catalog } from '../catalog/index.js';
import type { NexValidationError } from '../errors/index.js';
import type {
	DocumentNode,
	FragmentDefinitionNode,
	OperationDefinitionNode,
	SelectionSetNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import {
	createUsageScope,
	createValidationContext,
	type UsageScope,
	type ValidationOptions,
	type ValidationContext,
	type VariableUsage,
} from './context.js';
import { checkDirectives } from './rules/directives.js';
import {
	checkFragmentDefinitions,
	checkOnlyExecutableDefinitions,
	checkOperationNames,
} from './rules/definitions.js';
import {
	checkVariableUsages,
	declareVariables,
	operationLocation,
} from './rules/variables.js';
import { walkSelectionSet } from './walk.js';

const ROOT_LABELS = {
	query: 'query',
	mutation: 'mutation',
	live: 'live',
} as const;

/**
 * Everything a fragment did: what it used, and what it spread.
 *
 * A fragment is walked once, and each operation that reaches it inherits the
 * result. That keeps a fragment shared by ten operations from being walked
 * ten times, and it is what lets a variable used inside a fragment be checked
 * against the operation that supplies it.
 */
type FragmentScopes = ReadonlyMap<string, UsageScope>;

const walkFragments = (
	context: ValidationContext,
	document: DocumentNode
): FragmentScopes => {
	const scopes = new Map<string, UsageScope>();

	for (const definition of document.definitions) {
		if (definition.kind !== Kind.FRAGMENT_DEFINITION) continue;

		const fragment = definition as FragmentDefinitionNode;
		const name = fragment.name.value;
		if (scopes.has(name)) continue;

		const condition = fragment.typeCondition.name.value;
		if (context.catalog.getType(condition) === undefined) continue;

		const scope = createUsageScope();
		scopes.set(name, scope);

		context.collect(scope, () => {
			checkDirectives(
				context,
				fragment.directives,
				DirectiveLocation.FRAGMENT_DEFINITION
			);
			walkSelectionSet(context, condition, fragment.selectionSet);
		});
	}

	return scopes;
};

/**
 * Follow fragment spreads from `start`, gathering the variables they use.
 *
 * Reports the first cycle it meets rather than following it forever.
 */
const reachFragments = (
	start: UsageScope,
	scopes: FragmentScopes,
	onCycle: (name: string) => void
): {
	readonly usages: readonly VariableUsage[];
	readonly reached: ReadonlySet<string>;
} => {
	const usages: VariableUsage[] = [...start.variables];
	const reached = new Set<string>();
	const active = new Set<string>();

	const visit = (name: string): void => {
		if (active.has(name)) {
			onCycle(name);
			return;
		}
		if (reached.has(name)) return;

		reached.add(name);
		active.add(name);

		const scope = scopes.get(name);
		if (scope !== undefined) {
			usages.push(...scope.variables);
			for (const spread of scope.spreads) visit(spread);
		}

		active.delete(name);
	};

	for (const spread of start.spreads) visit(spread);

	return { usages, reached };
};

/**
 * How many root fields a live operation ends up watching, once fragments are
 * flattened. A stream carries one field's events, so this has to be one.
 */
const countWatchedFields = (
	context: ValidationContext,
	selectionSet: SelectionSetNode,
	visited: Set<string>
): number => {
	let watched = 0;

	for (const selection of selectionSet.selections) {
		switch (selection.kind) {
			case Kind.FIELD:
				watched += 1;
				break;
			case Kind.INLINE_FRAGMENT:
				watched += countWatchedFields(context, selection.selectionSet, visited);
				break;
			case Kind.FRAGMENT_SPREAD: {
				const name = selection.name.value;
				if (visited.has(name)) break;
				visited.add(name);

				const fragment = context.fragments.get(name);
				if (fragment === undefined) break;
				watched += countWatchedFields(context, fragment.selectionSet, visited);
				break;
			}
		}
	}

	return watched;
};

const walkOperation = (
	context: ValidationContext,
	operation: OperationDefinitionNode,
	scopes: FragmentScopes,
	reachedFragments: Set<string>
): void => {
	const rootType = context.catalog.getRootType(operation.operation);

	if (rootType === undefined) {
		context.report(
			`Cannot run a ${ROOT_LABELS[operation.operation]} operation: the catalog defines no ${ROOT_LABELS[operation.operation]} root type`,
			operation
		);
		return;
	}

	if (
		operation.operation === 'live' &&
		countWatchedFields(context, operation.selectionSet, new Set()) !== 1
	) {
		context.report('A live operation must watch exactly one field', operation);
	}

	declareVariables(context, operation);
	checkDirectives(context, operation.directives, operationLocation(operation));

	const scope = createUsageScope();
	context.collect(scope, () => {
		walkSelectionSet(context, rootType.name.value, operation.selectionSet);
	});

	const reportedCycles = new Set<string>();
	const { usages, reached } = reachFragments(scope, scopes, (name) => {
		if (reportedCycles.has(name)) return;
		reportedCycles.add(name);
		context.report(
			`Fragment "${name}" spreads itself, directly or through a cycle`,
			context.fragments.get(name)
		);
	});

	for (const name of reached) reachedFragments.add(name);
	checkVariableUsages(context, operation, usages);
};

/** Check a request against a catalog, returning every problem it found. */
export const validateDocumentAgainstCatalog = (
	document: DocumentNode,
	catalog: Catalog,
	options: ValidationOptions = {}
): readonly NexValidationError[] => {
	const context = createValidationContext(catalog, document, options);

	checkOnlyExecutableDefinitions(context, document);
	checkOperationNames(context, document);
	checkFragmentDefinitions(context, document);

	const scopes = walkFragments(context, document);
	const reachedFragments = new Set<string>();

	for (const definition of document.definitions) {
		if (definition.kind !== Kind.OPERATION_DEFINITION) continue;
		walkOperation(context, definition, scopes, reachedFragments);
	}

	for (const [name, fragment] of context.fragments) {
		if (reachedFragments.has(name)) continue;
		context.report(`Fragment "${name}" is never used`, fragment);
	}

	return context.errors;
};
