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

import type { Catalog } from '../../catalog/index.js';
import type { FieldPathNode } from '../../language/ast/index.js';
import { namedTypeOf } from '../../validation/type-utils.js';
import type { ResolverInfo, Resolvers } from '../resolvers.js';
import { resolverFor } from '../resolvers.js';

/** What reading a path needs to know about the run it belongs to. */
export interface PathReader {
	readonly catalog: Catalog;
	readonly resolvers: Resolvers;
	readonly context: unknown;
	readonly info: ResolverInfo;
}

/**
 * Read a dotted path from a row.
 *
 * A property on the row wins; otherwise the field's resolver runs, so a
 * pipeline can filter or sort on a relation the row only points at.
 */
export const readPath = async (
	reader: PathReader,
	row: unknown,
	typeName: string,
	path: FieldPathNode
): Promise<unknown> => {
	let value: unknown = row;
	let owner = typeName;

	for (const segment of path.segments) {
		if (value === null || value === undefined) return undefined;

		const name = segment.value;
		const own =
			typeof value === 'object' && name in (value as Record<string, unknown>)
				? (value as Record<string, unknown>)[name]
				: undefined;

		if (own === undefined) {
			const resolver = reader.resolvers[owner]?.[name];
			value =
				resolver === undefined
					? undefined
					: await resolverFor(reader.resolvers, owner, name)(
							value,
							{},
							reader.context,
							{ ...reader.info, fieldName: name, parentTypeName: owner }
						);
		} else {
			value = own;
		}

		const definition = reader.catalog.getField(owner, name);
		if (definition === undefined) return value;
		owner = namedTypeOf(definition.type);
	}

	return value;
};
