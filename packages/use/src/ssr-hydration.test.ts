import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	define,
	type ComponentLifecycle,
} from '@effuse/core';
import { useEventListener } from './hooks/useEventListener/index.js';
import { useInterval } from './hooks/useInterval/index.js';
import { useLocalStorage } from './hooks/useLocalStorage/index.js';
import { useMediaQuery } from './hooks/useMediaQuery/index.js';
import { useOnline } from './hooks/useOnline/index.js';
import { useWindowSize } from './hooks/useWindowSize/index.js';

const setupComponentHook = <T>(setup: () => T) => {
	let hook: T | undefined;
	const Owner = define({
		script: () => {
			hook = setup();
			return {};
		},
		template: () => null,
	});
	const state = Owner.state?.({}) as
		| { readonly lifecycle: ComponentLifecycle }
		| undefined;
	if (!hook || !state) throw new Error('Hook owner setup failed');
	return { hook, lifecycle: state.lifecycle };
};

describe('@effuse/use SSR hydration lifecycle', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('defers viewport reads and listeners until mount', () => {
		const addEventListener = vi.fn();
		const removeEventListener = vi.fn();
		vi.stubGlobal('window', {
			innerWidth: 1440,
			innerHeight: 900,
			addEventListener,
			removeEventListener,
		});
		vi.stubGlobal('document', {
			documentElement: { clientWidth: 1400, clientHeight: 860 },
		});

		const { hook, lifecycle } = setupComponentHook(() =>
			useWindowSize({ initialWidth: 320, initialHeight: 640 })
		);

		expect([hook.width.value, hook.height.value, hook.isAvailable.value]).toEqual([
			320,
			640,
			false,
		]);
		expect(addEventListener).not.toHaveBeenCalled();

		lifecycle.runMount();
		expect([hook.width.value, hook.height.value, hook.isAvailable.value]).toEqual([
			1440,
			900,
			true,
		]);
		expect(addEventListener).toHaveBeenCalledWith(
			'resize',
			expect.any(Function),
			expect.any(Object)
		);

		lifecycle.runCleanup();
		expect(removeEventListener).toHaveBeenCalled();
	});

	it('defers media-query evaluation and observation until mount', () => {
		const addEventListener = vi.fn();
		const removeEventListener = vi.fn();
		const matchMedia = vi.fn(() => ({
			matches: true,
			addEventListener,
			removeEventListener,
		}));
		vi.stubGlobal('window', { matchMedia });
		vi.stubGlobal('document', {});

		const { hook, lifecycle } = setupComponentHook(() =>
			useMediaQuery({ query: '(min-width: 80rem)', initialValue: false })
		);

		expect(hook.matches.value).toBe(false);
		expect(hook.isSupported).toBe(true);
		expect(matchMedia).not.toHaveBeenCalled();

		lifecycle.runMount();
		expect(hook.matches.value).toBe(true);
		expect(matchMedia).toHaveBeenCalledOnce();

		lifecycle.runCleanup();
		expect(removeEventListener).toHaveBeenCalledOnce();
	});

	it('defers network inspection and listeners until mount', () => {
		const addEventListener = vi.fn();
		const removeEventListener = vi.fn();
		vi.stubGlobal('window', { addEventListener, removeEventListener });
		vi.stubGlobal('document', {});
		vi.stubGlobal('navigator', { onLine: false });

		const { hook, lifecycle } = setupComponentHook(() =>
			useOnline({ initialValue: true })
		);

		expect(hook.isOnline.value).toBe(true);
		expect(addEventListener).not.toHaveBeenCalled();

		lifecycle.runMount();
		expect(hook.isOnline.value).toBe(false);
		expect(addEventListener).toHaveBeenCalledTimes(2);

		lifecycle.runCleanup();
		expect(removeEventListener).toHaveBeenCalledTimes(2);
	});

	it('preserves stored data without reading or writing before mount', () => {
		const getItem = vi.fn(() => JSON.stringify('stored'));
		const setItem = vi.fn();
		const removeItem = vi.fn();
		vi.stubGlobal('window', {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		});
		vi.stubGlobal('document', {});
		vi.stubGlobal('localStorage', { getItem, setItem, removeItem });

		const { hook, lifecycle } = setupComponentHook(() =>
			useLocalStorage({ key: 'theme', defaultValue: 'system' })
		);

		expect(hook.value.value).toBe('system');
		expect(hook.isAvailable).toBe(false);
		expect(getItem).not.toHaveBeenCalled();
		expect(setItem).not.toHaveBeenCalled();

		lifecycle.runMount();
		expect(hook.value.value).toBe('stored');
		expect(hook.isAvailable).toBe(true);
		expect(getItem).toHaveBeenCalledWith('theme');
		expect(setItem).not.toHaveBeenCalled();
		hook.remove();
		expect(removeItem).toHaveBeenCalledWith('theme');
		expect(setItem).not.toHaveBeenCalled();

		lifecycle.runCleanup();
	});

	it('defers generic event listener attachment until mount', () => {
		const addEventListener = vi.fn();
		const removeEventListener = vi.fn();
		vi.stubGlobal('window', { addEventListener, removeEventListener });
		vi.stubGlobal('document', {});

		const { hook, lifecycle } = setupComponentHook(() =>
			useEventListener({ event: 'click', handler: vi.fn() })
		);

		expect(hook.isActive).toBe(false);
		expect(addEventListener).not.toHaveBeenCalled();

		lifecycle.runMount();
		expect(hook.isActive).toBe(true);
		expect(addEventListener).toHaveBeenCalledOnce();

		lifecycle.runCleanup();
		expect(removeEventListener).toHaveBeenCalledOnce();
	});

	it('keeps immediate intervals stopped until mount', () => {
		vi.useFakeTimers();
		vi.stubGlobal('window', {});
		vi.stubGlobal('document', {});

		const { hook, lifecycle } = setupComponentHook(() =>
			useInterval({ callback: vi.fn(), delay: 100 })
		);

		expect(hook.status.value).toBe('stopped');
		expect(vi.getTimerCount()).toBe(0);

		lifecycle.runMount();
		expect(hook.status.value).toBe('running');
		expect(vi.getTimerCount()).toBe(1);

		lifecycle.runCleanup();
		expect(vi.getTimerCount()).toBe(0);
	});
});
