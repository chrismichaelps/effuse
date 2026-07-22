import { afterEach, describe, expect, it } from 'vitest';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import {
	compileLayerServerRouter,
	handleLayerServerRequest,
	matchLayerServerRequest,
} from '../../ssr/server-routing.js';
import { createInProcessRouteFetch } from '../../ssr/in-process-route-client.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const PrimaryLayer = defineLayer({
	name: 'primary',
	server: {
		api: {
			'/api/catalog/[id]': ({ params }) => ({
				kind: 'dynamic',
				id: params.id,
			}),
			'/api/catalog/new': () => ({ kind: 'static' }),
			'/api/docs/[...slug]': ({ params }) => ({ slug: params.slug }),
			'/api/shop/[[...slug]]': ({ params }) => ({
				slug: params.slug || 'index',
			}),
		},
		actions: {
			refresh: () => ({ owner: 'primary' }),
		},
	},
});

const SecondaryLayer = defineLayer({
	name: 'secondary',
	server: {
		actions: {
			refresh: () => ({ owner: 'secondary' }),
		},
	},
});

describe('compiled layer server router', () => {
	it('builds an immutable, idempotent graph summary', () => {
		const router = compileLayerServerRouter([PrimaryLayer, SecondaryLayer]);

		expect(router).toEqual({
			kind: 'effuse-layer-server-router',
			layerCount: 2,
			routeCount: 4,
			actionCount: 2,
		});
		expect(Object.isFrozen(router)).toBe(true);
		expect(compileLayerServerRouter(router)).toBe(router);
	});

	it('preserves route specificity and catch-all parameter behavior', async () => {
		const router = compileLayerServerRouter([PrimaryLayer]);
		const staticMatch = matchLayerServerRequest(
			new Request('http://localhost/api/catalog/new'),
			router
		);
		const dynamicMatch = matchLayerServerRequest(
			new Request('http://localhost/api/catalog/p1'),
			router
		);

		expect(staticMatch?.target).toBe('/api/catalog/new');
		expect(dynamicMatch?.params).toEqual({ id: 'p1' });
		const required = await handleLayerServerRequest(
			new Request('http://localhost/api/docs/guides/deploy'),
			router
		);
		const optional = await handleLayerServerRequest(
			new Request('http://localhost/api/shop'),
			router
		);
		expect(await required?.json()).toEqual({ slug: 'guides/deploy' });
		expect(await optional?.json()).toEqual({ slug: 'index' });
	});

	it('preserves HEAD fallback and 405 method discovery', async () => {
		const router = compileLayerServerRouter([PrimaryLayer]);
		const head = await handleLayerServerRequest(
			new Request('http://localhost/api/catalog/new', { method: 'HEAD' }),
			router
		);
		const rejected = await handleLayerServerRequest(
			new Request('http://localhost/api/catalog/new', { method: 'POST' }),
			router
		);

		expect(head?.status).toBe(200);
		expect(await head?.json()).toEqual({ kind: 'static' });
		expect(rejected?.status).toBe(405);
		expect(rejected?.headers.get('allow')).toBe('GET');
	});

	it('indexes qualified actions while preserving first-layer precedence', async () => {
		const router = compileLayerServerRouter([PrimaryLayer, SecondaryLayer]);
		const unqualified = await handleLayerServerRequest(
			new Request('http://localhost/_effuse/actions/refresh', {
				method: 'POST',
			}),
			router
		);
		const qualified = await handleLayerServerRequest(
			new Request('http://localhost/_effuse/actions/secondary/refresh', {
				method: 'POST',
			}),
			router
		);

		expect(await unqualified?.json()).toEqual({ owner: 'primary' });
		expect(await qualified?.json()).toEqual({ owner: 'secondary' });
	});

	it('keeps a stable snapshot until a new graph is compiled', () => {
		const router = compileLayerServerRouter([PrimaryLayer]);
		const source = PrimaryLayer as unknown as {
			server: { api: Record<string, unknown> };
		};
		source.server.api['/api/late'] = () => ({ late: true });

		try {
			expect(
				matchLayerServerRequest(
					new Request('http://localhost/api/late'),
					router
				)
			).toBeNull();
			expect(compileLayerServerRouter([PrimaryLayer]).routeCount).toBe(5);
		} finally {
			delete source.server.api['/api/late'];
		}
	});

	it('keeps raw-layer matching source compatible', () => {
		const match = matchLayerServerRequest(
			new Request('http://localhost/api/catalog/p2'),
			[PrimaryLayer]
		);
		expect(match?.params).toEqual({ id: 'p2' });
	});

	it('memoizes one graph for repeated in-process requests', async () => {
		const MutableLayer = defineLayer({
			name: 'mutable-router-source',
			server: { api: { '/api/known': () => ({ known: true }) } },
		});
		const source = MutableLayer as unknown as {
			server: { api: Record<string, unknown> };
		};
		const fetch = createInProcessRouteFetch([MutableLayer]);
		expect((await fetch('http://localhost/api/known')).status).toBe(200);
		source.server.api['/api/late'] = () => ({ late: true });

		try {
			expect((await fetch('http://localhost/api/late')).status).toBe(404);
			const refreshed = createInProcessRouteFetch([MutableLayer]);
			expect(await (await refreshed('http://localhost/api/late')).json()).toEqual({
				late: true,
			});
		} finally {
			delete source.server.api['/api/late'];
		}
	});
});
