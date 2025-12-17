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

import { Effect, pipe } from 'effect';
import type { EffuseChild } from './node.js';
import {
	DOMRendererLive,
	MountService,
	PropService,
	EventService,
	type MountedNode,
} from '../services/dom-renderer/index.js';

export {
	type EffuseChild,
	type EffuseNode,
	type ElementNode,
	type TextNode,
	type FragmentNode,
	type ListNode,
	type Portals,
	type PortalFn,
	type BlueprintDef,
	type BlueprintContext,
	type BlueprintNode,
	type Component,
	isEffuseNode,
} from './node.js';

export { el, fragment, toNode } from './element.js';

export type CleanupFn = () => void;

export const render = (child: EffuseChild, container: Element): CleanupFn => {
	let mountedResult: MountedNode | null = null;

	const program = pipe(
		MountService,
		Effect.flatMap((service) => service.mount(child, container)),
		Effect.tap((result) =>
			Effect.sync(() => {
				mountedResult = result;
			})
		),
		Effect.provide(DOMRendererLive)
	);

	Effect.runSync(program);

	return () => {
		if (mountedResult) {
			mountedResult.cleanup();
		}
	};
};

export const unmount = (container: Element): void => {
	container.innerHTML = '';
};

export { MountService, PropService, EventService };
export { DOMRendererLive } from '../services/dom-renderer/index.js';
