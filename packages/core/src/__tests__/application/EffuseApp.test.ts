import { describe, it, expect } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { LayerNameCollisionError } from '../../layers/errors.js';
import { CreateTextNode, type Component } from '../../render/node.js';
import { EFFUSE_NODE } from '../../constants.js';

const createRoot = (): Component => {
	const textNode = CreateTextNode({ [EFFUSE_NODE]: true, text: 'Hello app' });
	return Object.assign(() => textNode, {
		_tag: 'Blueprint',
		view: () => textNode,
	}) as Component;
};

const createTrackedLayer = (name: string) => {
	let serverReads = 0;
	const layer = defineLayer({
		name,
		server: {
			api: {
				'/api/probe': () => ({ ok: true }),
			},
		},
	});
	return {
		layer: new Proxy(layer, {
			get(target, property, receiver) {
				if (property === 'server') serverReads += 1;
				return Reflect.get(target, property, receiver);
			},
		}),
		serverReads: () => serverReads,
	};
};

describe('EffuseApp', () => {
	describe('handleRequest', () => {
		it('should reuse server routing for equivalent option values', async () => {
			const tracked = createTrackedLayer('request-handler-cache');
			const app = await createApp(createRoot()).useLayers([tracked.layer]);
			const manifest = {
				'src/entry-client.ts': {
					file: 'assets/app.js',
					isEntry: true,
				},
			};
			const request = new Request('http://localhost/app.js');

			expect((await app.handleRequest(request, { manifest })).status).toBe(404);
			const readsAfterFirstRequest = tracked.serverReads();
			expect(readsAfterFirstRequest).toBeGreaterThan(0);
			expect(
				(await app.handleRequest(request, { manifest, hydrate: undefined }))
					.status
			).toBe(404);
			expect(tracked.serverReads()).toBe(readsAfterFirstRequest);
		});

		it('should rebuild server routing when effective options change', async () => {
			const tracked = createTrackedLayer('request-handler-options');
			const app = await createApp(createRoot()).useLayers([tracked.layer]);
			const request = new Request('http://localhost/app.js');

			await app.handleRequest(request, { clientEntry: '/first.js' });
			const readsAfterFirstRequest = tracked.serverReads();
			await app.handleRequest(request, { clientEntry: '/second.js' });

			expect(tracked.serverReads()).toBeGreaterThan(readsAfterFirstRequest);
		});

		it('should invalidate server routing when layers change', async () => {
			const first = createTrackedLayer('request-handler-first');
			const second = createTrackedLayer('request-handler-second');
			const app = await createApp(createRoot()).useLayers([first.layer]);
			const request = new Request('http://localhost/app.js');

			await app.handleRequest(request);
			const firstReads = first.serverReads();
			await app.useLayers([second.layer]);
			await app.handleRequest(request);

			expect(first.serverReads()).toBe(firstReads);
			expect(second.serverReads()).toBeGreaterThan(0);
		});

		it('should isolate concurrent request scopes while reusing the handler', async () => {
			let arrivals = 0;
			let release: (() => void) | undefined;
			const bothArrived = new Promise<void>((resolve) => {
				release = resolve;
			});
			const ApiLayer = defineLayer({
				name: 'request-handler-isolation',
				server: {
					api: {
						'/api/isolation': async (ctx) => {
							ctx.locals.id = ctx.query.id;
							arrivals += 1;
							if (arrivals === 2) release?.();
							await bothArrived;
							return { id: ctx.locals.id };
						},
					},
				},
			});
			const app = await createApp(createRoot()).useLayers([ApiLayer]);

			const [first, second] = await Promise.all([
				app.handleRequest(
					new Request('http://localhost/api/isolation?id=first')
				),
				app.handleRequest(
					new Request('http://localhost/api/isolation?id=second')
				),
			]);

			expect(await first.json()).toEqual({ id: 'first' });
			expect(await second.json()).toEqual({ id: 'second' });
		});
	});

	describe('mount', () => {
		it('should reject duplicate layer names before touching the DOM', async () => {
			const FirstLayer = defineLayer({
				name: 'duplicate-app',
			});
			const SecondLayer = defineLayer({
				name: 'duplicate-app',
			});
			const app = await createApp(createRoot()).useLayers([
				FirstLayer,
				SecondLayer,
			]);

			await expect(app.mount('#missing-target')).rejects.toThrow(
				LayerNameCollisionError
			);
			await expect(app.mount('#missing-target')).rejects.toThrow(
				'Layer "duplicate-app" is registered more than once'
			);
		});
	});
});
