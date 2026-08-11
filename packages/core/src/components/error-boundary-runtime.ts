import type { ListNode } from '../render/node.js';

const ERROR_BOUNDARY_CONTROLLER = Symbol.for('effuse.error-boundary');

export interface ErrorBoundaryController {
	readonly capture: (error: Error, notify: boolean) => void;
	readonly hasError: () => boolean;
}

type ErrorBoundaryNode = ListNode & {
	readonly [ERROR_BOUNDARY_CONTROLLER]?: ErrorBoundaryController;
};

export const attachErrorBoundaryController = (
	node: ListNode,
	controller: ErrorBoundaryController
): void => {
	Object.defineProperty(node, ERROR_BOUNDARY_CONTROLLER, {
		value: controller,
	});
};

export const getErrorBoundaryController = (
	node: ListNode
): ErrorBoundaryController | undefined =>
	(node as ErrorBoundaryNode)[ERROR_BOUNDARY_CONTROLLER];

export const normalizeBoundaryError = (error: unknown): Error =>
	error instanceof Error ? error : new Error(String(error));
