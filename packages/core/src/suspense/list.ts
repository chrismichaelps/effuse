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

import type { Effect } from 'effect';
import { signal, computed } from '../reactivity/index.js';
import type { Signal, ReadonlySignal } from '../types/index.js';
import { createResource, type Resource } from './resource.js';
import type { ResourceOptions } from './schema.js';

export interface ListResource<T> {
	readonly items: Signal<T[]>;
	readonly loading: boolean;
	readonly error: unknown | undefined;
	readonly length: ReadonlySignal<number>;
	readonly isEmpty: ReadonlySignal<boolean>;
	readonly refetch: () => void;
	readonly append: (item: T) => void;
	readonly prepend: (item: T) => void;
	readonly remove: (predicate: (item: T) => boolean) => void;
	readonly update: (index: number, item: T) => void;
	readonly clear: () => void;
}

export const createListResource = <T>(
	fetcher: () => Effect.Effect<T[], Error> | Promise<T[]>,
	options?: ResourceOptions
): ListResource<T> => {
	const resource = createResource(fetcher, {
		...options,
		initialValue: (options?.initialValue as T[] | undefined) ?? [],
	});

	const items = signal<T[]>((resource.state.value.data as T[]) ?? []);

	const length = computed(() => items.value.length);
	const isEmpty = computed(() => items.value.length === 0);

	const syncFromResource = () => {
		const data = resource.state.value.data;
		if (data !== undefined) {
			items.value = data;
		}
	};

	return {
		items,

		get loading() {
			return resource.loading;
		},

		get error() {
			return resource.error;
		},

		length,
		isEmpty,

		refetch: () => {
			resource.refetch();
			queueMicrotask(syncFromResource);
		},

		append: (item: T) => {
			items.value = [...items.value, item];
		},

		prepend: (item: T) => {
			items.value = [item, ...items.value];
		},

		remove: (predicate: (item: T) => boolean) => {
			items.value = items.value.filter((i) => !predicate(i));
		},

		update: (index: number, item: T) => {
			const newItems = [...items.value];
			if (index >= 0 && index < newItems.length) {
				newItems[index] = item;
				items.value = newItems;
			}
		},

		clear: () => {
			items.value = [];
		},
	};
};

export interface MultiResource<T extends Record<string, unknown>> {
	readonly data: { [K in keyof T]: T[K] | undefined };
	readonly loading: ReadonlySignal<boolean>;
	readonly allLoaded: ReadonlySignal<boolean>;
	readonly errors: ReadonlySignal<Error[]>;
	readonly refetchAll: () => void;
}

export const createMultiResource = <T extends Record<string, unknown>>(
	fetchers: {
		[K in keyof T]: () => Effect.Effect<T[K], Error> | Promise<T[K]>;
	},
	options?: ResourceOptions
): MultiResource<T> => {
	const resources = Object.fromEntries(
		Object.entries(fetchers).map(([key, fetcher]) => [
			key,
			createResource(
				fetcher as () => Effect.Effect<unknown, Error> | Promise<unknown>,
				options
			),
		])
	) as { [K in keyof T]: Resource<T[K]> };

	const loading = computed(() =>
		Object.values(resources).some((r) => (r as Resource<unknown>).loading)
	);

	const allLoaded = computed(() =>
		Object.values(resources).every((r) => !(r as Resource<unknown>).loading)
	);

	const errors = computed(() =>
		Object.values(resources)
			.map((r) => (r as Resource<unknown>).error)
			.filter((e): e is Error => e instanceof Error)
	);

	const data = Object.fromEntries(
		Object.entries(resources).map(([key, resource]) => [
			key,
			computed(() => {
				try {
					return (resource as Resource<unknown>).value;
				} catch {
					return undefined;
				}
			}),
		])
	) as { [K in keyof T]: ReadonlySignal<T[K] | undefined> };

	const dataProxy = new Proxy({} as { [K in keyof T]: T[K] | undefined }, {
		get(_, key: string) {
			const sig = data[key as keyof T];
			return sig?.value;
		},
	});

	return {
		data: dataProxy,
		loading,
		allLoaded,
		errors,
		refetchAll: () => {
			Object.values(resources).forEach((r) => {
				(r as Resource<unknown>).refetch();
			});
		},
	};
};
