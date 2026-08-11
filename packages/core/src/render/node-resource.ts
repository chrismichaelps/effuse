import type { EffuseNode } from './node.js';

const NODE_RESOURCE_DISPOSER = Symbol.for('effuse.node-resource-disposer');

type ResourceNode = EffuseNode & {
	readonly [NODE_RESOURCE_DISPOSER]?: () => void;
};

export const attachNodeResourceDisposer = (
	node: EffuseNode,
	disposer: () => void
): (() => void) => {
	let disposed = false;
	const disposeOnce = (): void => {
		if (disposed) return;
		disposed = true;
		disposer();
	};

	Object.defineProperty(node, NODE_RESOURCE_DISPOSER, {
		value: disposeOnce,
	});

	return disposeOnce;
};

export const getNodeResourceDisposer = (
	node: EffuseNode
): (() => void) | undefined =>
	(node as ResourceNode)[NODE_RESOURCE_DISPOSER];
