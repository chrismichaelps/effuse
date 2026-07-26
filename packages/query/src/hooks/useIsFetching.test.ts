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

import { describe, it, expect, vi } from 'vitest';
import { createQueryClient } from '../client/client.js';
import { useIsFetching } from './useIsFetching.js';

describe('useIsFetching', () => {
	it('returns 0 when no queries are fetching', () => {
		const client = createQueryClient();
		const isFetching = useIsFetching({ client });

		expect(isFetching.value).toBe(0);
	});

	it('returns the count of fetching queries', async () => {
		const client = createQueryClient();

		const query = client.getQuery({
			queryKey: ['test'],
			queryFn: async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				return 'data';
			},
		});

		const isFetching = useIsFetching({ client });
		expect(isFetching.value).toBe(0);

		// Start fetching
		query.fetch();

		// Wait a tick for dispatch to propagate
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(isFetching.value).toBe(1);

		// Wait for fetch to complete
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(isFetching.value).toBe(0);
	});

	it('updates reactively when multiple queries fetch', async () => {
		const client = createQueryClient();

		const q1 = client.getQuery({
			queryKey: ['a'],
			queryFn: async () => {
				await new Promise((resolve) => setTimeout(resolve, 100));
				return 'a';
			},
		});

		const q2 = client.getQuery({
			queryKey: ['b'],
			queryFn: async () => {
				await new Promise((resolve) => setTimeout(resolve, 100));
				return 'b';
			},
		});

		const isFetching = useIsFetching({ client });
		expect(isFetching.value).toBe(0);

		q1.fetch();
		q2.fetch();

		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(isFetching.value).toBe(2);

		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(isFetching.value).toBe(0);
	});
});
