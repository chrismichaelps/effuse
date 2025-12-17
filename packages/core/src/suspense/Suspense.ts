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

import { define } from '../blueprint/index.js';
import { computed } from '../reactivity/index.js'; // Keep isTracking for verification
import { effect } from '../effects/index.js'; // Import Effect stack
import type { EffuseChild, EffuseNode } from '../render/node.js';
import { EFFUSE_NODE, NodeType } from '../constants.js';
import { isSuspendToken, type SuspendToken } from './token.js';
import { suspenseApi, type SuspenseContext } from './service.js';
import type { Signal, ReadonlySignal } from '../types/index.js';

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
	script: ({ props, signal: createSignal }) => {
		const boundary = suspenseApi.createBoundary();
		const isPending = createSignal(true);
		const shouldShowFallback = createSignal(true);
		const resolvedChildren = createSignal<EffuseChild>(null);
		const pendingTokens = new Map<string, SuspendToken>();

		const currentContent = computed(() => {
			if (shouldShowFallback.value) {
				return props.fallback;
			}
			return resolvedChildren.value;
		});

		const handleSuspendToken = (token: SuspendToken) => {
			if (pendingTokens.has(token.resourceId)) {
				return;
			}
			pendingTokens.set(token.resourceId, token);
			boundary.registerPending(token.resourceId, token.promise);
			shouldShowFallback.value = true;

			token.promise
				.then(() => {
					pendingTokens.delete(token.resourceId);
					boundary.unregisterPending(token.resourceId);
					if (pendingTokens.size === 0) {
						isPending.value = false;
						tryRenderChildren(props.children, props.fallback);
					}
				})
				.catch(() => {
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
			suspenseApi.pushBoundary(boundary);
			try {
				let childToRender = children;
				if (Array.isArray(children) && children.length === 1) {
					childToRender = children[0];
				}
				const rendered =
					typeof childToRender === 'function' ? childToRender() : childToRender;
				resolvedChildren.value = rendered;
				shouldShowFallback.value = false;
			} catch (error: unknown) {
				if (isSuspendToken(error)) {
					handleSuspendToken(error);
				} else {
					throw error;
				}
			} finally {
				suspenseApi.popBoundary();
			}
		};

		effect(() => {
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
		return {
			[EFFUSE_NODE]: true,
			type: NodeType.FRAGMENT,
			children: [exposed.currentContent],
		} as EffuseNode;
	},
});
