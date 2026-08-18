/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCacheControl } from '../../ssr/cache-control.js';
import { createHandler } from '../../ssr/handler.js';
import { define } from '../../blueprint/define.js';
import {
	CreateElementNode,
	EFFUSE_NODE,
	type Component,
} from '../../render/node.js';

const Root = define({
	script: () => ({}),
	template: () =>
		CreateElementNode({
			[EFFUSE_NODE]: true,
			tag: 'div',
			props: { id: 'app' },
			children: ['x'] as never,
		}),
}) as unknown as Component;

const headerFor = async (
	config: Record<string, unknown> = {}
): Promise<string | null> => {
	const handler = createHandler({ root: Root, layers: [], ...config } as never);
	const response = await handler(new Request('http://localhost/'));
	return response.headers.get('Cache-Control');
};

describe('buildCacheControl', () => {
	it('emits only what is set', () => {
		expect(buildCacheControl({})).toBe('');
		expect(buildCacheControl({ maxAge: 0 })).toBe('max-age=0');
		expect(buildCacheControl({ visibility: 'private' })).toBe('private');
	});

	it('reproduces the handler default', () => {
		expect(
			buildCacheControl({
				visibility: 'public',
				maxAge: 0,
				mustRevalidate: true,
			})
		).toBe('public, max-age=0, must-revalidate');
	});

	it('reproduces the route-data output', () => {
		// `server-routing.ts` has always sent the bare token here.
		expect(
			buildCacheControl({ sMaxAge: 60, staleWhileRevalidate: true })
		).toBe('s-maxage=60, stale-while-revalidate');
	});

	it('takes a window for the stale directives', () => {
		expect(
			buildCacheControl({ sMaxAge: 60, staleWhileRevalidate: 30, staleIfError: 5 })
		).toBe('s-maxage=60, stale-while-revalidate=30, stale-if-error=5');
	});

	it('drops everything beside no-store', () => {
		expect(
			buildCacheControl({
				noStore: true,
				visibility: 'public',
				maxAge: 60,
				sMaxAge: 60,
				staleWhileRevalidate: 30,
				mustRevalidate: true,
			})
		).toBe('no-store');
	});

	it('omits must-revalidate unless asked', () => {
		expect(buildCacheControl({ maxAge: 1, mustRevalidate: false })).toBe(
			'max-age=1'
		);
		expect(buildCacheControl({ maxAge: 1 })).toBe('max-age=1');
	});

	it('keeps a zero distinguishable from absent', () => {
		expect(buildCacheControl({ sMaxAge: 0 })).toBe('s-maxage=0');
		expect(buildCacheControl({})).toBe('');
	});
});

describe('createHandler Cache-Control', () => {
	it('is unchanged by default', async () => {
		// Anyone who has not opted in must see exactly the previous header.
		expect(await headerFor()).toBe('public, max-age=0, must-revalidate');
	});

	it('keeps the existing max-age and s-maxage options working', async () => {
		expect(await headerFor({ cacheMaxAge: 60, cacheSMaxAge: 3600 })).toBe(
			'public, max-age=60, s-maxage=3600, must-revalidate'
		);
	});

	it('can emit stale-while-revalidate', async () => {
		// The directive that lets a CDN answer instantly while it refreshes,
		// so an origin cold start never reaches a user.
		expect(
			await headerFor({ cacheSMaxAge: 3600, cacheStaleWhileRevalidate: 86400 })
		).toBe('public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
	});

	it('suppresses must-revalidate when stale serving is requested', async () => {
		// `must-revalidate` forbids serving stale, which is what
		// `stale-while-revalidate` is for; emitting both made the second dead.
		const header = await headerFor({ cacheStaleWhileRevalidate: 60 });

		expect(header).toContain('stale-while-revalidate=60');
		expect(header).not.toContain('must-revalidate');
	});

	it('still allows must-revalidate alongside it when asked explicitly', async () => {
		const header = await headerFor({
			cacheStaleWhileRevalidate: 60,
			cacheMustRevalidate: true,
		});

		expect(header).toContain('must-revalidate');
	});

	it('can drop must-revalidate on its own', async () => {
		expect(await headerFor({ cacheMustRevalidate: false })).toBe(
			'public, max-age=0'
		);
	});

	it('can emit stale-if-error', async () => {
		expect(
			await headerFor({ cacheSMaxAge: 60, cacheStaleIfError: 600 })
		).toContain('stale-if-error=600');
	});

	it('can mark a response private', async () => {
		expect(await headerFor({ cacheVisibility: 'private' })).toBe(
			'private, max-age=0, must-revalidate'
		);
	});

	it('can refuse storage entirely', async () => {
		expect(await headerFor({ cacheNoStore: true })).toBe('no-store');
	});

	it('takes a literal override for anything else', async () => {
		// Route metadata already accepts a full string; the document handler
		// had no equivalent.
		expect(
			await headerFor({
				cacheControl: 'public, s-maxage=1, stale-while-revalidate',
				cacheSMaxAge: 999,
			})
		).toBe('public, s-maxage=1, stale-while-revalidate');
	});

	it('still sends an ETag alongside a cacheable response', async () => {
		const handler = createHandler({
			root: Root,
			layers: [],
			cacheSMaxAge: 60,
			cacheStaleWhileRevalidate: 60,
		} as never);
		const response = await handler(new Request('http://localhost/'));

		expect(response.headers.get('ETag')).toBeTruthy();
	});
});
