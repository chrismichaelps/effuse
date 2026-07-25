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

import type { EffuseStorage } from './storage.js';

/**
 * Structural view of the matcher and runner primitives shared by vitest and
 * `bun:test`, so the same suite runs unchanged under either runner.
 */
interface Matchers {
	toBe(expected: unknown): void;
	toEqual(expected: unknown): void;
	toBeUndefined(): void;
	toHaveLength(expected: number): void;
}

export interface StorageConformanceHarness {
	describe(name: string, fn: () => void): void;
	it(name: string, fn: () => Promise<void> | void): void;
	expect(actual: unknown): Matchers;
}

/**
 * Runs the portable storage conformance suite against an adapter factory.
 *
 * These are the semantics every Effuse storage backend must provide, so a
 * Redis, filesystem, or vendor adapter can re-use this suite verbatim rather
 * than re-deriving what "correct" means.
 */
export const runStorageConformance = (
	name: string,
	create: () => EffuseStorage,
	harness: StorageConformanceHarness
): void => {
	// Wrap in arrows so the runner methods keep their original `this` binding.
	const describe = (name: string, fn: () => void): void => {
		harness.describe(name, fn);
	};
	const it = (name: string, fn: () => Promise<void> | void): void => {
		harness.it(name, fn);
	};
	const expect = (actual: unknown): Matchers => harness.expect(actual);

	describe(`storage conformance: ${name}`, () => {
		it('round-trips a value', async () => {
			const storage = create();
			await storage.set('k', { n: 1 });
			expect(await storage.get<{ n: number }>('k')).toEqual({ n: 1 });
		});

		it('resolves undefined for a missing key rather than throwing', async () => {
			const storage = create();
			expect(await storage.get('absent')).toBeUndefined();
		});

		it('overwrites an existing key', async () => {
			const storage = create();
			await storage.set('k', 'first');
			await storage.set('k', 'second');
			expect(await storage.get('k')).toBe('second');
		});

		it('reports presence with has', async () => {
			const storage = create();
			expect(await storage.has('k')).toBe(false);
			await storage.set('k', 1);
			expect(await storage.has('k')).toBe(true);
		});

		it('deletes a key', async () => {
			const storage = create();
			await storage.set('k', 1);
			await storage.delete('k');
			expect(await storage.has('k')).toBe(false);
			expect(await storage.get('k')).toBeUndefined();
		});

		it('tolerates deleting a missing key', async () => {
			const storage = create();
			await storage.delete('absent');
			expect(await storage.has('absent')).toBe(false);
		});

		it('lists its keys', async () => {
			const storage = create();
			await storage.set('a', 1);
			await storage.set('b', 2);
			const keys = [...(await storage.keys())].sort();
			expect(keys).toEqual(['a', 'b']);
		});

		it('clears every key', async () => {
			const storage = create();
			await storage.set('a', 1);
			await storage.set('b', 2);
			await storage.clear();
			expect(await storage.keys()).toHaveLength(0);
		});

		it('stores falsy values distinctly from absence', async () => {
			const storage = create();
			await storage.set('zero', 0);
			await storage.set('empty', '');
			await storage.set('false', false);
			await storage.set('null', null);

			expect(await storage.get('zero')).toBe(0);
			expect(await storage.get('empty')).toBe('');
			expect(await storage.get('false')).toBe(false);
			expect(await storage.get('null')).toBe(null);
			// Each is present, unlike a genuinely missing key.
			expect(await storage.has('zero')).toBe(true);
			expect(await storage.has('missing')).toBe(false);
		});

		it('isolates namespaces from each other', async () => {
			const storage = create();
			const a = storage.namespace('a');
			const b = storage.namespace('b');

			await a.set('shared', 'from-a');
			await b.set('shared', 'from-b');

			expect(await a.get('shared')).toBe('from-a');
			expect(await b.get('shared')).toBe('from-b');
		});

		it('clears one namespace without touching another', async () => {
			const storage = create();
			const a = storage.namespace('a');
			const b = storage.namespace('b');

			await a.set('k', 1);
			await b.set('k', 2);
			await a.clear();

			expect(await a.get('k')).toBeUndefined();
			expect(await b.get('k')).toBe(2);
		});

		it('scopes keys() to the namespace', async () => {
			const storage = create();
			const scoped = storage.namespace('scoped');

			await storage.set('root-key', 1);
			await scoped.set('scoped-key', 2);

			expect(await scoped.keys()).toEqual(['scoped-key']);
		});

		it('supports nested namespaces', async () => {
			const storage = create();
			const nested = storage.namespace('outer').namespace('inner');

			await nested.set('k', 'deep');
			expect(await nested.get('k')).toBe('deep');
			expect(await storage.namespace('outer').get('k')).toBeUndefined();
		});
	});
};
