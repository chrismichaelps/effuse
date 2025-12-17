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

import type { Middleware } from './types.js';

export interface MiddlewareManager<T extends Record<string, unknown>> {
	add: (middleware: Middleware<T>) => () => void;
	remove: (middleware: Middleware<T>) => void;
	execute: (state: T, action: string, args: unknown[]) => T;
	getAll: () => readonly Middleware<T>[];
}

export const createMiddlewareManager = <
	T extends Record<string, unknown>,
>(): MiddlewareManager<T> => {
	const middlewares: Middleware<T>[] = [];

	return {
		add: (middleware: Middleware<T>) => {
			middlewares.push(middleware);
			return () => {
				const idx = middlewares.indexOf(middleware);
				if (idx > -1) middlewares.splice(idx, 1);
			};
		},

		remove: (middleware: Middleware<T>) => {
			const idx = middlewares.indexOf(middleware);
			if (idx > -1) middlewares.splice(idx, 1);
		},

		execute: (state: T, action: string, args: unknown[]): T => {
			let newState = { ...state };
			for (const mw of middlewares) {
				const result = mw(newState, action, args);
				if (result) newState = result;
			}
			return newState;
		},

		getAll: () => [...middlewares],
	};
};
