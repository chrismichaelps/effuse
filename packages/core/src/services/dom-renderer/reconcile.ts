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
import { isDebugEnabled } from '../../config/index.js';

export interface ReconcileResult {
	movedCount: number;
	insertedCount: number;
	removedCount: number;
}

export interface KeyedNode {
	key: string | number;
	node: Node;
	index: number;
}

export interface ReconcileServiceInterface {
	readonly reconcileChildren: (
		parent: Element,
		oldNodes: KeyedNode[],
		newNodes: KeyedNode[],
		createNode: (key: string | number, index: number) => Node
	) => Effect.Effect<ReconcileResult>;
}

export class ReconcileService extends Context.Tag('effuse/ReconcileService')<
	ReconcileService,
	ReconcileServiceInterface
>() {}

const detectDuplicateKeys = (nodes: KeyedNode[]): void => {
	if (!isDebugEnabled()) return;
	const seen = new Set<string | number>();
	for (const node of nodes) {
		if (seen.has(node.key)) {
			console.warn(`[Effuse] Duplicate key detected: "${String(node.key)}"`);
		}
		seen.add(node.key);
	}
};

export const ReconcileServiceLive = Layer.succeed(ReconcileService, {
	reconcileChildren: (
		parent: Element,
		oldNodes: KeyedNode[],
		newNodes: KeyedNode[],
		createNode: (key: string | number, index: number) => Node
	) =>
		Effect.sync(() => {
			detectDuplicateKeys(newNodes);

			const oldKeyMap = new Map<string | number, KeyedNode>();
			for (const node of oldNodes) {
				oldKeyMap.set(node.key, node);
			}

			const newKeySet = new Set<string | number>();
			for (const node of newNodes) {
				newKeySet.add(node.key);
			}

			let movedCount = 0;
			let insertedCount = 0;
			let removedCount = 0;

			for (const oldNode of oldNodes) {
				if (!newKeySet.has(oldNode.key)) {
					parent.removeChild(oldNode.node);
					removedCount++;
				}
			}

			let lastInsertedNode: Node | null = null;

			for (let i = 0; i < newNodes.length; i++) {
				const newNode = newNodes[i];
				if (!newNode) continue;

				const existing = oldKeyMap.get(newNode.key);

				if (existing) {
					const referenceNode: Node | null = lastInsertedNode
						? lastInsertedNode.nextSibling
						: parent.firstChild;

					if (existing.node !== referenceNode) {
						parent.insertBefore(existing.node, referenceNode);
						movedCount++;
					}
					lastInsertedNode = existing.node;
					newNode.node = existing.node;
				} else {
					const domNode = createNode(newNode.key, i);
					const referenceNode: Node | null = lastInsertedNode
						? lastInsertedNode.nextSibling
						: parent.firstChild;
					parent.insertBefore(domNode, referenceNode);
					lastInsertedNode = domNode;
					newNode.node = domNode;
					insertedCount++;
				}
			}

			return { movedCount, insertedCount, removedCount };
		}),
});
