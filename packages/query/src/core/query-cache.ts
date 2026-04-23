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

import { Query } from './query.js';
import type { QueryKey, QueryConfig, QuerySnapshot } from './types.js';

const hashKey = (key: QueryKey): string => JSON.stringify(key);

/**
 * Manages Query instances by their query key.
 * Creates queries on demand and schedules garbage collection.
 */
export class QueryCache {
	private queries: Map<string, Query<unknown, Error>> = new Map();

	/**
	 * Get or create a query for the given key and config.
	 */
	getOrCreate<TData, TError = Error>(
		config: QueryConfig<TData, TError>
	): Query<TData, TError> {
		const hash = hashKey(config.queryKey);
		const existing = this.queries.get(hash);

		if (existing) {
			// Update config if options changed
			(existing as Query<TData, TError>).options = config;
			return existing as Query<TData, TError>;
		}

		const query = new Query<TData, TError>(config);
		this.queries.set(hash, query as Query<unknown, Error>);
		return query;
	}

	/**
	 * Get an existing query without creating one.
	 */
	get<TData, TError = Error>(key: QueryKey): Query<TData, TError> | undefined {
		const hash = hashKey(key);
		const query = this.queries.get(hash);
		return query as Query<TData, TError> | undefined;
	}

	/**
	 * Remove a query from the cache.
	 */
	remove(key: QueryKey): boolean {
		const hash = hashKey(key);
		const query = this.queries.get(hash);
		if (query) {
			query.destroy();
			this.queries.delete(hash);
			return true;
		}
		return false;
	}

	/**
	 * Remove all inactive queries matching a predicate.
	 */
	removeInactive(predicate?: (query: Query<unknown, Error>) => boolean): void {
		for (const [hash, query] of this.queries) {
			if (!query.isActive && (!predicate || predicate(query))) {
				query.destroy();
				this.queries.delete(hash);
			}
		}
	}

	/**
	 * Get all queries.
	 */
	getAll(): Query<unknown, Error>[] {
		return Array.from(this.queries.values());
	}

	/**
	 * Get snapshots of all queries.
	 */
	getAllSnapshots(): QuerySnapshot<unknown, Error>[] {
		return this.getAll().map((q) => q.snapshot());
	}

	/**
	 * Clear all queries.
	 */
	clear(): void {
		for (const query of this.queries.values()) {
			query.destroy();
		}
		this.queries.clear();
	}

	/**
	 * Get the number of cached queries.
	 */
	get size(): number {
		return this.queries.size;
	}
}
