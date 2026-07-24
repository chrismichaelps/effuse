import { describe, it, expect } from 'vitest';
import { createResponseCache } from '../../ssr/response-cache.js';

const req = (url: string, init?: RequestInit) => new Request(url, init);
const ok = (body: string, headers?: Record<string, string>) =>
	new Response(body, { status: 200, headers });

describe('createResponseCache', () => {
	it('runs the handler once inside the revalidate window', async () => {
		const cache = createResponseCache();
		let calls = 0;
		const handler = () => {
			calls += 1;
			return ok('payload');
		};

		const first = await cache.handle(req('https://x.test/a'), { revalidate: 60 }, handler);
		const second = await cache.handle(req('https://x.test/a'), { revalidate: 60 }, handler);

		expect(calls).toBe(1);
		expect(await first.text()).toBe('payload');
		expect(await second.text()).toBe('payload');
	});

	it('gives each served response an independently readable body', async () => {
		const cache = createResponseCache();
		const handler = () => ok('stream-safe');

		const first = await cache.handle(req('https://x.test/b'), { revalidate: 60 }, handler);
		const second = await cache.handle(req('https://x.test/b'), { revalidate: 60 }, handler);

		// A Response body is a single-use stream; both must still be readable.
		expect(await first.text()).toBe('stream-safe');
		expect(await second.text()).toBe('stream-safe');
	});

	it('does not cache non-GET requests', async () => {
		const cache = createResponseCache();
		let calls = 0;
		const handler = () => {
			calls += 1;
			return ok('x');
		};

		await cache.handle(req('https://x.test/c', { method: 'POST' }), { revalidate: 60 }, handler);
		await cache.handle(req('https://x.test/c', { method: 'POST' }), { revalidate: 60 }, handler);

		expect(calls).toBe(2);
	});

	it('does not cache unsuccessful responses', async () => {
		const cache = createResponseCache();
		let calls = 0;
		const handler = () => {
			calls += 1;
			return new Response('boom', { status: 500 });
		};

		await cache.handle(req('https://x.test/d'), { revalidate: 60 }, handler);
		await cache.handle(req('https://x.test/d'), { revalidate: 60 }, handler);

		expect(calls).toBe(2);
	});

	it('bypasses the cache when revalidate is false or absent', async () => {
		const cache = createResponseCache();
		let calls = 0;
		const handler = () => {
			calls += 1;
			return ok('x');
		};

		await cache.handle(req('https://x.test/e'), { revalidate: false }, handler);
		await cache.handle(req('https://x.test/e'), { revalidate: false }, handler);
		await cache.handle(req('https://x.test/f'), {}, handler);
		await cache.handle(req('https://x.test/f'), {}, handler);

		expect(calls).toBe(4);
	});

	it('treats an expired entry as a miss', async () => {
		let now = 1_000_000;
		const cache = createResponseCache({ now: () => now });
		let calls = 0;
		const handler = () => {
			calls += 1;
			return ok('x');
		};

		await cache.handle(req('https://x.test/g'), { revalidate: 1 }, handler);
		now += 2_000; // past the 1s window
		await cache.handle(req('https://x.test/g'), { revalidate: 1 }, handler);

		expect(calls).toBe(2);
	});

	it('invalidates exactly the entries carrying a tag', async () => {
		const cache = createResponseCache();
		const counts = { a: 0, b: 0 };
		const handlerA = () => {
			counts.a += 1;
			return ok('a');
		};
		const handlerB = () => {
			counts.b += 1;
			return ok('b');
		};

		await cache.handle(req('https://x.test/a'), { revalidate: 60, tags: ['product'] }, handlerA);
		await cache.handle(req('https://x.test/b'), { revalidate: 60, tags: ['user'] }, handlerB);

		cache.invalidateTags(['product']);

		await cache.handle(req('https://x.test/a'), { revalidate: 60, tags: ['product'] }, handlerA);
		await cache.handle(req('https://x.test/b'), { revalidate: 60, tags: ['user'] }, handlerB);

		expect(counts.a).toBe(2); // invalidated, re-ran
		expect(counts.b).toBe(1); // untouched, still cached
	});

	it('bounds memory by evicting the least recently used entry', async () => {
		const cache = createResponseCache({ maxEntries: 2 });
		const calls: Record<string, number> = { a: 0, b: 0, c: 0 };
		const handlerFor = (key: string) => () => {
			calls[key] = (calls[key] ?? 0) + 1;
			return ok(key);
		};

		await cache.handle(req('https://x.test/a'), { revalidate: 60 }, handlerFor('a'));
		await cache.handle(req('https://x.test/b'), { revalidate: 60 }, handlerFor('b'));
		// Touch 'a' so 'b' becomes least-recently-used.
		await cache.handle(req('https://x.test/a'), { revalidate: 60 }, handlerFor('a'));
		// Inserting 'c' must evict 'b', not 'a'.
		await cache.handle(req('https://x.test/c'), { revalidate: 60 }, handlerFor('c'));

		await cache.handle(req('https://x.test/a'), { revalidate: 60 }, handlerFor('a'));
		await cache.handle(req('https://x.test/b'), { revalidate: 60 }, handlerFor('b'));

		expect(calls['a']).toBe(1); // still cached
		expect(calls['b']).toBe(2); // was evicted
		expect(cache.size).toBeLessThanOrEqual(2);
	});

	it('keys entries by the headers named in Vary', async () => {
		const cache = createResponseCache();
		let calls = 0;
		const handler = () => {
			calls += 1;
			return ok('varied', { Vary: 'Accept-Language' });
		};

		await cache.handle(
			req('https://x.test/v', { headers: { 'Accept-Language': 'en' } }),
			{ revalidate: 60 },
			handler
		);
		await cache.handle(
			req('https://x.test/v', { headers: { 'Accept-Language': 'es' } }),
			{ revalidate: 60 },
			handler
		);
		await cache.handle(
			req('https://x.test/v', { headers: { 'Accept-Language': 'en' } }),
			{ revalidate: 60 },
			handler
		);

		// en and es are distinct entries; the repeated en request is a hit.
		expect(calls).toBe(2);
	});

	it('reports hits and misses for observability', async () => {
		const events: string[] = [];
		const cache = createResponseCache({
			onEvent: (event) => events.push(`${event.type}:${event.key}`),
		});
		const handler = () => ok('x');

		await cache.handle(req('https://x.test/o'), { revalidate: 60 }, handler);
		await cache.handle(req('https://x.test/o'), { revalidate: 60 }, handler);

		expect(events[0]).toMatch(/^miss:/);
		expect(events[1]).toMatch(/^hit:/);
	});

	it('coalesces concurrent misses into a single handler run', async () => {
		const cache = createResponseCache();
		let calls = 0;
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const handler = async () => {
			calls += 1;
			await gate;
			return ok('coalesced');
		};

		// 20 concurrent requests for the same cold key: a cache stampede.
		const inflight = Array.from({ length: 20 }, () =>
			cache.handle(req('https://x.test/hot'), { revalidate: 60 }, handler)
		);
		release();
		const responses = await Promise.all(inflight);

		// Only one execution; every caller still gets a readable body.
		expect(calls).toBe(1);
		const bodies = await Promise.all(responses.map((r) => r.text()));
		expect(bodies.every((b) => b === 'coalesced')).toBe(true);
	});

	it('does not leak an in-flight entry when the handler rejects', async () => {
		const cache = createResponseCache();
		let calls = 0;
		const failing = () => {
			calls += 1;
			return Promise.reject(new Error('upstream down'));
		};

		await expect(
			cache.handle(req('https://x.test/fail'), { revalidate: 60 }, failing)
		).rejects.toThrow('upstream down');
		// A failed run must not poison the key; the next request retries.
		await expect(
			cache.handle(req('https://x.test/fail'), { revalidate: 60 }, failing)
		).rejects.toThrow('upstream down');

		expect(calls).toBe(2);
	});

	it('serves stale content while revalidating in the background', async () => {
		let now = 1_000_000;
		const cache = createResponseCache({ now: () => now });
		let calls = 0;
		const handler = () => {
			calls += 1;
			return ok(`v${String(calls)}`);
		};

		const first = await cache.handle(
			req('https://x.test/swr'),
			{ revalidate: 1, staleWhileRevalidate: 60 },
			handler
		);
		expect(await first.text()).toBe('v1');

		now += 2_000; // fresh window passed, still inside the stale window
		const stale = await cache.handle(
			req('https://x.test/swr'),
			{ revalidate: 1, staleWhileRevalidate: 60 },
			handler
		);

		// Served immediately from stale cache...
		expect(await stale.text()).toBe('v1');
		// ...and a refresh was triggered behind it.
		await cache.idle();
		expect(calls).toBe(2);

		const fresh = await cache.handle(
			req('https://x.test/swr'),
			{ revalidate: 1, staleWhileRevalidate: 60 },
			handler
		);
		expect(await fresh.text()).toBe('v2');
	});

	it('clears every entry and its tag index', async () => {
		const cache = createResponseCache();
		let calls = 0;
		const handler = () => {
			calls += 1;
			return ok('x');
		};

		await cache.handle(req('https://x.test/z'), { revalidate: 60, tags: ['t'] }, handler);
		cache.clear();
		await cache.handle(req('https://x.test/z'), { revalidate: 60, tags: ['t'] }, handler);

		expect(calls).toBe(2);
		expect(cache.size).toBe(1);
	});
});
