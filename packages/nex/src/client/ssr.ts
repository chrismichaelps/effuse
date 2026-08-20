/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { DehydratedNexState, NexClient } from './client.js';

/**
 * Where a render leaves what it fetched, for the browser to find.
 *
 * Both sides have to agree on this, and agreeing by writing the same string
 * twice is how they stop agreeing. It is exported so a server laying out its
 * own state can see what it is called.
 */
export const NEX_STATE_KEY = 'nex';

/** A state bag, however the runtime holding it is shaped. */
export type SSRState = Map<string, unknown> | Record<string, unknown>;

const isDehydrated = (value: unknown): value is DehydratedNexState => {
	if (typeof value !== 'object' || value === null) return false;

	const { results } = value as { results?: unknown };
	if (!Array.isArray(results)) return false;

	return results.every((entry) => {
		if (typeof entry !== 'object' || entry === null) return false;
		const { key, result } = entry as { key?: unknown; result?: unknown };
		return (
			typeof key === 'string' && typeof result === 'object' && result !== null
		);
	});
};

/**
 * Leave what a render fetched where the browser will look for it.
 *
 * The state a render collects travels in the page, so this is the whole
 * handoff on the server's side: fetch what the page needs, then say so.
 *
 * A render that fetched nothing leaves nothing rather than an empty shell, so
 * a page needing no data carries none. Returns whether anything was left.
 */
export const saveNexState = (state: SSRState, client: NexClient): boolean => {
	const dehydrated = client.dehydrate();
	if (dehydrated.results.length === 0) return false;

	if (state instanceof Map) state.set(NEX_STATE_KEY, dehydrated);
	else state[NEX_STATE_KEY] = dehydrated;

	return true;
};

/**
 * Take what the render already fetched, so the browser does not ask again.
 *
 * What arrives has been through JSON and comes from the page rather than from
 * this process, so it is checked before it is trusted: a page carrying
 * nothing, or carrying something that is not this, leaves the client empty
 * rather than holding a shape it will fail on later. Returns whether anything
 * was taken.
 */
export const loadNexState = (
	state: Readonly<Record<string, unknown>>,
	client: NexClient
): boolean => {
	const held = state[NEX_STATE_KEY];
	if (!isDehydrated(held)) return false;

	client.hydrate(held);
	return true;
};
