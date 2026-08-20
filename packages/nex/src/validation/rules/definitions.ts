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
	DocumentNode,
	OperationDefinitionNode,
} from '../../language/ast/index.js';
import { Kind } from '../../language/kinds/index.js';
import type { ValidationContext } from '../context.js';
import { isCompositeName } from '../type-utils.js';

/** Operation names must be unique, and an anonymous operation must be alone. */
export const checkOperationNames = (
	context: ValidationContext,
	document: DocumentNode
): void => {
	const operations = document.definitions.filter(
		(definition): definition is OperationDefinitionNode =>
			definition.kind === Kind.OPERATION_DEFINITION
	);
	const seen = new Set<string>();

	for (const operation of operations) {
		const name = operation.name?.value;

		if (name === undefined) {
			if (operations.length > 1) {
				context.report(
					'This anonymous operation must be the only operation in the document',
					operation
				);
			}
			continue;
		}

		if (seen.has(name)) {
			context.report(
				`There can be only one operation named "${name}"`,
				operation
			);
			continue;
		}
		seen.add(name);
	}
};

const EXECUTABLE_KINDS: ReadonlySet<string> = new Set([
	Kind.OPERATION_DEFINITION,
	Kind.FRAGMENT_DEFINITION,
]);

/**
 * A request describes what to run, not what exists. Catalog definitions in a
 * request are refused rather than quietly ignored, because a client sending
 * them is usually pointing at the wrong endpoint.
 */
export const checkOnlyExecutableDefinitions = (
	context: ValidationContext,
	document: DocumentNode
): void => {
	for (const definition of document.definitions) {
		if (EXECUTABLE_KINDS.has(definition.kind)) continue;
		context.report(
			'A request may only hold operations and fragments; this document also describes a catalog',
			definition
		);
	}
};

/** Fragment names must be unique, and every fragment must target a real type. */
export const checkFragmentDefinitions = (
	context: ValidationContext,
	document: DocumentNode
): void => {
	const seen = new Set<string>();

	for (const definition of document.definitions) {
		if (definition.kind !== Kind.FRAGMENT_DEFINITION) continue;

		const name = definition.name.value;
		if (seen.has(name)) {
			context.report(
				`There can be only one fragment named "${name}"`,
				definition
			);
			continue;
		}
		seen.add(name);

		const condition = definition.typeCondition.name.value;
		if (context.catalog.getType(condition) === undefined) {
			context.report(
				`Unknown type "${condition}" in fragment "${name}"`,
				definition.typeCondition
			);
			continue;
		}
		if (!isCompositeName(context.catalog, condition)) {
			context.report(
				`Fragment "${name}" cannot be written on "${condition}", which has no fields`,
				definition.typeCondition
			);
		}
	}
};
