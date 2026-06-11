import { describe, it, expect, expectTypeOf, afterEach } from 'vitest';
import {
	callLayerAction,
	createLayerActionClient,
	createLayerActionPath,
	createLayerActionUrl,
	isLayerActionError,
	LayerActionError,
} from '../../ssr/actions.js';
import {
	LayerServerError,
	type LayerServerErrorBody,
} from '../../ssr/server-errors.js';
import { createHandler } from '../../ssr/handler.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { CreateTextNode } from '../../render/node.js';
import { EFFUSE_NODE } from '../../constants.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const createRoot = () =>
	CreateTextNode({ [EFFUSE_NODE]: true, text: 'Hello Actions' });

const createHandlerFetch =
	(handler: (request: Request) => Promise<Response>): typeof fetch =>
	(input, init) => {
		const request = input instanceof Request ? input : new Request(input, init);
		return handler(request);
	};

describe('layer action client', () => {
	it('should build legacy and namespaced action paths', () => {
		const AuthLayer = defineLayer({
			name: 'auth',
			server: {
				actions: {
					refresh: () => ({ ok: true }),
				},
			},
		});

		expect(createLayerActionPath('refresh')).toBe('/_effuse/actions/refresh');
		expect(createLayerActionPath(AuthLayer, 'refresh')).toBe(
			'/_effuse/actions/auth/refresh'
		);
		expect(createLayerActionUrl('refresh', 'http://localhost:3000')).toBe(
			'http://localhost:3000/_effuse/actions/refresh'
		);
		expect(
			createLayerActionUrl(AuthLayer, 'refresh', 'http://localhost:3000')
		).toBe('http://localhost:3000/_effuse/actions/auth/refresh');
		expect(createLayerActionUrl('auth', 'refresh')).toBe(
			'/_effuse/actions/auth/refresh'
		);
		expect(createLayerActionUrl('auth', 'refresh', 'http://localhost:3000')).toBe(
			'http://localhost:3000/_effuse/actions/auth/refresh'
		);
	});

	it('should call a typed layer action through the Effuse handler', async () => {
		const MathLayer = defineLayer({
			name: 'math',
			services: {
				math: () => ({ double: (value: number) => value * 2 }),
			},
			server: {
				actions: {
					double: async ({ json, services }) => {
						const input = await json<{ value: number }>();
						return { value: services.math.double(input.value) };
					},
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [MathLayer],
		});
		const fetch = createHandlerFetch(handler);

		const result = await callLayerAction(
			MathLayer,
			'double',
			{ value: 21 },
			{ baseUrl: 'http://localhost:3000', fetch }
		);

		expectTypeOf(result).toEqualTypeOf<{ value: number }>();
		expect(result).toEqual({ value: 42 });
	});

	it('should create a typed client for layer actions', async () => {
		const MathLayer = defineLayer({
			name: 'math-client',
			services: {
				math: () => ({ triple: (value: number) => value * 3 }),
			},
			server: {
				actions: {
					triple: async ({ json, services }) => {
						const input = await json<{ value: number }>();
						return { value: services.math.triple(input.value) };
					},
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [MathLayer],
		});
		const client = createLayerActionClient(MathLayer, {
			baseUrl: 'http://localhost:3000',
			fetch: createHandlerFetch(handler),
		});

		const result = await client.triple({ value: 7 });

		expectTypeOf(client.triple).toBeFunction();
		expect(result).toEqual({ value: 21 });
	});

	it('should resolve duplicate action names through layer-scoped URLs', async () => {
		const FirstLayer = defineLayer({
			name: 'first',
			server: {
				actions: {
					load: () => ({ source: 'first' }),
				},
			},
		});
		const SecondLayer = defineLayer({
			name: 'second',
			server: {
				actions: {
					load: () => ({ source: 'second' }),
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [FirstLayer, SecondLayer],
		});
		const secondClient = createLayerActionClient(SecondLayer, {
			baseUrl: 'http://localhost:3000',
			fetch: createHandlerFetch(handler),
		});

		const result = await secondClient.load();

		expect(result).toEqual({ source: 'second' });
	});

	it('should throw LayerActionError for non-ok responses', async () => {
		const FailingLayer = defineLayer({
			name: 'failing',
			server: {
				actions: {
					save: () => new Response('bad input', { status: 418 }),
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [FailingLayer],
		});

		await expect(
			callLayerAction(FailingLayer, 'save', undefined, {
				baseUrl: 'http://localhost:3000',
				fetch: createHandlerFetch(handler),
			})
		).rejects.toMatchObject({
			name: 'LayerActionError',
			status: 418,
			body: 'bad input',
		});

		await expect(
			callLayerAction(FailingLayer, 'save', undefined, {
				baseUrl: 'http://localhost:3000',
				fetch: createHandlerFetch(handler),
			})
		).rejects.toBeInstanceOf(LayerActionError);
	});

	it('should expose typed action error bodies', async () => {
		type SaveDeniedBody = LayerServerErrorBody<
			'SAVE_DENIED',
			{ readonly field: string }
		>;
		const FailingLayer = defineLayer({
			name: 'typed-failing',
			server: {
				actions: {
					save: ({ response }) =>
						response.error('SAVE_DENIED', 'Save denied.', {
							details: { field: 'email' },
							status: 409,
						}),
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [FailingLayer],
		});
		let caught: unknown;

		try {
			await callLayerAction(FailingLayer, 'save', undefined, {
				baseUrl: 'http://localhost:3000',
				fetch: createHandlerFetch(handler),
			});
		} catch (error) {
			caught = error;
		}

		expect(isLayerActionError<SaveDeniedBody>(caught)).toBe(true);
		if (!isLayerActionError<SaveDeniedBody>(caught)) {
			throw new Error('Expected a typed layer action error.');
		}
		expectTypeOf(caught.data?.error.code).toEqualTypeOf<
			'SAVE_DENIED' | undefined
		>();
		expect(caught.status).toBe(409);
		expect(caught.data).toEqual({
			error: {
				code: 'SAVE_DENIED',
				details: { field: 'email' },
				message: 'Save denied.',
				status: 409,
			},
		});
		expect(caught.error).toEqual(caught.data?.error);
		expect(caught.body).toContain('SAVE_DENIED');
	});

	it('should return thrown layer server errors from API routes', async () => {
		const ApiLayer = defineLayer({
			name: 'typed-api-errors',
			server: {
				api: {
					'/api/users/[id]': ({ params }) => {
						throw new LayerServerError('USER_NOT_FOUND', 'User not found.', {
							details: { id: params.id },
							status: 404,
						});
					},
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [ApiLayer],
		});

		const response = await handler(
			new Request('http://localhost:3000/api/users/u1')
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: 'USER_NOT_FOUND',
				details: { id: 'u1' },
				message: 'User not found.',
				status: 404,
			},
		});
	});

	it('should reject layer-scoped calls without an action name', async () => {
		const UnsafeLayer = defineLayer({
			name: 'unsafe-action-call',
			server: {
				actions: {
					ping: () => ({ ok: true }),
				},
			},
		});
		const callWithoutAction = callLayerAction as unknown as (
			layer: typeof UnsafeLayer
		) => Promise<unknown>;

		await expect(callWithoutAction(UnsafeLayer)).rejects.toThrow(
			'Effuse layer action name must be a string.'
		);
	});
});
