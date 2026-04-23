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

import type { QueryKey } from '../core/types.js';

// ------------------------------------------------------------------
// Type machinery
// ------------------------------------------------------------------

type KeyDefinition = null | ((...args: readonly unknown[]) => readonly unknown[]);

type KeyOutput<TKey extends string, TDef extends KeyDefinition> = TDef extends null
	? readonly [TKey, string]
	: TDef extends (...args: infer A) => infer R
		? R extends readonly unknown[]
			? readonly [TKey, string, ...R]
			: never
		: never;

type KeyFactory<TKey extends string, TDefs extends Record<string, KeyDefinition>> = {
	readonly [K in keyof TDefs & string]: TDefs[K] extends null
		? () => KeyOutput<TKey, TDefs[K]>
		: TDefs[K] extends (...args: infer A) => infer R
			? (...args: A) => KeyOutput<TKey, TDefs[K]>
			: never;
};

// ------------------------------------------------------------------
// Implementation
// ------------------------------------------------------------------

/**
 * Creates a type-safe query key factory.
 *
 * @example
 * ```ts
 * const keys = createQueryKeys('users', {
 *   all: null,
 *   byId: (id: number) => [id],
 *   byIdWithPosts: (id: number) => [id, 'posts'],
 * });
 *
 * keys.all();                    // readonly ['users', 'all']
 * keys.byId(42);                 // readonly ['users', 'byId', 42]
 * keys.byIdWithPosts(42);        // readonly ['users', 'byIdWithPosts', 42, 'posts']
 * ```
 */
export const createQueryKeys = <
	const TKey extends string,
	const TDefs extends Record<string, KeyDefinition>,
>(
	rootKey: TKey,
	definitions: TDefs
): KeyFactory<TKey, TDefs> => {
	const factory = {} as Record<string, (...args: readonly unknown[]) => QueryKey>;

	for (const [name, def] of Object.entries(definitions)) {
		if (def === null) {
			factory[name] = () => Object.freeze([rootKey, name] as const);
		} else {
			factory[name] = (...args: readonly unknown[]) =>
				Object.freeze([rootKey, name, ...(def as (...args: readonly unknown[]) => readonly unknown[])(...args)] as const);
		}
	}

	return factory as unknown as KeyFactory<TKey, TDefs>;
};
