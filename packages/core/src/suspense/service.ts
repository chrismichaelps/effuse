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

import { Context, Effect, Layer } from 'effect';
import type { SuspendToken } from './token.js';
import { BOUNDARY_ID_PREFIX } from './config.js';
import { generateBoundaryId } from './utils.js';

export interface SuspenseContext {
	readonly id: string;
	readonly pendingResources: Map<string, Promise<void>>;
	readonly registerPending: (
		resourceId: string,
		promise: Promise<void>
	) => void;
	readonly unregisterPending: (resourceId: string) => void;
	readonly hasPending: () => boolean;
	readonly waitForAll: () => Promise<void>;
}

export interface SuspenseApi {
	readonly createBoundary: () => SuspenseContext;
	readonly getCurrentBoundary: () => SuspenseContext | null;
	readonly pushBoundary: (boundary: SuspenseContext) => void;
	readonly popBoundary: () => void;
	readonly handleSuspend: (token: SuspendToken) => Effect.Effect<void>;
}

export class SuspenseService extends Context.Tag('effuse/SuspenseService')<
	SuspenseService,
	SuspenseApi
>() {}

const boundaryStack: SuspenseContext[] = [];

const createBoundaryImpl = (): SuspenseContext => {
	const id = generateBoundaryId(BOUNDARY_ID_PREFIX);
	const pendingResources = new Map<string, Promise<void>>();

	return {
		id,
		pendingResources,
		registerPending: (resourceId: string, promise: Promise<void>) => {
			pendingResources.set(resourceId, promise);
		},
		unregisterPending: (resourceId: string) => {
			pendingResources.delete(resourceId);
		},
		hasPending: () => pendingResources.size > 0,
		waitForAll: async () => {
			const promises = Array.from(pendingResources.values());
			await Promise.all(promises);
		},
	};
};

export const suspenseApi: SuspenseApi = {
	createBoundary: createBoundaryImpl,

	getCurrentBoundary: () =>
		boundaryStack.length > 0
			? (boundaryStack[boundaryStack.length - 1] ?? null)
			: null,

	pushBoundary: (boundary: SuspenseContext) => {
		boundaryStack.push(boundary);
	},

	popBoundary: () => {
		boundaryStack.pop();
	},

	handleSuspend: (token: SuspendToken) => Effect.promise(() => token.promise),
};

export const SuspenseLive = Layer.succeed(SuspenseService, suspenseApi);

export const makeSuspenseLayer = (
	customApi?: Partial<SuspenseApi>
): Layer.Layer<SuspenseService> =>
	Layer.succeed(SuspenseService, {
		...suspenseApi,
		...customApi,
	});
