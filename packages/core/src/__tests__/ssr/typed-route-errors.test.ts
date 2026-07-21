import { describe, it, expect, afterEach } from 'vitest';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { defineServerRequest } from '../../ssr/request-contract.js';
import { defineServerRoute } from '../../ssr/route-contract.js';
import { serverSchema } from '../../ssr/server-schema.js';
import { createTypedRouteClient } from '../../ssr/typed-route-client.js';
import { isRouteError } from '../../ssr/typed-route-client.js';
import { createInProcessRouteFetch } from '../../ssr/in-process-route-client.js';
import { LayerServerClientError } from '../../ssr/client.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

const payRoute = defineServerRoute({
	path: '/api/pay',
	request: defineServerRequest({
		json: serverSchema.object({ amount: serverSchema.number }),
	}),
	response: serverSchema.object({ ok: serverSchema.boolean }),
	errors: serverSchema.object({
		code: serverSchema.string,
		balance: serverSchema.number,
	}),
	POST: (ctx) => {
		if (ctx.input.json.amount > 100) {
			return ctx.response.json(
				{ code: 'insufficient_funds', balance: 50 },
				{ status: 402 }
			);
		}
		return { ok: true };
	},
});

const clientFor = () =>
	createTypedRouteClient(
		{ pay: payRoute },
		{
			baseUrl: 'http://ssr.local',
			fetch: createInProcessRouteFetch([
				defineLayer({ name: 'pay', server: { routes: [payRoute] } }),
			]),
		}
	);

describe('typed route error contracts', () => {
	it('carries the parsed error body, typed by the route error contract', async () => {
		const client = clientFor();

		try {
			await client.pay({ body: { amount: 500 } });
			expect.unreachable('expected the call to throw');
		} catch (error) {
			expect(isRouteError(payRoute, error)).toBe(true);
			if (isRouteError(payRoute, error)) {
				// `data` is typed as the error contract output: { code: string; balance: number }.
				const code: string = error.data.code;
				const balance: number = error.data.balance;
				expect(code).toBe('insufficient_funds');
				expect(balance).toBe(50);
				// The raw string body is preserved unchanged for backward compatibility.
				expect(error.status).toBe(402);
				expect(typeof error.body).toBe('string');
			}
		}
	});

	it('still resolves the response contract on the happy path', async () => {
		const client = clientFor();

		const result = await client.pay({ body: { amount: 10 } });

		const ok: boolean = result.ok;
		expect(ok).toBe(true);
	});

	it('narrows only genuine client errors', () => {
		expect(isRouteError(payRoute, new Error('nope'))).toBe(false);
		expect(isRouteError(payRoute, undefined)).toBe(false);
	});
});
