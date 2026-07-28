import { getActiveLifecycle } from '../blueprint/lifecycle.js';

export interface LifecycleResource {
	readonly active: boolean;
	readonly stopped: boolean;
	readonly stop: () => void;
}

export const ownLifecycleResource = (
	setup: () => void | (() => void)
): LifecycleResource => {
	let cleanup: (() => void) | undefined;
	let active = false;
	let stopped = false;

	const start = (): void => {
		if (active || stopped) return;
		const nextCleanup = setup();
		cleanup = nextCleanup || undefined;
		active = true;
	};

	const stop = (): void => {
		if (stopped) return;
		stopped = true;
		active = false;
		const currentCleanup = cleanup;
		cleanup = undefined;
		currentCleanup?.();
	};

	const lifecycle = getActiveLifecycle();
	if (lifecycle) {
		lifecycle.onMount(() => {
			start();
			return stop;
		});
	} else {
		start();
	}

	return {
		get active() {
			return active;
		},
		get stopped() {
			return stopped;
		},
		stop,
	};
};
