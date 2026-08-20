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

import { Kind } from '../language/kinds/index.js';
import { printTypeSystemDefinition } from '../language/printer/index.js';
import type { Catalog } from './catalog.js';
import { BUILT_IN_DIRECTIVES } from './built-in-directives.js';

const BUILT_IN_DIRECTIVE_NAMES: ReadonlySet<string> = new Set(
	BUILT_IN_DIRECTIVES.map((directive) => directive.name.value)
);

/**
 * Render a catalog back to source.
 *
 * What comes out is what the catalog holds, not what was typed: extensions
 * have been folded into the types they extend, and the directives every
 * catalog carries are left out, since nobody wrote them.
 */
export const printCatalog = (catalog: Catalog): string => {
	const blocks: string[] = [];
	const roots = (['query', 'mutation', 'live'] as const)
		.map((operation) => ({ operation, type: catalog.getRootType(operation) }))
		.filter(
			(
				entry
			): entry is {
				operation: typeof entry.operation;
				type: NonNullable<typeof entry.type>;
			} => entry.type !== undefined
		);

	if (roots.length > 0) {
		blocks.push(
			printTypeSystemDefinition({
				kind: Kind.SCHEMA_DEFINITION,
				operationTypes: roots.map((root) => ({
					kind: Kind.OPERATION_TYPE_DEFINITION,
					operation: root.operation,
					type: { kind: Kind.NAMED_TYPE, name: root.type.name },
				})),
			})
		);
	}

	for (const definition of catalog.types.values()) {
		blocks.push(printTypeSystemDefinition(definition));
	}

	for (const [name, directive] of catalog.directives) {
		if (BUILT_IN_DIRECTIVE_NAMES.has(name)) continue;
		blocks.push(printTypeSystemDefinition(directive));
	}

	return blocks.join('\n\n');
};
