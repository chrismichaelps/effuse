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
import { documentFromIntrospection } from '../introspection/from-result.js';
import {
	buildCatalog,
	buildCatalogSafe,
	type CatalogResult,
} from './catalog.js';

/**
 * Rebuild a catalog from what a server said about itself.
 *
 * Give it the response to {@link INTROSPECTION_QUERY} - the whole thing, or
 * just the `__schema` inside it - and the result behaves like a catalog built
 * from source: a client can validate and analyse requests against it without
 * ever holding the server's own definitions.
 *
 * @throws {NexCatalogError} when the value is not an introspection result, or
 * describes a catalog that does not hold together.
 */
export const buildCatalogFromIntrospection = (result: unknown): Catalog =>
	buildCatalog(documentFromIntrospection(result));

/** The same, reporting problems as a value instead of throwing. */
export const buildCatalogFromIntrospectionSafe = (
	result: unknown
): CatalogResult => {
	try {
		return buildCatalogSafe(documentFromIntrospection(result));
	} catch (cause) {
		return {
			success: false,
			errors: [
				cause instanceof NexCatalogError
					? cause
					: new NexCatalogError({
							message: cause instanceof Error ? cause.message : String(cause),
						}),
			],
		};
	}
};
