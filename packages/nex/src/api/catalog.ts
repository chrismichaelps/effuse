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

import { Effect, Either } from 'effect';
import type { Catalog } from '../catalog/index.js';
import type { NexCatalogError, NexSyntaxError } from '../errors/index.js';
import type { DocumentNode } from '../language/ast/index.js';
import { CatalogService, ParserService } from '../services/index.js';
import { runEither } from './runtime.js';

/** Either a Nex document or the source text of one. */
export type CatalogInput = string | DocumentNode;

/** A built catalog, or every reason the input could not produce one. */
export type CatalogResult =
	| { readonly success: true; readonly catalog: Catalog }
	| {
			readonly success: false;
			readonly errors: readonly (NexSyntaxError | NexCatalogError)[];
	  };

const buildProgram = (input: CatalogInput) =>
	Effect.gen(function* () {
		const catalogService = yield* CatalogService;
		const document =
			typeof input === 'string'
				? yield* (yield* ParserService).parse(input)
				: input;
		return yield* catalogService.build(document);
	});

/**
 * Build a catalog from schema definitions, reporting every problem it finds
 * instead of throwing.
 */
export const buildCatalogSafe = (input: CatalogInput): CatalogResult => {
	const result = runEither(buildProgram(input));

	if (Either.isLeft(result)) return { success: false, errors: [result.left] };
	return result.right.success
		? { success: true, catalog: result.right.catalog }
		: { success: false, errors: result.right.errors };
};

/**
 * Build a catalog from schema definitions.
 *
 * @throws {NexSyntaxError} when the source cannot be parsed.
 * @throws {NexCatalogError} for the first incoherence found; use
 * {@link buildCatalogSafe} to see every problem at once.
 */
export const buildCatalog = (input: CatalogInput): Catalog => {
	const result = buildCatalogSafe(input);
	if (result.success) return result.catalog;

	const [first] = result.errors;
	throw first ?? new Error('Failed to build catalog');
};
