import { describe, expect, expectTypeOf, it } from 'vitest';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { EFFUSE_NODE } from '../../constants.js';
import { CreateTextNode } from '../../render/node.js';
import { createHandler } from '../../ssr/handler.js';
import {
	defineServerRequest,
	type ServerRequestOutput,
} from '../../ssr/request-contract.js';
import { serverSchema } from '../../ssr/server-schema.js';

const createRoot = () =>
	CreateTextNode({ [EFFUSE_NODE]: true, text: 'Request Contract' });

describe('server request contracts', () => {
	it('parses multiple sources with one inferred output', async () => {
		const requestContract = defineServerRequest({
			params: serverSchema.object({ id: serverSchema.string }),
			query: serverSchema.object({
				page: serverSchema.optional(serverSchema.numberFromString, 1),
			}),
			json: serverSchema.object({ active: serverSchema.boolean }),
		});
		type Input = ServerRequestOutput<typeof requestContract.schemas>;
		expectTypeOf({} as Input).toEqualTypeOf<{
			readonly params: { id: string };
			readonly query: { page: number };
			readonly json: { active: boolean };
		}>();

		const ApiLayer = defineLayer({
			name: 'request-contract',
			server: {
				api: {
					'/api/contracts/[id]': {
						POST: async (context) => {
							const input = await requestContract.parse(context);
							expectTypeOf(input).toEqualTypeOf<Input>();
							return input;
						},
					},
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [ApiLayer],
		});

		const response = await handler(
			new Request('http://localhost:3000/api/contracts/u1?page=2', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ active: true }),
			})
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			params: { id: 'u1' },
			query: { page: 2 },
			json: { active: true },
		});
		expect(Object.isFrozen(requestContract.schemas)).toBe(true);
	});

	it('preserves structured validation failures', async () => {
		const requestContract = defineServerRequest({
			query: serverSchema.object({ page: serverSchema.numberFromString }),
		});
		const ApiLayer = defineLayer({
			name: 'request-contract-error',
			server: {
				api: {
					'/api/contracts': (context) => requestContract.parse(context),
				},
			},
		});
		const handler = createHandler({
			root: createRoot() as any,
			layers: [ApiLayer],
		});

		const response = await handler(
			new Request('http://localhost:3000/api/contracts?page=invalid')
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: { code: 'EFFUSE_VALIDATION_FAILED', source: 'query' },
		});
	});

	it('rejects contracts that could consume two bodies', () => {
		const body = serverSchema.object({ value: serverSchema.string });
		if (false) {
			// @ts-expect-error JSON and form data are mutually exclusive body sources.
			defineServerRequest({ json: body, formData: body });
		}
		expect(() =>
			defineServerRequest({ json: body, formData: body } as never)
		).toThrow('cannot declare both json and formData');
	});
});
