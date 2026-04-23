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

import { provide, inject } from '@effuse/core';
import { getGlobalQueryClient } from './client.js';
import type { QueryClientApi } from './client.js';

/**
 * Symbol key for provide/inject QueryClient scoping.
 * Uses a Symbol to avoid key collisions with user-provided values.
 */
export const QueryClientSymbol: unique symbol = Symbol.for(
	'effuse.query.client'
) as typeof QueryClientSymbol;

/**
 * Provide a QueryClient to the current Effuse component scope.
 * Child components and hooks will pick this up via `useQueryClient()`.
 *
 * @example
 * ```ts
 * import { provideQueryClient } from '@effuse/query';
 *
 * const App = () => {
 *   const client = createQueryClient();
 *   provideQueryClient(client);
 *   return MyPage();
 * };
 * ```
 */
export const provideQueryClient = (client: QueryClientApi): void => {
	provide(QueryClientSymbol, client);
};

/**
 * Inject the QueryClient from the current Effuse component scope.
 * Falls back to the global singleton if no provider is found.
 *
 * @example
 * ```ts
 * import { useQueryClient } from '@effuse/query';
 *
 * const MyComponent = () => {
 *   const client = useQueryClient();
 *   // ...
 * };
 * ```
 */
export const useQueryClient = (): QueryClientApi => {
	const client = inject<QueryClientApi>(QueryClientSymbol);
	if (client) {
		return client;
	}
	return getGlobalQueryClient();
};

/**
 * Type-safe helper to inject a QueryClient without fallback.
 * Throws if no provider is found.
 */
export const useQueryClientStrict = (): QueryClientApi => {
	const client = inject<QueryClientApi>(QueryClientSymbol);
	if (!client) {
		throw new Error(
			'No QueryClient found in component scope. ' +
			'Wrap your app in a QueryClientProvider or call provideQueryClient().'
		);
	}
	return client;
};
