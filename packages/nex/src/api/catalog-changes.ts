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
import { compareCatalogs as compare } from '../catalog/changes.js';
import type { CatalogChange } from '../catalog/changes.js';
import type { NexValidationError } from '../errors/index.js';
import type { OperationStore } from './operation-store.js';
import { validateRequest } from './validate-request.js';

/** One operation that a catalog no longer accepts. */
export interface BrokenOperation {
	/** The operation, as it is held. */
	readonly operation: string;
	/** What the catalog says about it now. */
	readonly problems: readonly NexValidationError[];
}

/** Anything that can hand over the operations to check. */
export type OperationSource = OperationStore | Iterable<string>;

const operationsOf = (source: OperationSource): readonly string[] => {
	if (typeof (source as OperationStore).ids === 'function') {
		const store = source as OperationStore;
		return store
			.ids()
			.map((id) => store.get(id))
			.filter((operation): operation is string => operation !== undefined);
	}

	return [...(source as Iterable<string>)];
};

/**
 * Check the operations a server holds against a catalog.
 *
 * Reading what changed says what a release asks of clients in the abstract;
 * this says which requests actually stop working, which is the question worth
 * answering before shipping.
 */
export const findBrokenOperations = (
	operations: OperationSource,
	catalog: Catalog
): readonly BrokenOperation[] => {
	const broken: BrokenOperation[] = [];

	for (const operation of operationsOf(operations)) {
		const problems = validateRequest(operation, catalog);
		if (problems.length === 0) continue;

		broken.push({ operation, problems });
	}

	return broken;
};

/** Compare two catalogs, and say what each difference asks of clients. */
export const compareCatalogs = (
	before: Catalog,
	after: Catalog
): readonly CatalogChange[] => compare(before, after);
