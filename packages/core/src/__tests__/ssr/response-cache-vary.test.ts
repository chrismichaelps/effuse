/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	createResponseCache,
	type ResponseCacheEvent,
} from '../../ssr/response-cache.js';

const POLICY = { revalidate: 60 } as const;

const request = (headers: Record<string, string> = {}): Request =>
	new Request('https://example.com/page', { headers });

/** A handler whose `Vary` header can be changed between calls. */
const varyingHandler = (): {
	handler: () => Response;
	setVary: (vary: string | undefined) => void;
	runs: () => number;
} => {
	let vary: string | undefined = 'X-Test';
	let runs = 0;
	return {
		handler: () => {
			runs += 1;
			return new Response('body', {
				status: 200,
				headers: vary === undefined ? {} : { Vary: vary },
			});
		},
		setVary: (next) => {
			vary = next;
		},
		runs: () => runs,
	};
};

describe('response cache Vary learning', () => {
	it('caches a route that never varies', async () => {
		const cache = createResponseCache();
		let runs = 0;
		const handler = (): Response => {
			runs += 1;
			return new Response('body', { status: 200 });
		};

		for (let attempt = 0; attempt < 4; attempt += 1) {
			await cache.handle(request(), POLICY, handler);
		}

		expect(runs).toBe(1);
	});

	it('varies while the route sends Vary', async () => {
		const cache = createResponseCache();
		const source = varyingHandler();

		await cache.handle(request({ 'X-Test': 'a' }), POLICY, source.handler);
		await cache.handle(request({ 'X-Test': 'a' }), POLICY, source.handler);
		await cache.handle(request({ 'X-Test': 'b' }), POLICY, source.handler);

		// One run per distinct header value, and the repeat of 'a' hits.
		expect(source.runs()).toBe(2);
	});

	it('caches again after the route stops sending Vary', async () => {
		const cache = createResponseCache();
		const source = varyingHandler();

		await cache.handle(request({ 'X-Test': 'a' }), POLICY, source.handler);
		source.setVary(undefined);

		// First call relearns; the rest must hit.
		await cache.handle(request({ 'X-Test': 'x' }), POLICY, source.handler);
		const before = source.runs();
		for (let attempt = 0; attempt < 4; attempt += 1) {
			await cache.handle(request({ 'X-Test': 'x' }), POLICY, source.handler);
		}

		expect(source.runs()).toBe(before);
	});

	it('serves one entry to differing headers once Vary is gone', async () => {
		const cache = createResponseCache();
		const source = varyingHandler();

		await cache.handle(request({ 'X-Test': 'a' }), POLICY, source.handler);
		source.setVary(undefined);
		await cache.handle(request({ 'X-Test': 'first' }), POLICY, source.handler);

		const events: ResponseCacheEvent[] = [];
		const observed = createResponseCache({
			onEvent: (event) => events.push(event),
		});
		const plain = (): Response => new Response('body', { status: 200 });
		await observed.handle(request({ 'X-Test': 'p' }), POLICY, plain);
		await observed.handle(request({ 'X-Test': 'q' }), POLICY, plain);

		// A route with no Vary must ignore the header entirely.
		expect(events.map((event) => event.type)).toEqual(['miss', 'hit']);
	});

	it('adopts a new set of Vary headers when the route changes them', async () => {
		const cache = createResponseCache();
		const source = varyingHandler();

		await cache.handle(request({ 'X-Test': 'a' }), POLICY, source.handler);
		source.setVary('X-Other');
		await cache.handle(request({ 'X-Other': 'b' }), POLICY, source.handler);
		const before = source.runs();

		// Keyed by X-Other now, so X-Test may differ freely.
		await cache.handle(
			request({ 'X-Other': 'b', 'X-Test': 'anything' }),
			POLICY,
			source.handler
		);

		expect(source.runs()).toBe(before);
	});

	it('does not retain Vary rules for entries it has evicted', async () => {
		const cache = createResponseCache({ maxEntries: 2 });
		let runs = 0;
		const handler = (): Response => {
			runs += 1;
			return new Response('body', { status: 200, headers: { Vary: 'X-Test' } });
		};

		// Far more distinct paths than the cache can hold.
		for (let index = 0; index < 50; index += 1) {
			await cache.handle(
				new Request(`https://example.com/p/${String(index)}`, {
					headers: { 'X-Test': 'v' },
				}),
				POLICY,
				handler
			);
		}

		expect(cache.size).toBeLessThanOrEqual(2);
		expect(runs).toBe(50);

		// The evicted paths must not still be described by a retained rule.
		const revisit = await cache.handle(
			new Request('https://example.com/p/0', { headers: { 'X-Test': 'v' } }),
			POLICY,
			handler
		);
		expect(revisit.status).toBe(200);
		expect(cache.size).toBeLessThanOrEqual(2);
	});
	it('keeps the rule when a stale entry is refreshed in the background', async () => {
		// The refresh re-stores the same key while the entry is still present, so
		// the replacement releases the rule's last reference. Recording the rule
		// before that store silently dropped it, and the route stopped varying.
		let clock = 1_000_000;
		const cache = createResponseCache({ now: () => clock });
		const policy = { revalidate: 10, staleWhileRevalidate: 600 } as const;
		const source = varyingHandler();

		await cache.handle(request({ 'X-Test': 'a' }), policy, source.handler);
		clock += 20_000;
		await cache.handle(request({ 'X-Test': 'a' }), policy, source.handler);
		await cache.idle();

		const before = source.runs();
		await cache.handle(request({ 'X-Test': 'a' }), policy, source.handler);
		expect(source.runs()).toBe(before);

		// Still keyed by the header, so a new value is still a miss.
		await cache.handle(request({ 'X-Test': 'b' }), policy, source.handler);
		await cache.handle(request({ 'X-Test': 'b' }), policy, source.handler);
		expect(source.runs()).toBe(before + 1);
	});

	it('keeps the rule when an expired entry is replaced', async () => {
		let clock = 1_000_000;
		const cache = createResponseCache({ now: () => clock });
		const source = varyingHandler();

		await cache.handle(request({ 'X-Test': 'a' }), POLICY, source.handler);
		clock += 120_000;
		await cache.handle(request({ 'X-Test': 'a' }), POLICY, source.handler);

		const before = source.runs();
		await cache.handle(request({ 'X-Test': 'a' }), POLICY, source.handler);
		expect(source.runs()).toBe(before);
	});
});
