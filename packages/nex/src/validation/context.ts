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
import { NexValidationError } from '../errors/index.js';
import type {
	DocumentNode,
	FragmentDefinitionNode,
	Location,
	TypeNode,
	VariableDefinitionNode,
	VariableNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';

/** A node that may carry a source location. */
interface Locatable {
	readonly loc?: Location | undefined;
}

/** One place a variable was written, with the type expected there. */
export interface VariableUsage {
	readonly variable: VariableNode;
	readonly type: TypeNode;
	/** How the place reads in an error message, e.g. `argument "id"`. */
	readonly subject: string;
}

/**
 * What one walk of a selection set found: the variables it used and the
 * fragments it spread. Operations and fragments each get their own, so a
 * fragment's usages can be checked against every operation that reaches it.
 */
export interface UsageScope {
	readonly variables: VariableUsage[];
	readonly spreads: string[];
}

/** Start an empty usage scope. */
export const createUsageScope = (): UsageScope => ({
	variables: [],
	spreads: [],
});

/** How a server wants its requests checked. */
export interface ValidationOptions {
	/** Whether `__schema` and `__type` may be asked for. Defaults to `true`. */
	readonly introspection?: boolean | undefined;
}

/** Everything a rule needs: the catalog, the document, and where it is. */
export interface ValidationContext {
	readonly catalog: Catalog;
	readonly document: DocumentNode;
	/** Fragment definitions by name; the first of a duplicated name wins. */
	readonly fragments: ReadonlyMap<string, FragmentDefinitionNode>;
	/** Variables declared by the operation being checked. */
	readonly variables: Map<string, VariableDefinitionNode>;
	/** Whether the catalog may be asked about itself. */
	readonly introspection: boolean;
	/** Record a problem. */
	readonly report: (message: string, node?: Locatable) => void;
	/** Run `body` with `field` appended to the response path. */
	readonly withPath: <T>(field: string, body: () => T) => T;
	/** Run `body` recording variable and fragment usage into `scope`. */
	readonly collect: <T>(scope: UsageScope, body: () => T) => T;
	/** Note that a variable was written where `type` is expected. */
	readonly recordVariableUsage: (
		variable: VariableNode,
		type: TypeNode,
		subject: string
	) => void;
	/** Note that a fragment was spread here. */
	readonly recordFragmentSpread: (name: string) => void;
	/** The problems found so far, in the order they were found. */
	readonly errors: readonly NexValidationError[];
}

/** Create the context a document walk threads through its rules. */
export const createValidationContext = (
	catalog: Catalog,
	document: DocumentNode,
	options: ValidationOptions = {}
): ValidationContext => {
	const errors: NexValidationError[] = [];
	const fragments = new Map<string, FragmentDefinitionNode>();
	const path: string[] = [];
	let scope: UsageScope = createUsageScope();

	for (const definition of document.definitions) {
		if (definition.kind !== Kind.FRAGMENT_DEFINITION) continue;
		if (!fragments.has(definition.name.value)) {
			fragments.set(definition.name.value, definition);
		}
	}

	return {
		catalog,
		document,
		fragments,
		variables: new Map(),
		introspection: options.introspection !== false,
		errors,
		report: (message, node) => {
			errors.push(
				new NexValidationError({
					message,
					location:
						node?.loc === undefined
							? undefined
							: {
									start: node.loc.start,
									line: node.loc.line,
									column: node.loc.column,
								},
					path: [...path],
				})
			);
		},
		withPath: (field, body) => {
			path.push(field);
			try {
				return body();
			} finally {
				path.pop();
			}
		},
		collect: (next, body) => {
			const previous = scope;
			scope = next;
			try {
				return body();
			} finally {
				scope = previous;
			}
		},
		recordVariableUsage: (variable, type, subject) => {
			scope.variables.push({ variable, type, subject });
		},
		recordFragmentSpread: (name) => {
			scope.spreads.push(name);
		},
	};
};
