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

/** Two requests to one path, each carrying its own header values. */
const twoCallers = async (
	varyHeader: string | null
): Promise<{
	runs: number;
	first: string;
	second: string;
	events: string[];
}> => {
	const events: ResponseCacheEvent[] = [];
	const cache = createResponseCache({
		maxEntries: 10,
		onEvent: (event: ResponseCacheEvent) => events.push(event),
	} as never);

	let runs = 0;
	const handler = (who: string) => () => {
		runs += 1;
		return new Response(`body-for-${who}`, {
			status: 200,
			headers: varyHeader === null ? {} : { Vary: varyHeader },
		});
	};
	const request = (who: string) =>
		new Request('http://x/page', {
			headers: { 'x-user': who, 'accept-language': who },
		});

	const first = await cache.handle(request('alice'), POLICY, handler('alice'));
	const second = await cache.handle(request('bob'), POLICY, handler('bob'));

	return {
		runs,
		first: await first.text(),
		second: await second.text(),
		events: events.map((event) => event.type),
	};
};

describe('Vary: * is never reused', () => {
	it.each(['*', '*, Accept-Encoding', 'Accept, *', 'accept-encoding , *'])(
		'runs the handler again for %s',
		async (varyHeader) => {
			// RFC 7234 4.1: a stored response whose Vary is `*` always fails to
			// match. Collapsing it to "no variance" served the first caller's
			// body to everyone.
			const outcome = await twoCallers(varyHeader);

			expect(outcome.runs).toBe(2);
			expect(outcome.first).toBe('body-for-alice');
			expect(outcome.second).toBe('body-for-bob');
		}
	);

	it('reports the decision as a bypass', async () => {
		const outcome = await twoCallers('*');

		expect(outcome.events).toContain('bypass');
	});

	it('never serves a stored entry for it, however many callers arrive', async () => {
		const cache = createResponseCache({ maxEntries: 10 });
		let runs = 0;
		const handler = () => {
			runs += 1;
			return new Response(`run-${runs}`, {
				status: 200,
				headers: { Vary: '*' },
			});
		};

		const bodies: string[] = [];
		for (let index = 0; index < 4; index++) {
			bodies.push(
				await (
					await cache.handle(new Request('http://x/p'), POLICY, handler)
				).text()
			);
		}

		expect(runs).toBe(4);
		expect(bodies).toEqual(['run-1', 'run-2', 'run-3', 'run-4']);
	});
});

describe('ordinary Vary handling is unchanged', () => {
	it('separates callers by a named header', async () => {
		const outcome = await twoCallers('x-user');

		expect(outcome.runs).toBe(2);
		expect(outcome.second).toBe('body-for-bob');
	});

	it('serves a second caller from cache when the named header matches', async () => {
		const cache = createResponseCache({ maxEntries: 10 });
		let runs = 0;
		const handler = () => {
			runs += 1;
			return new Response(`run-${runs}`, {
				status: 200,
				headers: { Vary: 'x-user' },
			});
		};
		const request = () =>
			new Request('http://x/p', { headers: { 'x-user': 'same' } });

		const first = await (await cache.handle(request(), POLICY, handler)).text();
		const second = await (
			await cache.handle(request(), POLICY, handler)
		).text();

		expect(runs).toBe(1);
		expect(second).toBe(first);
	});

	it('caches under the base key when there is no Vary at all', async () => {
		const outcome = await twoCallers(null);

		expect(outcome.runs).toBe(1);
		expect(outcome.second).toBe('body-for-alice');
	});
});
