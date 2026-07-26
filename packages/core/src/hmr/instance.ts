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

import type { BlueprintDef } from '../render/node.js';

export interface HMRInstance {
	/** Mutable ref to the current blueprint (swapped on HMR update). */
	blueprint: BlueprintDef;
	/** Props passed to the component. */
	props: Record<string, unknown>;
	/** The DOM nodes currently rendered for this instance. */
	nodes: Node[];
	/** Cleanup function from the original mount. */
	cleanup: () => void;
	/** Parent DOM element where this instance lives. */
	parent: Element;
	/** Anchor comment node inserted before the instance's DOM nodes. */
	anchor: Comment;
}

const registry = new Map<string, Set<HMRInstance>>();

export const registerHMRInstance = (
	hmrId: string,
	instance: HMRInstance
): (() => void) => {
	let set = registry.get(hmrId);
	if (!set) {
		set = new Set();
		registry.set(hmrId, set);
	}
	set.add(instance);
	return () => {
		set?.delete(instance);
		if (set?.size === 0) {
			registry.delete(hmrId);
		}
	};
};

export const getHMRInstances = (hmrId: string): Set<HMRInstance> | undefined => {
	return registry.get(hmrId);
};

export const hasHMRInstances = (hmrId: string): boolean => {
	return registry.has(hmrId);
};
