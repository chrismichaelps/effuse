import { describe, it, expect } from 'vitest';
import { defineServerRequest } from '../../ssr/request-contract.js';
import { defineServerRoute } from '../../ssr/route-contract.js';
import { serverSchema } from '../../ssr/server-schema.js';
import { streamResponse } from '../../ssr/response-contract.js';
import { generateOpenApiDocument } from '../../ssr/openapi.js';

const userRoute = defineServerRoute({
	path: '/api/users/:id',
	request: defineServerRequest({
		params: serverSchema.object({ id: serverSchema.numberFromString }),
		query: serverSchema.object({ verbose: serverSchema.booleanFromString }),
		json: serverSchema.object({ name: serverSchema.string }),
	}),
	response: serverSchema.object({ ok: serverSchema.boolean }),
	errors: serverSchema.object({
		code: serverSchema.string,
		balance: serverSchema.number,
	}),
	POST: () => ({ ok: true }),
});

const downloadRoute = defineServerRoute({
	path: '/api/download',
	request: defineServerRequest({}),
	response: streamResponse(),
	GET: () => new Response('bytes'),
});

const uploadRoute = defineServerRoute({
	path: '/api/upload',
	request: defineServerRequest({
		formData: serverSchema.object({
			avatar: serverSchema.file,
			caption: serverSchema.string,
		}),
	}),
	POST: () => ({ ok: true }),
});

const info = { title: 'Effuse API', version: '1.0.0' };

