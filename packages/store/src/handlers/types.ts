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

import type { Signal } from '@effuse/core';
import type { AtomicState } from '../core/state.js';
import type { MiddlewareManager } from '../middleware/index.js';
import type { StorageAdapter } from '../persistence/index.js';
import type {
	CancellationScope,
	CancellationToken,
} from '../actions/cancellation.js';

export interface StoreInternals {
	signalMap: Map<string, Signal<unknown>>;
	initialState: Record<string, unknown>;
	actions: Record<string, (...args: unknown[]) => unknown>;
	subscribers: Set<() => void>;
	keySubscribers: Map<string, Set<(value: unknown) => void>>;
	computedSelectors: Map<
		(s: Record<string, unknown>) => unknown,
		Signal<unknown>
	>;
	isBatching: boolean;
	cancellationScope: CancellationScope;
	pendingActions: Map<string, CancellationToken>;
}

export interface StoreConfig {
	name: string;
	shouldPersist: boolean;
	storageKey: string;
	enableDevtools: boolean;
	adapter: StorageAdapter;
}

export interface StoreHandlerDeps {
	internals: StoreInternals;
	atomicState: AtomicState<Record<string, unknown>>;
	middlewareManager: MiddlewareManager<Record<string, unknown>>;
	config: StoreConfig;
}

export interface SetValueInput {
	prop: string;
	value: unknown;
}

export interface UpdateStateInput {
	updater: (draft: Record<string, unknown>) => void;
}

export interface SubscribeInput {
	callback: () => void;
}

export interface SubscribeKeyInput {
	key: string;
	callback: (value: unknown) => void;
}
