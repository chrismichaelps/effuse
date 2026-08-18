/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	mkdtempSync,
	mkdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FetchHandler } from '../contract.js';
import { withStaticFiles } from '../internal/static-files.js';
import { createNodeServer } from '../node/index.js';

describe('withStaticFiles', () => {
	let root: string;
	let outside: string;
	let fallback: ReturnType<typeof vi.fn<FetchHandler>>;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'effuse-static-root-'));
		outside = mkdtempSync(join(tmpdir(), 'effuse-static-outside-'));
		mkdirSync(join(root, 'assets'), { recursive: true });
		mkdirSync(join(root, 'api'), { recursive: true });
		mkdirSync(join(root, '_effuse'), { recursive: true });
		mkdirSync(join(root, '.private'), { recursive: true });
		writeFileSync(
			join(root, 'assets', 'app-AbCd1234.js'),
			'export const ok = true;'
		);
		writeFileSync(join(root, 'styles.css'), 'body { color: black; }');
		writeFileSync(join(root, 'api', 'data.json'), '{"static":true}');
		writeFileSync(join(root, '_effuse', 'action.js'), 'reserved');
		writeFileSync(join(root, '.private', 'secret.txt'), 'secret');
		writeFileSync(join(outside, 'outside.txt'), 'outside');
		symlinkSync(join(outside, 'outside.txt'), join(root, 'escaped.txt'));
		fallback = vi.fn<FetchHandler>(() =>
			Promise.resolve(
				new Response('app fallback', {
					status: 418,
					headers: { 'X-Fallback': 'true' },
				})
			)
		);
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
		rmSync(outside, { recursive: true, force: true });
	});

	it('streams hashed assets with immutable cache and validators', async () => {
		const handler = withStaticFiles(fallback, { root });
		const response = await handler(
			new Request('https://example.test/assets/app-AbCd1234.js')
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('export const ok = true;');
		expect(response.headers.get('content-type')).toBe(
			'text/javascript; charset=utf-8'
		);
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=31536000, immutable'
		);
		expect(response.headers.get('etag')).toMatch(/^W\//u);
		expect(response.headers.get('last-modified')).toBeTruthy();
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(fallback).not.toHaveBeenCalled();
	});

	it('returns 304 for a matching entity tag', async () => {
		const handler = withStaticFiles(fallback, { root });
		const initial = await handler(
			new Request('https://example.test/styles.css')
		);
		const etag = initial.headers.get('etag');
		expect(etag).toBeTruthy();

		const response = await handler(
			new Request('https://example.test/styles.css', {
				headers: { 'If-None-Match': etag! },
			})
		);

		expect(response.status).toBe(304);
		expect(response.body).toBeNull();
		expect(response.headers.has('content-length')).toBe(false);
	});

	it('handles HEAD without opening a response body', async () => {
		const handler = withStaticFiles(fallback, { root });
		const response = await handler(
			new Request('https://example.test/styles.css', { method: 'HEAD' })
		);

		expect(response.status).toBe(200);
		expect(response.body).toBeNull();
		expect(response.headers.get('content-length')).toBe(
			String('body { color: black; }'.length)
		);
		expect(response.headers.get('cache-control')).toBe(
			'public, max-age=0, must-revalidate'
		);
	});

	it('cancels an open file stream when the request aborts', async () => {
		writeFileSync(join(root, 'large.bin'), Buffer.alloc(1024 * 1024, 1));
		const controller = new AbortController();
		const handler = withStaticFiles(fallback, { root });
		const response = await handler(
			new Request('https://example.test/large.bin', {
				signal: controller.signal,
			})
		);

		controller.abort();
		await expect(response.arrayBuffer()).rejects.toMatchObject({
			name: 'AbortError',
		});
	});

	it.each([
		['POST requests', '/styles.css', { method: 'POST' }],
		['missing files', '/missing.js', undefined],
		['API paths', '/api/data.json', undefined],
		['action paths', '/_effuse/action.js', undefined],
		['hidden paths', '/.private/secret.txt', undefined],
		['encoded traversal', '/%2e%2e%2foutside.txt', undefined],
		['malformed paths', '/%E0%A4%A', undefined],
		['symlinks outside the root', '/escaped.txt', undefined],
	] as const)('falls through for %s', async (_label, pathname, init) => {
		const handler = withStaticFiles(fallback, { root });
		const response = await handler(
			new Request(`https://example.test${pathname}`, init)
		);

		expect(response.status).toBe(418);
		expect(response.headers.get('x-fallback')).toBe('true');
		expect(await response.text()).toBe('app fallback');
		expect(fallback).toHaveBeenCalledOnce();
	});

	it('falls through when the configured root does not exist', async () => {
		const handler = withStaticFiles(fallback, {
			root: new URL('./missing/', `file://${root}/`),
		});
		const response = await handler(new Request('https://example.test/app.js'));

		expect(response.status).toBe(418);
	});

	it('serves files through the Node listener', async () => {
		const server = createNodeServer(withStaticFiles(fallback, { root }));
		const address = await server.listen();
		try {
			const response = await fetch(`${address.url}/styles.css`);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe('body { color: black; }');
		} finally {
			await server.close();
		}
	});
});
