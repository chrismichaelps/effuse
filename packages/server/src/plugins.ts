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

/**
 * Plugin host: ordered composition of server-side resources.
 *
 * Cache, tasks, and storage are each independently useful, but something has to
 * own the order in which they start and stop. Hand-rolled bootstraps get the
 * same four things wrong, so the host guarantees them:
 *
 * - **Setup in registration order, teardown in strict reverse.** A storage
 *   backend closed before the task still using it produces errors during
 *   shutdown, which is exactly when they are hardest to read.
 * - **Rollback on failed setup.** If a plugin's setup throws, every
 *   already-started plugin is torn down in reverse before the error
 *   propagates, so a failed boot leaves no connections or timers running.
 * - **Isolated, aggregated teardown failures.** One failure must not prevent
 *   the remaining resources from releasing; every failure is still reported.
 * - **Bounded shutdown.** A plugin that hangs cannot block the process
 *   indefinitely.
 */

export interface PluginContext {
	readonly name: string;
	/** Registers cleanup for this plugin, run during teardown. */
	onTeardown(fn: () => void | Promise<void>): void;
}

export interface Plugin<Value = unknown> {
	readonly name: string;
	readonly setup: (context: PluginContext) => Value | Promise<Value>;
}

export type PluginEventType = 'setup' | 'teardown' | 'teardown-error';

export interface PluginEvent {
	readonly type: PluginEventType;
	readonly name: string;
	readonly error?: unknown;
}

export interface PluginHostOptions {
	readonly onEvent?: (event: PluginEvent) => void;
}

export interface PluginStopOptions {
	/** Milliseconds to await teardown before returning anyway. */
	readonly timeoutMs?: number;
}

export interface PluginHost {
	/** Registers a plugin. Only valid before `start()`. */
	use(plugin: Plugin): PluginHost;
	start(): Promise<void>;
	stop(options?: PluginStopOptions): Promise<void>;
	/**
	 * The value a plugin's setup returned, once started. The generic is the
	 * caller asserting the stored type, the same contract as `EffuseStorage.get`;
	 * the host itself only ever holds `unknown`.
	 */
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	get<Value = unknown>(name: string): Value | undefined;
	readonly started: boolean;
}

const TIMED_OUT = Symbol('effuse.plugin.stop-timeout');

/** Default budget for awaiting plugin teardown during shutdown. */
export const DEFAULT_PLUGIN_STOP_TIMEOUT_MS = 10_000;

interface StartedPlugin {
	readonly name: string;
	readonly teardowns: readonly (() => void | Promise<void>)[];
}

export const createPluginHost = (
	options: PluginHostOptions = {}
): PluginHost => {
	const plugins: Plugin[] = [];
	const names = new Set<string>();
	const values = new Map<string, unknown>();
	const started: StartedPlugin[] = [];
	const emit = options.onEvent;
	let running = false;

	/**
	 * Tears down the started plugins in reverse. Every teardown is attempted
	 * even when one fails, and the failures are returned rather than thrown so
	 * the caller decides how to surface them.
	 */
	const teardownAll = async (): Promise<unknown[]> => {
		const failures: unknown[] = [];
		for (let index = started.length - 1; index >= 0; index -= 1) {
			const plugin = started[index];
			if (!plugin) continue;
			// A plugin's own finalizers also run in reverse registration order.
			for (let t = plugin.teardowns.length - 1; t >= 0; t -= 1) {
				try {
					await plugin.teardowns[t]?.();
				} catch (error) {
					failures.push(error);
					emit?.({ type: 'teardown-error', name: plugin.name, error });
				}
			}
			emit?.({ type: 'teardown', name: plugin.name });
		}
		started.length = 0;
		values.clear();
		return failures;
	};

	const host: PluginHost = {
		use(plugin) {
			if (running) {
				throw new TypeError(
					`Cannot register plugin "${plugin.name}" after start().`
				);
			}
			if (names.has(plugin.name)) {
				throw new TypeError(`Duplicate plugin name "${plugin.name}".`);
			}
			names.add(plugin.name);
			plugins.push(plugin);
			return host;
		},

		async start() {
			if (running) return;

			for (const plugin of plugins) {
				const teardowns: (() => void | Promise<void>)[] = [];
				const context: PluginContext = {
					name: plugin.name,
					onTeardown(fn) {
						teardowns.push(fn);
					},
				};

				try {
					const value = await plugin.setup(context);
					started.push({ name: plugin.name, teardowns });
					values.set(plugin.name, value);
					emit?.({ type: 'setup', name: plugin.name });
				} catch (error) {
					// This plugin never started, but its setup may have registered
					// teardowns before throwing; include them in the rollback.
					started.push({ name: plugin.name, teardowns });
					await teardownAll();
					running = false;
					throw error;
				}
			}

			running = true;
		},

		async stop(stopOptions = {}) {
			if (!running) return;
			running = false;

			const timeoutMs =
				stopOptions.timeoutMs ?? DEFAULT_PLUGIN_STOP_TIMEOUT_MS;
			let timer: ReturnType<typeof setTimeout> | undefined;
			// A distinct sentinel rather than a flag, so the timeout branch is
			// visible to the type checker instead of inferred from a callback.
			const budget = new Promise<typeof TIMED_OUT>((resolve) => {
				timer = setTimeout(() => {
					resolve(TIMED_OUT);
				}, timeoutMs);
				(timer as { unref?: () => void }).unref?.();
			});

			let outcome: unknown[] | typeof TIMED_OUT;
			try {
				outcome = await Promise.race([teardownAll(), budget]);
			} finally {
				if (timer !== undefined) clearTimeout(timer);
			}

			// A timeout is a bounded shutdown, not a failure to report as one.
			if (outcome === TIMED_OUT || outcome.length === 0) return;
			throw outcome.length === 1
				? outcome[0]
				: new AggregateError(outcome, 'Plugin teardown failed.');
		},

		get(name) {
			return values.get(name) as never;
		},

		get started() {
			return running;
		},
	};

	return host;
};
