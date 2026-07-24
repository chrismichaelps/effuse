import { describe, it, expect, afterEach } from 'vitest';
import { handleLayerServerRequest } from '../../ssr/server-routing.js';
import { createResponseCache } from '../../ssr/response-cache.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const get = (path: string) => new Request(`http://localhost:3000${path}`);

describe('route dispatch with a response cache', () => {
	it('serves a repeated cacheable route from cache without re-running the handler', async () => {
		let calls = 0;
		const layer = defineLayer({
			name: 'catalog',
			server: {
				api: {
					'/api/products': {
						GET: () => {
							calls += 1;
							return { items: ['a', 'b'] };
						},
						metadata: { cache: { revalidate: 60 } },
					},
				},
			},
		});
		const cache = createResponseCache();

		const first = await handleLayerServerRequest(get('/api/products'), [layer], {
			cache,
		});
		const second = await handleLayerServerRequest(get('/api/products'), [layer], {
			cache,
		});

		expect(calls).toBe(1);
		expect(await first?.json()).toEqual({ items: ['a', 'b'] });
		// The cached serve must have its own readable body.
		expect(await second?.json()).toEqual({ items: ['a', 'b'] });
	});

	it('still applies the cache policy headers on a cached serve', async () => {
		const layer = defineLayer({
			name: 'catalog',
			server: {
				api: {
					'/api/tagged': {
						GET: () => ({ ok: true }),
						metadata: { cache: { revalidate: 30, tags: ['products'] } },
					},
				},
			},
		});
		const cache = createResponseCache();

		await handleLayerServerRequest(get('/api/tagged'), [layer], { cache });
		const cached = await handleLayerServerRequest(get('/api/tagged'), [layer], {
			cache,
		});

		expect(cached?.headers.get('Cache-Control')).toContain('s-maxage=30');
		expect(cached?.headers.get('X-Effuse-Cache-Tags')).toBe('products');
	});

	it('invalidates a cached route by its policy tags', async () => {
		let calls = 0;
		const layer = defineLayer({
			name: 'catalog',
			server: {
				api: {
					'/api/inv': {
						GET: () => {
							calls += 1;
							return { n: calls };
						},
						metadata: { cache: { revalidate: 60, tags: ['products'] } },
					},
				},
			},
		});
		const cache = createResponseCache();

		await handleLayerServerRequest(get('/api/inv'), [layer], { cache });
		cache.invalidateTags(['products']);
		await handleLayerServerRequest(get('/api/inv'), [layer], { cache });

		expect(calls).toBe(2);
	});

	it('does not cache a route without a revalidate policy', async () => {
		let calls = 0;
		const layer = defineLayer({
			name: 'catalog',
			server: {
				api: {
					'/api/dynamic': {
						GET: () => {
							calls += 1;
							return { ok: true };
						},
					},
				},
			},
		});
		const cache = createResponseCache();

		await handleLayerServerRequest(get('/api/dynamic'), [layer], { cache });
		await handleLayerServerRequest(get('/api/dynamic'), [layer], { cache });

		expect(calls).toBe(2);
	});

	it('never caches a mutating method even when a policy is present', async () => {
		let calls = 0;
		const layer = defineLayer({
			name: 'catalog',
			server: {
				api: {
					'/api/submit': {
						POST: () => {
							calls += 1;
							return { ok: true };
						},
						metadata: { cache: { revalidate: 60 } },
					},
				},
			},
		});
		const cache = createResponseCache();

		const post = () =>
			new Request('http://localhost:3000/api/submit', { method: 'POST' });
		await handleLayerServerRequest(post(), [layer], { cache });
		await handleLayerServerRequest(post(), [layer], { cache });

		expect(calls).toBe(2);
	});

	it('behaves exactly as before when no cache is supplied', async () => {
		let calls = 0;
		const layer = defineLayer({
			name: 'catalog',
			server: {
				api: {
					'/api/nocache': {
						GET: () => {
							calls += 1;
							return { ok: true };
						},
						metadata: { cache: { revalidate: 60 } },
					},
				},
			},
		});

		await handleLayerServerRequest(get('/api/nocache'), [layer]);
		await handleLayerServerRequest(get('/api/nocache'), [layer]);

		// Caching is opt-in; without a cache the handler runs every time.
		expect(calls).toBe(2);
	});

	it('returns null for an unmatched route without consulting the cache', async () => {
		const layer = defineLayer({
			name: 'catalog',
			server: { api: { '/api/known': { GET: () => ({ ok: true }) } } },
		});
		const cache = createResponseCache();

		const response = await handleLayerServerRequest(get('/api/missing'), [layer], {
			cache,
		});

		expect(response).toBeNull();
		expect(cache.size).toBe(0);
	});
});
