import { createHookContext } from './context.js';
import { traceHookSetup } from '../layers/tracing/hooks.js';
import type { HookSetupFn } from './types.js';

export function defineHook<C = undefined, R = unknown>(definition: {
	readonly name?: string;
	readonly deps?: readonly string[];
	readonly setup: HookSetupFn<C, R>;
}): C extends undefined ? () => R : (config: C) => R {
	const hookName = definition.name || definition.setup.name || 'anonymous';

	const hookFn = (config?: C): R => {
		const start = performance.now();
		const { ctx } = createHookContext<C>(config as C, hookName);
		const result = definition.setup(ctx);
		const duration = performance.now() - start;

		traceHookSetup(hookName, duration, config as Record<string, unknown>);

		return result;
	};

	return hookFn as C extends undefined ? () => R : (config: C) => R;
}
