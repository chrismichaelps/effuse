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

import { Effect, Predicate, Option, pipe, Array as Arr } from 'effect';
import { suspenseApi } from './service.js';

export interface SSRSuspenseState {
	readonly pendingResources: Set<string>;
	readonly resolvedData: Map<string, unknown>;
	readonly errors: Map<string, Error>;
}

let ssrState: SSRSuspenseState | null = null;

export const initSSRSuspense = (): SSRSuspenseState => {
	ssrState = {
		pendingResources: new Set(),
		resolvedData: new Map(),
		errors: new Map(),
	};
	return ssrState;
};

export const getSSRState = (): SSRSuspenseState | null => ssrState;

export const clearSSRState = (): void => {
	ssrState = null;
};

export const serializeSSRData = (): string => {
	if (!ssrState) return '{}';
	const data: Record<string, unknown> = {};
	ssrState.resolvedData.forEach((value, key) => {
		data[key] = value;
	});
	return JSON.stringify(data);
};

export const hydrateSSRData = (serialized: string): void => {
	const data = JSON.parse(serialized) as Record<string, unknown>;
	if (!ssrState) {
		ssrState = {
			pendingResources: new Set(),
			resolvedData: new Map(Object.entries(data)),
			errors: new Map(),
		};
	} else {
		Arr.forEach(Object.entries(data), ([key, value]) => {
			if (Predicate.isNotNullable(ssrState)) {
				ssrState.resolvedData.set(key, value);
			}
		});
	}
};

export const getHydratedData = (resourceId: string): unknown =>
	pipe(
		Option.fromNullable(ssrState),
		Option.flatMap((state) =>
			Option.fromNullable(state.resolvedData.get(resourceId))
		),
		Option.getOrUndefined
	);

export const waitForAllResources = (): Effect.Effect<void, Error> =>
	Effect.gen(function* () {
		const boundary = suspenseApi.getCurrentBoundary();
		if (boundary && boundary.hasPending()) {
			yield* Effect.promise(() => boundary.waitForAll());
		}
	});

export const waitForAllResourcesAsync = async (): Promise<void> => {
	const boundary = suspenseApi.getCurrentBoundary();
	if (boundary && boundary.hasPending()) {
		await boundary.waitForAll();
	}
};

export const collectSSRData = async (): Promise<string> => {
	const boundary = suspenseApi.getCurrentBoundary();
	if (boundary) {
		await boundary.waitForAll();
	}
	return serializeSSRData();
};

export interface SSRRenderResult {
	readonly html: string;
	readonly data: string;
	readonly hasErrors: boolean;
}

export const renderWithSuspense = async (
	renderFn: () => string
): Promise<SSRRenderResult> => {
	initSSRSuspense();
	const boundary = suspenseApi.createBoundary();
	suspenseApi.pushBoundary(boundary);

	let html = '';
	let hasErrors = false;

	try {
		html = renderFn();
		await boundary.waitForAll();
		html = renderFn();
	} catch (error) {
		hasErrors = true;
		if (ssrState) {
			ssrState.errors.set('render', error as Error);
		}
	} finally {
		suspenseApi.popBoundary();
	}

	const data = serializeSSRData();
	clearSSRState();

	return { html, data, hasErrors };
};
