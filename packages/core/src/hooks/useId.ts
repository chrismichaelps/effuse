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

import { createAsyncContextStorage } from '../utils/async-context.js';

interface IdScope {
	counter: number;
}

const idScopeStorage = createAsyncContextStorage<IdScope>();
let standaloneIdCounter = 0;

/** Establishes one deterministic ID sequence for a render owner. */
export const runWithIdScope = <T>(fn: () => T): T =>
	idScopeStorage.run({ counter: 0 }, fn);

/**
 * Generate a stable unique ID for accessibility attributes and SSR hydration.
 *
 * The ID is deterministic across SSR and client hydration when called in the
 * same order, making it safe for `id`, `aria-labelledby`, `htmlFor`, etc.
 *
 * @example
 * ```ts
 * const id = useId();
 * return <label htmlFor={id}>Name</label>
 *        <input id={id} />;
 * ```
 */
export const useId = (): string => {
	const scope = idScopeStorage.getStore();
	const nextId = scope ? ++scope.counter : ++standaloneIdCounter;
	return `:e${String(nextId)}`;
};
