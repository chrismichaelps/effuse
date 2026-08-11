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

import { Predicate } from 'effect';
import { define } from '../blueprint/index.js';
import { computed } from '../reactivity/index.js';
import { CreateFragmentNode, type EffuseChild } from '../render/node.js';
import {
	EFFUSE_NODE,
	SUSPEND_TOKEN,
	BOUNDARY_ID_PREFIX,
} from '../constants.js';
import type { Signal, ReadonlySignal } from '../types/index.js';

export { SUSPEND_TOKEN };

export const isSuspendToken = (value: unknown): value is SuspendToken =>
	Predicate.isRecord(value) && Predicate.hasProperty(value, SUSPEND_TOKEN);

export interface SuspendToken {
	readonly [SUSPEND_TOKEN]: true;
	readonly promise: Promise<void>;
	readonly resourceId: string;
}

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

let boundaryIdCounter = 0;

const generateBoundaryId = (prefix: string): string =>
	`${prefix}${String(++boundaryIdCounter)}`;

const createBoundary = (): SuspenseContext => {
	const id = generateBoundaryId(BOUNDARY_ID_PREFIX);
	const pendingResources = new Map<string, Promise<void>>();
	const removeSettledResource = (
		resourceId: string,
		promise: Promise<void>
	): void => {
		if (pendingResources.get(resourceId) === promise) {
			pendingResources.delete(resourceId);
		}
	};

	return {
		id,
		pendingResources,
		registerPending: (resourceId: string, promise: Promise<void>) => {
			pendingResources.set(resourceId, promise);
			void promise.then(
				() => removeSettledResource(resourceId, promise),
				() => removeSettledResource(resourceId, promise)
			);
		},
		unregisterPending: (resourceId: string) => {
			pendingResources.delete(resourceId);
		},
		hasPending: () => pendingResources.size > 0,
		waitForAll: async () => {
			while (pendingResources.size > 0) {
				await Promise.all(Array.from(pendingResources.values()));
			}
		},
	};
};

export interface SuspenseProps {
	fallback: EffuseChild;
	children: EffuseChild | (() => EffuseChild);
	[key: string]: unknown;
}

interface SuspenseExposed {
	boundary: SuspenseContext;
	isPending: Signal<boolean>;
	shouldShowFallback: Signal<boolean>;
	resolvedChildren: Signal<EffuseChild>;
	currentContent: ReadonlySignal<EffuseChild>;
	tryRenderChildren: (
		children: EffuseChild | (() => EffuseChild),
		fallback: EffuseChild
	) => void;
}

export const Suspense = define<SuspenseProps, SuspenseExposed>({
	script: ({ props, signal: createSignal, watchEffect, onUnmount }) => {
		const boundary = createBoundary();
		const isPending = createSignal(true);
		const shouldShowFallback = createSignal(true);
		const resolvedChildren = createSignal<EffuseChild>(null);
		const pendingTokens = new Map<string, SuspendToken>();
		let active = true;

		onUnmount(() => {
			active = false;
			pendingTokens.clear();
			boundary.pendingResources.clear();
		});

		const currentContent = computed(() => {
			if (shouldShowFallback.value) {
				return props.fallback;
			}
			return resolvedChildren.value;
		});

		const handleSuspendToken = (token: SuspendToken) => {
			if (!active) return;
			if (pendingTokens.has(token.resourceId)) {
				return;
			}
			pendingTokens.set(token.resourceId, token);
			boundary.registerPending(token.resourceId, token.promise);
			isPending.value = true;
			shouldShowFallback.value = true;

			token.promise
				.then(() => {
					if (!active) return;
					pendingTokens.delete(token.resourceId);
					boundary.unregisterPending(token.resourceId);
					if (pendingTokens.size === 0) {
						isPending.value = false;
						tryRenderChildren(props.children, props.fallback);
					}
				})
				.catch(() => {
					if (!active) return;
					pendingTokens.delete(token.resourceId);
					boundary.unregisterPending(token.resourceId);
					if (pendingTokens.size === 0) {
						isPending.value = false;
						shouldShowFallback.value = false;
					}
				});
		};

		const tryRenderChildren = (
			children: EffuseChild | (() => EffuseChild),
			_fallback: EffuseChild
		): void => {
			if (!active) return;
			try {
				let childToRender = children;
				if (Array.isArray(children) && children.length === 1) {
					childToRender = children[0];
				}
				const rendered = Predicate.isFunction(childToRender)
					? childToRender()
					: childToRender;
				resolvedChildren.value = rendered;
				isPending.value = false;
				shouldShowFallback.value = false;
			} catch (error: unknown) {
				if (isSuspendToken(error)) {
					handleSuspendToken(error);
				} else {
					throw error;
				}
			}
		};

		watchEffect(() => {
			tryRenderChildren(props.children, props.fallback);
		});

		return {
			boundary,
			isPending,
			shouldShowFallback,
			resolvedChildren,
			currentContent,
			tryRenderChildren,
		};
	},

	template: (exposed) => {
		return CreateFragmentNode({
			[EFFUSE_NODE]: true,
			children: [exposed.currentContent],
		});
	},
});
