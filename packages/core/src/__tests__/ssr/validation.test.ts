import { describe, it, expect, expectTypeOf, afterEach } from 'vitest';
import { callLayerAction, LayerActionError } from '../../ssr/actions.js';
import { createHandler } from '../../ssr/handler.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { CreateTextNode } from '../../render/node.js';
import { EFFUSE_NODE } from '../../constants.js';
import type { ServerValidationResult } from '../../ssr/validation.js';
import {
	serverSchema,
	type ServerSchemaInput,
	type ServerSchemaOutput,
} from '../../ssr/server-schema.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const createRoot = () =>
	CreateTextNode({ [EFFUSE_NODE]: true, text: 'Hello Validation' });

const createHandlerFetch =
	(handler: (request: Request) => Promise<Response>): typeof fetch =>
	(input, init) => {
		const request = input instanceof Request ? input : new Request(input, init);
		return handler(request);
	};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const success = <T>(data: T): ServerValidationResult<T> => ({
	success: true,
	data,
});

const failure = (message: string, path?: string): ServerValidationResult<never> => ({
	success: false,
	issues: [{ message, path }],
});

describe('server request validation', () => {
	it('validates and decodes with native Effuse server schemas', async () => {
		const QuerySchema = serverSchema.object({
			filter: serverSchema.string,
			page: serverSchema.optional(serverSchema.numberFromString, 1),
		});
		type QueryInput = ServerSchemaInput<typeof QuerySchema>;
		type QueryOutput = ServerSchemaOutput<typeof QuerySchema>;
		expectTypeOf({} as QueryInput).toEqualTypeOf<{
			filter: string;
			page?: string;
		}>();
		expectTypeOf({} as QueryOutput).toEqualTypeOf<{
			filter: string;
			page: number;
		}>();

		const ApiLayer = defineLayer({
			name: 'native-schema-api',
			server: {
				api: {
					'/api/search': ({ validate }) => {
						const query = validate.query(QuerySchema);
						expectTypeOf(query).toEqualTypeOf<QueryOutput>();
						return query;
					},
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [ApiLayer],
		});

		const response = await handler(
			new Request('http://localhost:3000/api/search?filter=active&page=2')
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			filter: 'active',
			page: 2,
		});
	});

	it('returns field paths for native Effuse schema failures', async () => {
		const QuerySchema = serverSchema.object({
			page: serverSchema.numberFromString,
		});
		const ApiLayer = defineLayer({
			name: 'native-schema-errors',
			server: {
				api: {
					'/api/pages': ({ validate }) => validate.query(QuerySchema),
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [ApiLayer],
		});

		const response = await handler(
			new Request('http://localhost:3000/api/pages?page=invalid')
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: {
				code: 'EFFUSE_VALIDATION_FAILED',
				issues: [{ path: 'page' }],
				source: 'query',
			},
		});
	});

	it('should validate route params, query, and headers', async () => {
		const ApiLayer = defineLayer({
			name: 'validated-api',
			server: {
				api: {
					'/api/users/[id]': ({ validate }) => {
						const params = validate.params<{ id: string }>((value) =>
							isRecord(value) && typeof value.id === 'string'
								? success({ id: value.id })
								: failure('Missing user id.', 'id')
						);
						const query = validate.query<{ tab: string }>((value) =>
							isRecord(value) && typeof value.tab === 'string'
								? success({ tab: value.tab })
								: failure('Missing tab query.', 'tab')
						);
						const headers = validate.headers<{ token: string }>((value) =>
							isRecord(value) && typeof value['x-token'] === 'string'
								? success({ token: value['x-token'] })
								: failure('Missing token header.', 'x-token')
						);

						expectTypeOf(params).toEqualTypeOf<{ id: string }>();
						return {
							id: params.id,
							tab: query.tab,
							token: headers.token,
						};
					},
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [ApiLayer],
		});

		const response = await handler(
			new Request('http://localhost:3000/api/users/u1?tab=settings', {
				headers: { 'x-token': 'secret' },
			})
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: 'u1',
			tab: 'settings',
			token: 'secret',
		});
	});

	it('should return structured 400 responses for invalid route input', async () => {
		const ApiLayer = defineLayer({
			name: 'invalid-api',
			server: {
				api: {
					'/api/users/[id]': ({ validate }) => {
						validate.query<{ tab: string }>((value) =>
							isRecord(value) && typeof value.tab === 'string'
								? success({ tab: value.tab })
								: failure('Missing tab query.', 'tab')
						);
						return { ok: true };
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

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: 'EFFUSE_VALIDATION_FAILED',
				issues: [{ message: 'Missing tab query.', path: 'tab' }],
				message: 'Request validation failed.',
				source: 'query',
			},
		});
	});

	it('should return structured 400 responses for invalid params', async () => {
		const ApiLayer = defineLayer({
			name: 'invalid-param-api',
			server: {
				api: {
					'/api/users/[id]': ({ validate }) => {
						validate.params<{ id: string }>((value) =>
							isRecord(value) &&
							typeof value.id === 'string' &&
							value.id.startsWith('u_')
								? success({ id: value.id })
								: failure('Invalid user id.', 'id')
						);
						return { ok: true };
					},
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [ApiLayer],
		});

		const response = await handler(
			new Request('http://localhost:3000/api/users/123?tab=settings')
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: 'EFFUSE_VALIDATION_FAILED',
				issues: [{ message: 'Invalid user id.', path: 'id' }],
				message: 'Request validation failed.',
				source: 'params',
			},
		});
	});

	it('should normalize schema safeParse error issues', async () => {
		const QuerySchema = {
			safeParse: (
				value: unknown
			): ServerValidationResult<{ page: string }> =>
				isRecord(value) && typeof value.page === 'string'
					? success({ page: value.page })
					: {
							success: false,
							error: {
								issues: [
									{
										code: 'invalid_type',
										message: 'Page query is required.',
										path: ['page'],
									},
								],
							},
						},
		};
		const ApiLayer = defineLayer({
			name: 'schema-api',
			server: {
				api: {
					'/api/schema': ({ validate }) => validate.query(QuerySchema),
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [ApiLayer],
		});

		const response = await handler(new Request('http://localhost:3000/api/schema'));

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: 'EFFUSE_VALIDATION_FAILED',
				issues: [
					{
						code: 'invalid_type',
						message: 'Page query is required.',
						path: 'page',
					},
				],
				message: 'Request validation failed.',
				source: 'query',
			},
		});
	});

	it('should validate action JSON bodies and surface LayerActionError', async () => {
		const ActionLayer = defineLayer({
			name: 'validated-action',
			server: {
				actions: {
					save: async ({ validate }) => {
						const input = await validate.json<{ name: string }>((value) =>
							isRecord(value) && typeof value.name === 'string'
								? success({ name: value.name })
								: failure('Name is required.', 'name')
						);
						return { saved: input.name };
					},
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [ActionLayer],
		});
		const fetch = createHandlerFetch(handler);

		await expect(
			callLayerAction(ActionLayer, 'save', { name: 'Ada' }, {
				baseUrl: 'http://localhost:3000',
				fetch,
			})
		).resolves.toEqual({ saved: 'Ada' });

		await expect(
			callLayerAction(ActionLayer, 'save', { name: 1 }, {
				baseUrl: 'http://localhost:3000',
				fetch,
			})
		).rejects.toMatchObject({
			name: 'LayerActionError',
			status: 400,
		});
		await expect(
			callLayerAction(ActionLayer, 'save', { name: 1 }, {
				baseUrl: 'http://localhost:3000',
				fetch,
			})
		).rejects.toBeInstanceOf(LayerActionError);
	});

	it('should return structured errors for malformed JSON bodies', async () => {
		const ActionLayer = defineLayer({
			name: 'malformed-json',
			server: {
				actions: {
					save: async ({ validate }) => validate.json(() => success({ ok: true })),
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [ActionLayer],
		});

		const response = await handler(
			new Request('http://localhost:3000/_effuse/actions/malformed-json/save', {
				method: 'POST',
				body: '{',
			})
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: {
				code: 'EFFUSE_VALIDATION_FAILED',
				issues: [{ code: 'invalid_json', message: 'Invalid JSON body.' }],
				source: 'json',
			},
		});
	});

	it('should validate form data bodies', async () => {
		const FormLayer = defineLayer({
			name: 'validated-form',
			server: {
				api: {
					'/api/forms': {
						POST: async ({ validate }) => {
							const input = await validate.formData<{ title: string }>((value) =>
								isRecord(value) && typeof value.title === 'string'
									? success({ title: value.title })
									: failure('Title is required.', 'title')
							);
							return { title: input.title };
						},
					},
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [FormLayer],
		});
		const formData = new FormData();
		formData.set('title', 'Launch');

		const response = await handler(
			new Request('http://localhost:3000/api/forms', {
				method: 'POST',
				body: formData,
			})
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ title: 'Launch' });
	});
});
