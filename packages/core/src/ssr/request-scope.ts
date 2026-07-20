/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import type { RequestDisposer, RequestLocals } from '../layers/types.js';

/**
 * The per-request scope backing `ServerLayerContext.locals` and
 * `ServerLayerContext.defer`. One scope is created per request and disposed when
 * the request settles, so scoped state and cleanups never bleed across
 * concurrent requests.
 */
export interface RequestScope {
	/** Request-scoped mutable state, unique to this request. */
	readonly locals: RequestLocals;
	/** Registers a cleanup callback to run when the request settles. */
	readonly defer: (disposer: RequestDisposer) => void;
	/**
	 * Runs registered disposers in reverse registration order, isolating each
	 * error so one failure never stops the others or rejects. Idempotent: only
	 * the first call runs the disposers.
	 */
	readonly runDisposers: () => Promise<void>;
}

/** Creates a fresh, isolated request scope. */
export const createRequestScope = (): RequestScope => {
	const locals: RequestLocals = {};
	const disposers: RequestDisposer[] = [];
	let disposed = false;

	const defer = (disposer: RequestDisposer): void => {
		if (disposed) {
			// The request already settled; run the late disposer immediately so it
			// is never silently dropped, still isolating its errors.
			void runDisposer(disposer);
			return;
		}
		disposers.push(disposer);
	};

	const runDisposer = async (disposer: RequestDisposer): Promise<void> => {
		try {
			await disposer();
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('[effuse] Request disposer failed:', error);
		}
	};

	const runDisposers = async (): Promise<void> => {
		if (disposed) return;
		disposed = true;
		// Reverse order mirrors resource nesting: the last acquired is released
		// first, like stacked try/finally blocks.
		for (let index = disposers.length - 1; index >= 0; index -= 1) {
			await runDisposer(disposers[index]);
		}
		disposers.length = 0;
	};

	return { locals, defer, runDisposers };
};
