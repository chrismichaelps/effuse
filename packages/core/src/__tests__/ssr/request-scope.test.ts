/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequestScope } from '../../ssr/request-scope.js';
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
	CreateTextNode({ [EFFUSE_NODE]: true, text: 'scope root' });

describe('createRequestScope', () => {
	it('gives each scope its own isolated locals bag', () => {
		const a = createRequestScope();
		const b = createRequestScope();

		a.locals.value = 'a';
		b.locals.value = 'b';

		expect(a.locals.value).toBe('a');
		expect(b.locals.value).toBe('b');
		expect(a.locals).not.toBe(b.locals);
	});

	it('runs disposers in reverse registration order', async () => {
		const scope = createRequestScope();
		const order: number[] = [];

		scope.defer(() => {
			order.push(1);
		});
		scope.defer(() => {
			order.push(2);
		});
		scope.defer(async () => {
			order.push(3);
		});

		await scope.runDisposers();

		expect(order).toEqual([3, 2, 1]);
	});

	it('isolates disposer errors so every disposer still runs', async () => {
		const consoleError = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {});
		const scope = createRequestScope();
		const ran: string[] = [];

		scope.defer(() => {
			ran.push('first');
		});
		scope.defer(() => {
			throw new Error('boom');
		});
		scope.defer(() => {
			ran.push('third');
		});

		await expect(scope.runDisposers()).resolves.toBeUndefined();

		expect(ran).toEqual(['third', 'first']);
		expect(consoleError).toHaveBeenCalledWith(
			'[effuse] Request disposer failed:',
			expect.any(Error)
		);
		consoleError.mockRestore();
	});

	it('only runs disposers once', async () => {
		const scope = createRequestScope();
		const runs = vi.fn();

		scope.defer(runs);
		await scope.runDisposers();
		await scope.runDisposers();

		expect(runs).toHaveBeenCalledTimes(1);
	});

	it('runs a disposer registered after disposal immediately', async () => {
		const scope = createRequestScope();
		const late = vi.fn();

		await scope.runDisposers();
		scope.defer(late);
		await Promise.resolve();

		expect(late).toHaveBeenCalledTimes(1);
	});
});

describe('request scope through a single handler', () => {
	it('never bleeds locals across concurrent requests and disposes each once', async () => {
		const disposed: string[] = [];

		const ScopeLayer = defineLayer({
			name: 'scope-probe',
			server: {
				api: {
					'/api/echo/[id]': async (ctx) => {
						const id = ctx.params.id;
						ctx.locals.id = id;
						ctx.defer(() => {
							disposed.push(id);
						});
						// Yield so requests overlap in flight, stressing isolation.
						await new Promise((resolve) => setTimeout(resolve, 5));
						// Read back after the await — must still be this request's id.
						return { seen: ctx.locals.id };
					},
				},
			},
		});

		const handler = createHandler({
			root: createRoot() as never,
			layers: [ScopeLayer],
		});

		const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
		const responses = await Promise.all(
			ids.map((id) =>
				handler(new Request(`http://localhost:3000/api/echo/${id}`))
			)
		);
		const bodies = (await Promise.all(
			responses.map((response) => response.json())
		)) as Array<{ seen: string }>;

		// Each request observed only its own local — no cross-request bleed.
		expect(bodies.map((body) => body.seen)).toEqual(ids);
		// Every request's disposer ran exactly once by the time it settled.
		expect([...disposed].sort()).toEqual([...ids].sort());
	});
});
