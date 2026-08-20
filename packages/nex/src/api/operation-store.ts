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
import { normalizeRequest, requestKey } from './persisted.js';

/**
 * The operations a server is willing to run, by name.
 *
 * Each name is what {@link requestKey} makes of the operation, so a client
 * that ships its operations at build time and a server that registered the
 * same ones agree without exchanging anything else.
 */
export interface OperationStore {
	/** Take an operation in, and hand back the name it answers to. */
	readonly register: (operation: string | DocumentNode) => Promise<string>;
	/** The operation a name points at, written canonically. */
	readonly get: (id: string) => string | undefined;
	/** Whether a name is one this store holds. */
	readonly has: (id: string) => boolean;
	/** How many operations are held. */
	readonly size: number;
	/** Every name held, in the order they were registered. */
	readonly ids: () => readonly string[];
}

interface OperationStoreFactory {
	(): OperationStore;
	/** Build a store from operations already at hand. */
	readonly from: (
		operations: Iterable<string | DocumentNode>
	) => Promise<OperationStore>;
}

const create = (): OperationStore => {
	const operations = new Map<string, string>();

	return {
		register: async (operation) => {
			const normalized = normalizeRequest(operation);
			const id = await requestKey(normalized);
			operations.set(id, normalized);
			return id;
		},
		get: (id) => operations.get(id),
		has: (id) => operations.has(id),
		get size() {
			return operations.size;
		},
		ids: () => [...operations.keys()],
	};
};

/**
 * Hold the operations a server will run.
 *
 * A store turns an open endpoint into one that only runs what it was told
 * about, which is the cheapest way to bound what a client can ask for.
 */
export const createOperationStore: OperationStoreFactory = Object.assign(
	create,
	{
		from: async (
			operations: Iterable<string | DocumentNode>
		): Promise<OperationStore> => {
			const store = create();
			for (const operation of operations) await store.register(operation);
			return store;
		},
	}
);
