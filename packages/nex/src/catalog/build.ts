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

import type { DocumentNode } from '../language/ast/index.js';
import type { NexCatalogError } from '../errors/index.js';
import { createCatalog, type Catalog } from './catalog.js';
import { checkCoherence } from './coherence.js';
import { indexDefinitions } from './index-definitions.js';

/** A catalog, or every reason the document could not produce one. */
export type CatalogBuild =
	| { readonly success: true; readonly catalog: Catalog }
	| { readonly success: false; readonly errors: readonly NexCatalogError[] };

/**
 * Index the type system definitions of `document` and check that they hang
 * together, reporting every problem rather than stopping at the first.
 */
export const buildCatalogFromDocument = (
	document: DocumentNode
): CatalogBuild => {
	const { index, errors } = indexDefinitions(document);
	const problems = [...errors, ...checkCoherence(index)];

	return problems.length > 0
		? { success: false, errors: problems }
		: { success: true, catalog: createCatalog(index) };
};
