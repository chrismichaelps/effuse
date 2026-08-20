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
import type { FragmentDefinitionNode } from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import {
	generateCatalogTypes as writeCatalogTypes,
	generateOperationTypes,
	type ScalarTypes,
} from '../typegen/index.js';
import { parse } from './parse.js';
import { validateRequest, type RequestInput } from './validate-request.js';

/** How to write the types for a request. */
export interface GenerateTypesOptions {
	/** Check the request against the catalog first. Defaults to `true`. */
	readonly validate?: boolean | undefined;
	/**
	 * How to write the scalars the language does not define, in TypeScript.
	 *
	 * A custom scalar is whatever its server says it is, so only whoever wrote
	 * that server can say what it reads as: `{ Money: 'number' }` for a scalar
	 * held as cents, `{ Json: 'Record<string, unknown>' }` for one that is a
	 * document. Anything not named stays `unknown`, which is a caller having
	 * to say what they expect rather than being handed `any`.
	 */
	readonly scalars?: ScalarTypes | undefined;
}

/**
 * Write the TypeScript a request comes back as, and the variables it takes.
 *
 * One `Data` type per operation, named after it, plus a `Variables` type when
 * the operation declares any. What comes out is source: write it to a file
 * beside the request and a client is typed without a runtime in between.
 *
 * @throws {NexSyntaxError} when the source does not parse.
 * @throws {NexValidationError} when the request does not agree with the
 * catalog, since types written from a request that cannot run would lie.
 */
export const generateTypes = (
	input: RequestInput,
	catalog: Catalog,
	options: GenerateTypesOptions = {}
): string => {
	const document = typeof input === 'string' ? parse(input) : input;

	if (options.validate !== false) {
		const problems = validateRequest(document, catalog);
		const [first] = problems;
		if (first !== undefined) throw first;
	}

	const fragments = new Map<string, FragmentDefinitionNode>();
	for (const definition of document.definitions) {
		if (definition.kind !== Kind.FRAGMENT_DEFINITION) continue;
		if (!fragments.has(definition.name.value)) {
			fragments.set(definition.name.value, definition);
		}
	}

	const blocks: string[] = [];

	for (const definition of document.definitions) {
		if (definition.kind !== Kind.OPERATION_DEFINITION) continue;

		const written = generateOperationTypes(
			catalog,
			definition,
			fragments,
			options.scalars ?? {}
		);
		if (written !== '') blocks.push(written);
	}

	if (blocks.length === 0) {
		throw new NexValidationError({
			message: 'This document holds no operation to write types for',
		});
	}

	return `${blocks.join('\n\n')}\n`;
};

/** How to write a catalog's own types. */
export interface CatalogTypesOptions {
	/** How to write the scalars the language does not define, in TypeScript. */
	readonly scalars?: ScalarTypes | undefined;
}

/**
 * Write the TypeScript for everything a catalog holds.
 *
 * One type per catalog type, plus a `CatalogResolvers` map that types what
 * each resolver is given and what it must return, so a server is checked
 * against its own catalog rather than against a comment.
 */
export const generateCatalogTypes = (
	catalog: Catalog,
	options: CatalogTypesOptions = {}
): string =>
	writeCatalogTypes(
		catalog,
		options.scalars === undefined ? {} : { scalars: options.scalars }
	);