describe('generateOpenApiDocument', () => {
	it('emits a 3.1 document with info', () => {
		const doc = generateOpenApiDocument({ user: userRoute }, info);
		expect(doc.openapi).toBe('3.1.0');
		expect(doc.info).toEqual(info);
	});

	it('converts route path params to OpenAPI template syntax', () => {
		const doc = generateOpenApiDocument({ user: userRoute }, info);
		expect(doc.paths['/api/users/{id}']).toBeDefined();
		expect(doc.paths['/api/users/:id']).toBeUndefined();
	});

	it('describes path, query params and a JSON request body', () => {
		const doc = generateOpenApiDocument({ user: userRoute }, info);
		const op = doc.paths['/api/users/{id}'].post as Record<string, unknown>;

		const params = op.parameters as {
			name: string;
			in: string;
			required?: boolean;
		}[];
		const id = params.find((p) => p.name === 'id');
		const verbose = params.find((p) => p.name === 'verbose');
		expect(id?.in).toBe('path');
		expect(id?.required).toBe(true);
		expect(verbose?.in).toBe('query');

		const body = op.requestBody as {
			required: boolean;
			content: Record<
				string,
				{ schema: { properties: Record<string, unknown> } }
			>;
		};
		expect(body.required).toBe(true);
		expect(
			body.content['application/json'].schema.properties.name
		).toBeDefined();
	});

	it('describes a JSON success response and an error response', () => {
		const doc = generateOpenApiDocument({ user: userRoute }, info);
		const op = doc.paths['/api/users/{id}'].post as {
			responses: Record<string, { content?: Record<string, unknown> }>;
		};
		expect(op.responses['200'].content?.['application/json']).toBeDefined();
		// The errors contract carries no status code, so it maps to `default`.
		expect(op.responses.default.content?.['application/json']).toBeDefined();
	});

	it('describes recursively composed object arrays', () => {
		const route = defineServerRoute({
			path: '/api/posts',
			request: defineServerRequest({}),
			response: serverSchema.object({
				items: serverSchema.array(
					serverSchema.object({
						id: serverSchema.numberFromString,
						title: serverSchema.string,
					})
				),
			}),
			GET: () => ({ items: [{ id: 1, title: 'Effuse' }] }),
		});
		const doc = generateOpenApiDocument({ route }, info);
		const operation = doc.paths['/api/posts'].get as {
			responses: Record<
				string,
				{
					content?: Record<string, { schema: Record<string, unknown> }>;
				}
			>;
		};

		expect(
			operation.responses['200'].content?.['application/json']?.schema
		).toMatchObject({
			type: 'object',
			properties: {
				items: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: { $ref: '#/components/schemas/NumberFromString' },
						},
						required: ['id', 'title'],
					},
				},
			},
		});
		expect(doc.components?.schemas.NumberFromString).toMatchObject({
			type: 'string',
		});
	});

	it('describes a streaming response as binary', () => {
		const doc = generateOpenApiDocument({ download: downloadRoute }, info);
		const op = doc.paths['/api/download'].get as {
			responses: Record<
				string,
				{ content?: Record<string, { schema: Record<string, unknown> }> }
			>;
		};
		const schema =
			op.responses['200'].content?.['application/octet-stream']?.schema;
		expect(schema).toEqual({ type: 'string', format: 'binary' });
	});

	it('describes a multipart upload with a binary file field', () => {
		const doc = generateOpenApiDocument({ upload: uploadRoute }, info);
		const op = doc.paths['/api/upload'].post as {
			requestBody: {
				content: Record<
					string,
					{
						schema: {
							properties: Record<string, { type?: string; format?: string }>;
						};
					}
				>;
			};
		};
		const schema = op.requestBody.content['multipart/form-data'].schema;
		expect(schema.properties.avatar).toEqual({
			type: 'string',
			format: 'binary',
			description: 'an instance of File',
			title: 'File',
		});
	});

	it('hoists shared $defs into components.schemas and rewrites refs', () => {
		const doc = generateOpenApiDocument({ user: userRoute }, info);
		// numberFromString emits a named $def; it must live under components.schemas
		// and be referenced there, never via a bare #/$defs pointer.
		expect(doc.components?.schemas?.NumberFromString).toBeDefined();
		const op = doc.paths['/api/users/{id}'].post as {
			parameters: { name: string; schema: Record<string, unknown> }[];
		};
		const id = op.parameters.find((p) => p.name === 'id');
		expect(id?.schema).toEqual({
			$ref: '#/components/schemas/NumberFromString',
		});
	});

	it('uses the shared Effuse grammar for groups, bracket params and optional catch-alls', () => {
		const route = defineServerRoute({
			path: '/(docs)/docs/[[...slug]]',
			request: defineServerRequest({
				params: serverSchema.object({
					slug: serverSchema.optional(serverSchema.string),
				}),
			}),
			response: serverSchema.object({ ok: serverSchema.boolean }),
			GET: () => ({ ok: true }),
		});

		const doc = generateOpenApiDocument({ docs: route }, info);
		expect(doc.paths['/(docs)/docs/[[...slug]]']).toBeUndefined();
		expect(doc.paths['/docs']).toBeDefined();
		const nested = doc.paths['/docs/{slug}'].get as {
			parameters: Record<string, unknown>[];
		};
		expect(nested.parameters).toContainEqual({
			name: 'slug',
			in: 'path',
			required: true,
			schema: { type: 'string' },
			'x-effuse-catch-all': true,
		});
		expect(
			(doc.paths['/docs'].get as { parameters?: unknown[] }).parameters
		).toBeUndefined();
	});

	it('honors response status and streaming content type metadata', () => {
		const route = defineServerRoute({
			path: '/api/events',
			request: defineServerRequest({}),
			response: streamResponse(),
			metadata: {
				status: 206,
				headers: { 'Content-Type': 'text/event-stream' },
			},
			GET: () => new Response('data: ready'),
		});

		const doc = generateOpenApiDocument({ events: route }, info);
		const responses = (
			doc.paths['/api/events'].get as {
				responses: Record<string, { content?: Record<string, unknown> }>;
			}
		).responses;
		expect(responses['200']).toBeUndefined();
		expect(responses['206'].content?.['text/event-stream']).toBeDefined();
	});

	it('rejects route and params contracts that would produce invalid OpenAPI', () => {
		const missingParam = defineServerRoute({
			path: '/api/users/[id]',
			request: defineServerRequest({}),
			GET: () => ({ ok: true }),
		});
		const extraParam = defineServerRoute({
			path: '/api/users',
			request: defineServerRequest({
				params: serverSchema.object({ id: serverSchema.string }),
			}),
			GET: () => ({ ok: true }),
		});

		expect(() => generateOpenApiDocument({ missingParam }, info)).toThrow(
			'missing request.params schema field "id"'
		);
		expect(() => generateOpenApiDocument({ extraParam }, info)).toThrow(
			'declares non-route params field "id"'
		);
	});

	it('rejects unsupported validators with route context', () => {
		const route = defineServerRoute({
			path: '/api/custom',
			request: defineServerRequest({
				query: (value: unknown) => value,
			}),
			GET: () => ({ ok: true }),
		});

		expect(() => generateOpenApiDocument({ custom: route }, info)).toThrow(
			'/api/custom query parameters'
		);
	});

	it('rejects duplicate operations instead of silently overwriting them', () => {
		expect(() =>
			generateOpenApiDocument([downloadRoute, downloadRoute], info)
		).toThrow('duplicate operation GET /api/download');
	});
});
