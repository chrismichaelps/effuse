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
import { NexCatalogError } from '../errors/index.js';
import { INTROSPECTION_QUERY } from '../introspection/index.js';
import { execute } from './execute.js';

/** What a catalog answers about itself. */
export interface IntrospectionResult {
	readonly [key: string]: unknown;
}

/**
 * Describe a catalog the way introspection describes it.
 *
 * A build can write this to a file for clients that cannot ask a server, and
 * `buildCatalogFromIntrospection` reads it straight back. It answers by
 * running the introspection request rather than describing the catalog a
 * second way, so what a file holds and what a server says can never drift.
 */
export const introspectionFromCatalog = async (
	catalog: Catalog
): Promise<IntrospectionResult> => {
	const result = await execute({
		request: INTROSPECTION_QUERY,
		catalog,
		introspection: true,
	});

	const described = (result.data as { __schema?: IntrospectionResult } | null)
		?.__schema;

	if (described === undefined) {
		throw new NexCatalogError({
			message: `This catalog could not describe itself: ${
				result.errors?.[0]?.message ?? 'introspection returned nothing'
			}`,
		});
	}

	return described;
};
