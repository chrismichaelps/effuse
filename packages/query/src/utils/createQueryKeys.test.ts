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

import { describe, it, expect } from 'vitest';
import { createQueryKeys } from './createQueryKeys.js';

describe('createQueryKeys', () => {
	it('creates a static key for null definitions', () => {
		const keys = createQueryKeys('users', {
			all: null,
		});

		expect(keys.all()).toEqual(['users', 'all']);
	});

	it('creates dynamic keys with parameters', () => {
		const keys = createQueryKeys('users', {
			byId: (id: number) => [id],
			byIdWithPosts: (id: number) => [id, 'posts'],
		});

		expect(keys.byId(42)).toEqual(['users', 'byId', 42]);
		expect(keys.byIdWithPosts(7)).toEqual(['users', 'byIdWithPosts', 7, 'posts']);
	});

	it('supports multiple static and dynamic keys', () => {
		const keys = createQueryKeys('posts', {
			all: null,
			byId: (id: number) => [id],
			bySlug: (slug: string) => [slug],
			comments: (id: number) => [id, 'comments'],
		});

		expect(keys.all()).toEqual(['posts', 'all']);
		expect(keys.byId(1)).toEqual(['posts', 'byId', 1]);
		expect(keys.bySlug('hello')).toEqual(['posts', 'bySlug', 'hello']);
		expect(keys.comments(1)).toEqual(['posts', 'comments', 1, 'comments']);
	});

	it('returns readonly tuples', () => {
		const keys = createQueryKeys('items', {
			all: null,
			byId: (id: number) => [id],
		});

		const allKey = keys.all();
		const byIdKey = keys.byId(5);

		// Type-level immutability verified by TypeScript compilation
		expect(allKey).toEqual(['items', 'all']);
		expect(byIdKey).toEqual(['items', 'byId', 5]);
		expect(Object.isFrozen(allKey)).toBe(true);
		expect(Object.isFrozen(byIdKey)).toBe(true);
	});
});
