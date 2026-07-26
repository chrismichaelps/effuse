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

/* eslint-disable no-console -- HMR reports dev-server lifecycle diagnostics in the browser console. */

import type { BlueprintDef } from '../render/node.js';
import { instantiateBlueprint } from '../blueprint/blueprint.js';
import {
	runWithProvideScope,
	type ProvideScope,
} from '../blueprint/provide-inject.js';
import type { BlueprintContext } from '../render/node.js';
import {
	getHMRInstances,
	registerHMRInstance,
	type HMRInstance,
} from './instance.js';

const isViteHMR = (): boolean => {
	return typeof (import.meta as unknown as Record<string, unknown>).hot !== 'undefined';
};

/**
 * Register a newly mounted component instance with the HMR system.
 *
 * Called by the DOM renderer whenever a Blueprint node is mounted.
 * Returns an unregister function that must be called on unmount.
 */
export const registerComponent = (
	hmrId: string | undefined,
	blueprint: BlueprintDef,
	props: Record<string, unknown>,
	nodes: Node[],
	cleanup: () => void,
	parent: Element,
	anchor: Comment
): (() => void) => {
	if (!hmrId || !isViteHMR()) {
		return () => {};
	}
	const instance: HMRInstance = {
		blueprint,
		props,
		nodes,
		cleanup,
		parent,
		anchor,
	};
	return registerHMRInstance(hmrId, instance);
};

/**
 * Re-render a single HMR instance with a new blueprint.
 *
 * 1. Run old cleanup (effects, lifecycles).
 * 2. Remove old DOM nodes.
 * 3. Instantiate new blueprint with same props.
 * 4. Render new view into a temp container via the global render function.
 * 5. Move new nodes into position after the anchor.
 */
const rerenderInstance = (instance: HMRInstance, newBlueprint: BlueprintDef): void => {
	try {
		// 1. Old cleanup
		instance.cleanup();

		// 2. Remove old DOM nodes
		for (const node of instance.nodes) {
			if (node.parentNode) {
				node.parentNode.removeChild(node);
			}
		}

		// 3. Instantiate new blueprint
		const context = instantiateBlueprint(
			newBlueprint,
			instance.props,
			{}
		);

		// 4. Render new view
		const state = context.state as Record<string, unknown>;
		const provideScope = state._provideScope as ProvideScope | undefined;

		const childView = provideScope
			? runWithProvideScope(provideScope, () =>
					newBlueprint.view(context as BlueprintContext)
				)
			: newBlueprint.view(context as BlueprintContext);

		// 5. Mount new DOM nodes via global render helper
		const renderFn = (globalThis as Record<string, unknown>).__effuse_render__ as
			| ((node: unknown, container: Element) => () => void)
			| undefined;

		if (!renderFn) {
			console.warn('[effuse-hmr] Global render helper not found. Skipping HMR update.');
			return;
		}

		const tempContainer = document.createElement('div');
		const newCleanup = renderFn(childView, tempContainer);
		const newNodes = Array.from(tempContainer.childNodes);

		// Insert after anchor
		const insertBefore = instance.anchor.nextSibling;
		for (const node of newNodes) {
			instance.parent.insertBefore(node, insertBefore);
		}

		// Update instance tracking
		instance.blueprint = newBlueprint;
		instance.nodes = newNodes;
		instance.cleanup = newCleanup;
	} catch (err) {
		console.error('[effuse-hmr] Failed to re-render instance:', err);
	}
};

/**
 * Accept a hot update for a component module.
 *
 * Called from `import.meta.hot.accept()` injected by the Vite plugin.
 */
export const acceptComponentUpdate = (
	hmrId: string,
	newModule: Record<string, unknown>
): void => {
	const instances = getHMRInstances(hmrId);
	if (!instances || instances.size === 0) {
		return;
	}

	// Find the new blueprint in the updated module
	let newBlueprint: BlueprintDef | undefined;
	for (const value of Object.values(newModule)) {
		if (
			value &&
			typeof value === 'object' &&
			'_tag' in value &&
			value._tag === 'Blueprint'
		) {
			newBlueprint = value as BlueprintDef;
			break;
		}
	}

	if (!newBlueprint) {
		console.warn(
			`[effuse-hmr] No Blueprint found in updated module ${hmrId}. Falling back to full reload.`
		);
		const hot = (import.meta as unknown as Record<string, unknown>).hot as
			| { invalidate: () => void }
			| undefined;
		if (hot) {
			hot.invalidate();
		}
		return;
	}

	for (const instance of instances) {
		rerenderInstance(instance, newBlueprint);
	}

	console.log(`[effuse-hmr] Hot-swapped ${instances.size} instance(s) for ${hmrId}`);
};

/**
 * Global HMR API exposed for Vite plugin integration.
 */
export const hmr = {
	accept: acceptComponentUpdate,
	register: registerComponent,
	isActive: isViteHMR,
};

export { getHMRInstances, hasHMRInstances } from './instance.js';
