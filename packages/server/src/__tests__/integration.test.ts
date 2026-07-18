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

import { describe, it, expect, afterEach } from 'vitest';
import {
	LayerServerError,
	isLayerServerErrorBody,
	layerServerErrorResponse,
} from '@effuse/core/server';
import { createNodeServer } from '../node/index.js';
import type { EffuseServer } from '../contract.js';

describe('integration: core typed errors over the Node adapter', () => {
	let server: EffuseServer | null = null;

	afterEach(async () => {
		if (server) {
			await server.close({ timeoutMs: 2000 });
			server = null;
		}
	});

	it('round-trips a core LayerServerError as a real HTTP response', async () => {
		server = createNodeServer(() =>
			layerServerErrorResponse(
				new LayerServerError('not_found', 'Missing resource', {
					status: 404,
					headers: { 'x-effuse-error': 'typed' },
				})
			)
		);
		const address = await server.listen({ port: 0 });

		const res = await fetch(address.url);
		expect(res.status).toBe(404);
		expect(res.headers.get('x-effuse-error')).toBe('typed');

		const body: unknown = await res.json();
		expect(isLayerServerErrorBody(body)).toBe(true);
		if (isLayerServerErrorBody(body)) {
			expect(body.error.code).toBe('not_found');
			expect(body.error.status).toBe(404);
		}
	});

	it('serves the same typed error in-process via fetch()', async () => {
		server = createNodeServer(() =>
			layerServerErrorResponse(
				new LayerServerError('forbidden', 'Nope', { status: 403 })
			)
		);
		const res = await server.fetch(new Request('http://local.test/secure'));
		expect(res.status).toBe(403);
		const body: unknown = await res.json();
		expect(isLayerServerErrorBody(body)).toBe(true);
	});
});
