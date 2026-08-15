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

// Executed with `bun test` (see `pnpm --filter @effuse/server test:bun`).
// vitest is configured to skip this file, so the Bun-only imports never load
// under Node.
import { describe, it, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bunAdapter, createBunServer, withStaticFiles } from '../bun/index.js';
import { runConformance } from '../conformance.js';

runConformance(bunAdapter, { describe, it, expect });

describe('Bun static files', () => {
	it('serves the client build before falling through to SSR', async () => {
		const root = mkdtempSync(join(tmpdir(), 'effuse-bun-static-'));
		mkdirSync(join(root, 'assets'));
		writeFileSync(
			join(root, 'assets', 'app-AbCd1234.js'),
			'export default 42;'
		);

		const server = createBunServer(
			withStaticFiles(() => new Response('SSR', { status: 404 }), { root })
		);
		const address = await server.listen();
		try {
			const asset = await fetch(`${address.url}/assets/app-AbCd1234.js`);
			expect(asset.status).toBe(200);
			expect(await asset.text()).toBe('export default 42;');
			expect(asset.headers.get('cache-control')).toBe(
				'public, max-age=31536000, immutable'
			);
			const etag = asset.headers.get('etag');
			expect(etag).toBeTruthy();

			const head = await fetch(`${address.url}/assets/app-AbCd1234.js`, {
				method: 'HEAD',
			});
			expect(head.status).toBe(200);
			expect(await head.text()).toBe('');
			expect(head.headers.get('content-length')).toBe(
				String('export default 42;'.length)
			);

			const unchanged = await fetch(`${address.url}/assets/app-AbCd1234.js`, {
				headers: { 'If-None-Match': etag! },
			});
			expect(unchanged.status).toBe(304);
			expect(await unchanged.text()).toBe('');

			const route = await fetch(`${address.url}/dashboard`);
			expect(route.status).toBe(404);
			expect(await route.text()).toBe('SSR');

			const traversal = await fetch(`${address.url}/%2e%2e%2fpackage.json`);
			expect(traversal.status).toBe(404);
			expect(await traversal.text()).toBe('SSR');
		} finally {
			await server.close();
			rmSync(root, { recursive: true, force: true });
		}
	});
});
