import { createAsyncContextStorage } from '../utils/async-context.js';

export interface RuntimeContext<T> {
	/** Returns the value owned by the current async execution, if any. */
	readonly current: () => T | undefined;
	/** Runs a callback with `value` isolated from concurrent executions. */
	readonly run: <R>(value: T, callback: () => R) => R;
}

/**
 * Creates a portable execution context for request-owned framework state.
 * Node and Bun use native async context; browsers use a synchronous stack.
 */
export const createRuntimeContext = <T>(): RuntimeContext<T> => {
	const storage = createAsyncContextStorage<T>();
	return {
		current: () => storage.getStore(),
		run: (value, callback) => storage.run(value, callback),
	};
};
