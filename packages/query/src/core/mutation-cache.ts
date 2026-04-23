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

import { Mutation } from './mutation.js';
import type { MutationConfig, MutationState } from './mutation.js';

const hashKey = (key: readonly unknown[]): string => JSON.stringify(key);

/**
 * Manages Mutation instances by their mutation key.
 * Creates mutations on demand and notifies subscribers of state changes.
 */
export class MutationCache {
	private mutations: Map<string, Mutation<unknown, Error, unknown, unknown>> = new Map();
	private subscribers: Set<() => void> = new Set();
	private globalListeners: {
		onSuccess?: (data: unknown, variables: unknown, context: unknown | undefined) => void;
		onError?: (error: Error, variables: unknown, context: unknown | undefined) => void;
		onSettled?: (data: unknown | undefined, error: Error | null, variables: unknown, context: unknown | undefined) => void;
	} | undefined;

	constructor(options?: {
		onSuccess?: (data: unknown, variables: unknown, context: unknown | undefined) => void;
		onError?: (error: Error, variables: unknown, context: unknown | undefined) => void;
		onSettled?: (data: unknown | undefined, error: Error | null, variables: unknown, context: unknown | undefined) => void;
	}) {
		this.globalListeners = options ?? undefined;
	}

	build<TData, TError extends Error = Error, TVariables = unknown, TContext = unknown>(
		config: MutationConfig<TData, TError, TVariables, TContext>
	): Mutation<TData, TError, TVariables, TContext> {
		const key = config.mutationKey ?? [];
		const hash = hashKey(key);
		const existing = this.mutations.get(hash);

		if (existing) {
			return existing as unknown as Mutation<TData, TError, TVariables, TContext>;
		}

		const mergedConfig: MutationConfig<TData, TError, TVariables, TContext> = {
			...config,
			onSuccess: (data, variables, context) => {
				config.onSuccess?.(data, variables, context);
				this.globalListeners?.onSuccess?.(data, variables, context);
			},
			onError: (error, variables, context) => {
				config.onError?.(error, variables, context);
				this.globalListeners?.onError?.(error, variables, context);
			},
			onSettled: (data, error, variables, context) => {
				config.onSettled?.(data, error, variables, context);
				this.globalListeners?.onSettled?.(data, error, variables, context);
			},
		};

		const mutation = new Mutation<TData, TError, TVariables, TContext>(mergedConfig);
		this.mutations.set(hash, mutation as unknown as Mutation<unknown, Error, unknown, unknown>);

		const originalDispatch = mutation.dispatch.bind(mutation);
		mutation.dispatch = (action) => {
			originalDispatch(action);
			this.notify();
		};

		return mutation;
	}

	get<TData, TError extends Error = Error, TVariables = unknown, TContext = unknown>(
		key: readonly unknown[]
	): Mutation<TData, TError, TVariables, TContext> | undefined {
		const hash = hashKey(key);
		return this.mutations.get(hash) as unknown as Mutation<TData, TError, TVariables, TContext> | undefined;
	}

	remove(key: readonly unknown[]): boolean {
		const hash = hashKey(key);
		const mutation = this.mutations.get(hash);
		if (mutation) {
			mutation.reset();
			this.mutations.delete(hash);
			return true;
		}
		return false;
	}

	getAll(): Mutation<unknown, Error, unknown, unknown>[] {
		return Array.from(this.mutations.values());
	}

	getAllStates(): MutationState<unknown, Error, unknown>[] {
		return this.getAll().map((m) => m.currentState);
	}

	clear(): void {
		for (const mutation of this.mutations.values()) {
			mutation.reset();
		}
		this.mutations.clear();
	}

	get size(): number {
		return this.mutations.size;
	}

	get pendingCount(): number {
		return this.getAll().filter((m) => m.isPending).length;
	}

	subscribe(callback: () => void): () => void {
		this.subscribers.add(callback);
		return () => {
			this.subscribers.delete(callback);
		};
	}

	notify(): void {
		for (const subscriber of this.subscribers) {
			subscriber();
		}
	}
}
