import { describe, it, expect } from 'vitest';
import { runServerRequestMiddleware } from '../../ssr/middleware-runtime.js';
import type { ServerRequestMiddleware } from '../../ssr/middleware-definition.js';

const req = (url = 'https://x.test/api/a', init?: RequestInit) =>
	new Request(url, init);

describe('runServerRequestMiddleware', () => {
	it('should run middleware in onion order around the terminal handler', async () => {
		const calls: string[] = [];
		const a: ServerRequestMiddleware = async (_ctx, next) => {
			calls.push('a:before');
			const res = await next();
			calls.push('a:after');
			return res;
		};
		const b: ServerRequestMiddleware = async (_ctx, next) => {
			calls.push('b:before');
			const res = await next();
			calls.push('b:after');
			return res;
		};

		const response = await runServerRequestMiddleware([a, b], req(), () => {
			calls.push('handler');
			return { ok: true };
		});

		expect(calls).toEqual([
			'a:before',
			'b:before',
			'handler',
			'b:after',
			'a:after',
		]);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it('should short-circuit when a middleware returns without calling next', async () => {
		let handlerRan = false;
		const guard: ServerRequestMiddleware = () =>
			new Response('denied', { status: 403 });
		const downstream: ServerRequestMiddleware = async (_ctx, next) => next();

		const response = await runServerRequestMiddleware(
			[guard, downstream],
			req(),
			() => {
				handlerRan = true;
				return { ok: true };
			}
		);

		expect(handlerRan).toBe(false);
		expect(response.status).toBe(403);
		expect(await response.text()).toBe('denied');
	});

	it('should reject a second next() call from the same middleware', async () => {
		const doubleNext: ServerRequestMiddleware = async (_ctx, next) => {
			await next();
			return next();
		};

		await expect(
			runServerRequestMiddleware([doubleNext], req(), () => ({ ok: true }))
		).rejects.toThrow(/next\(\).*(once|already)/i);
	});

	it('should thread a replacement request to downstream middleware', async () => {
		const seen: string[] = [];
		const rewrite: ServerRequestMiddleware = async (ctx, next) => {
			const headers = new Headers(ctx.request.headers);
			headers.set('x-rewritten', 'yes');
			return next(new Request(ctx.request, { headers }));
		};
		const observer: ServerRequestMiddleware = async (ctx, next) => {
			seen.push(ctx.request.headers.get('x-rewritten') ?? 'no');
			return next();
		};

		await runServerRequestMiddleware([rewrite, observer], req(), (request) => {
			seen.push(`handler:${request.headers.get('x-rewritten') ?? 'no'}`);
			return { ok: true };
		});

		expect(seen).toEqual(['yes', 'handler:yes']);
	});

	it('should run the terminal handler directly when the chain is empty', async () => {
		const response = await runServerRequestMiddleware([], req(), () =>
			Response.json({ empty: true }, { status: 201 })
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ empty: true });
	});

	it('should expose request-scoped locals and defer to middleware', async () => {
		const disposed: string[] = [];
		const setLocal: ServerRequestMiddleware = async (ctx, next) => {
			ctx.locals['userId'] = 'u-1';
			ctx.defer(() => {
				disposed.push('cleanup');
			});
			return next();
		};
		const readLocal: ServerRequestMiddleware = async (ctx, next) => {
			ctx.defer(() => {
				disposed.push(`read:${String(ctx.locals['userId'])}`);
			});
			return next();
		};

		const response = await runServerRequestMiddleware(
			[setLocal, readLocal],
			req(),
			(_request, ctx) => ({ userId: ctx.locals['userId'] })
		);

		expect(await response.json()).toEqual({ userId: 'u-1' });
		// Deferred disposers run after the response resolves, in LIFO order.
		expect(disposed).toEqual(['read:u-1', 'cleanup']);
	});

	it('should normalize a thrown response-shaped early return', async () => {
		const response = await runServerRequestMiddleware(
			[async (_ctx, next) => next()],
			req(),
			() => 'plain text body'
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('plain text body');
	});
});
