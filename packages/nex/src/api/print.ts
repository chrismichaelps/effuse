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

import { Effect } from 'effect';
import type { Catalog } from '../catalog/index.js';
import { printCatalog } from '../catalog/index.js';
import type { DocumentNode } from '../language/ast/index.js';
import { PrinterService } from '../services/index.js';
import { runOrThrow } from './runtime.js';

/** Render a document AST back to canonical Nex source. */
export const print = (document: DocumentNode): string =>
	runOrThrow(
		Effect.gen(function* () {
			const printer = yield* PrinterService;
			return yield* printer.print(document);
		})
	);

/**
 * Render a catalog back to source.
 *
 * Useful for writing a catalog to disk after building it from several files,
 * or for showing a client what it is talking to.
 */
export const printCatalogSource = (catalog: Catalog): string =>
	printCatalog(catalog);

export { printCatalog };
