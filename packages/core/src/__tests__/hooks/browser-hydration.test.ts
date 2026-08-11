import { afterEach, describe, expect, it, vi } from 'vitest';
import { define } from '../../blueprint/define.js';
import type { ComponentLifecycle } from '../../blueprint/lifecycle.js';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver.js';
import { useLocalStorage } from '../../hooks/useStorage.js';
import { useOnClickOutside } from '../../hooks/useOnClickOutside.js';
import { useResizeObserver } from '../../hooks/useResizeObserver.js';

const setupComponentHook = <T>(setup: () => T) => {
	let hook: T | undefined;
	let didSetup = false;
	const Owner = define({
		script: () => {
			hook = setup();
			didSetup = true;
			return {};
		},
		template: () => null,
	});
	const state = Owner.state?.({}) as
		| { readonly lifecycle: ComponentLifecycle }
		| undefined;
	if (!didSetup || !state) throw new Error('Hook owner setup failed');
	return { hook: hook as T, lifecycle: state.lifecycle };
};

describe('core browser hook hydration lifecycle', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('defers storage reads and synchronization until mount', () => {
		const getItem = vi.fn(() => JSON.stringify('stored'));
		const setItem = vi.fn();
		const addEventListener = vi.fn();
		const removeEventListener = vi.fn();
		const storage = { getItem, setItem } as unknown as Storage;
		vi.stubGlobal('document', {});
		vi.stubGlobal('window', {
			localStorage: storage,
			addEventListener,
			removeEventListener,
		});

		const { hook, lifecycle } = setupComponentHook(() =>
			useLocalStorage('theme', 'system')
		);

		expect(hook.value.value).toBe('system');
		expect(getItem).not.toHaveBeenCalled();
		expect(addEventListener).not.toHaveBeenCalled();

		lifecycle.runMount();
		expect(hook.value.value).toBe('stored');
		expect(getItem).toHaveBeenCalledWith('theme');
		expect(addEventListener).toHaveBeenCalledWith(
			'storage',
			expect.any(Function)
		);

		lifecycle.runCleanup();
		expect(removeEventListener).toHaveBeenCalledWith(
			'storage',
			expect.any(Function)
		);
	});

	it('preserves a pre-mount storage write instead of replacing it on mount', () => {
		const getItem = vi.fn(() => JSON.stringify('stored'));
		const setItem = vi.fn();
		const storage = { getItem, setItem } as unknown as Storage;
		vi.stubGlobal('document', {});
		vi.stubGlobal('window', {
			localStorage: storage,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		});

		const { hook, lifecycle } = setupComponentHook(() =>
			useLocalStorage('theme', 'system')
		);
		hook.setValue('dark');

		expect(hook.value.value).toBe('dark');
		expect(setItem).not.toHaveBeenCalled();
		lifecycle.runMount();
		expect(hook.value.value).toBe('dark');
		expect(setItem).toHaveBeenCalledWith('theme', JSON.stringify('dark'));
		expect(getItem).not.toHaveBeenCalled();
		lifecycle.runCleanup();
	});

	it('defers click-outside listener attachment until the target can exist', () => {
		const addEventListener = vi.fn();
		const removeEventListener = vi.fn();
		vi.stubGlobal('document', {
			addEventListener,
			removeEventListener,
			querySelector: vi.fn(() => null),
		});
		let target: Element | undefined;
		const callback = vi.fn();
		const { lifecycle } = setupComponentHook(() =>
			useOnClickOutside(() => target, callback)
		);

		expect(addEventListener).not.toHaveBeenCalled();
		target = { contains: () => false } as unknown as Element;
		lifecycle.runMount();
		expect(addEventListener).toHaveBeenCalledWith(
			'mousedown',
			expect.any(Function)
		);

		const handler = addEventListener.mock.calls[0]?.[1] as
			| ((event: MouseEvent) => void)
			| undefined;
		handler?.({ target: {} } as MouseEvent);
		expect(callback).toHaveBeenCalledOnce();

		lifecycle.runCleanup();
		expect(removeEventListener).toHaveBeenCalledWith(
			'mousedown',
			expect.any(Function)
		);
	});

	it('does not acquire a resource stopped before mount', () => {
		const addEventListener = vi.fn();
		vi.stubGlobal('document', {
			addEventListener,
			removeEventListener: vi.fn(),
			querySelector: vi.fn(() => null),
		});
		const { hook: stop, lifecycle } = setupComponentHook(() =>
			useOnClickOutside(
				() => ({ contains: () => false }) as unknown as Element,
				vi.fn()
			)
		);

		stop();
		lifecycle.runMount();
		expect(addEventListener).not.toHaveBeenCalled();
		lifecycle.runCleanup();
	});

	it('constructs and targets ResizeObserver only after mount', () => {
		const observe = vi.fn();
		const disconnect = vi.fn();
		const constructor = vi.fn();
		let notify: ResizeObserverCallback | undefined;
		class MockResizeObserver {
			constructor(_callback: ResizeObserverCallback) {
				constructor();
				notify = _callback;
			}
			observe = observe;
			disconnect = disconnect;
		}
		vi.stubGlobal('document', {});
		vi.stubGlobal('ResizeObserver', MockResizeObserver);
		let target: Element | undefined;
		const { hook, lifecycle } = setupComponentHook(() =>
			useResizeObserver(() => target)
		);

		expect(constructor).not.toHaveBeenCalled();
		target = {} as Element;
		lifecycle.runMount();
		expect(constructor).toHaveBeenCalledOnce();
		expect(observe).toHaveBeenCalledWith(target);

		lifecycle.runCleanup();
		expect(disconnect).toHaveBeenCalledOnce();
		notify?.(
			[{ contentRect: { width: 10, height: 20 } } as ResizeObserverEntry],
			{} as ResizeObserver
		);
		expect(hook.value).toEqual({ width: 0, height: 0 });
	});

	it('constructs and targets IntersectionObserver only after mount', () => {
		const observe = vi.fn();
		const disconnect = vi.fn();
		const constructor = vi.fn();
		let notify: IntersectionObserverCallback | undefined;
		class MockIntersectionObserver {
			constructor(
				_callback: IntersectionObserverCallback,
				_options?: IntersectionObserverInit
			) {
				constructor(_options);
				notify = _callback;
			}
			observe = observe;
			disconnect = disconnect;
		}
		vi.stubGlobal('document', {});
		vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
		let target: Element | undefined;
		const { hook, lifecycle } = setupComponentHook(() =>
			useIntersectionObserver(() => target, { threshold: 0.5 })
		);

		expect(constructor).not.toHaveBeenCalled();
		target = {} as Element;
		lifecycle.runMount();
		expect(constructor).toHaveBeenCalledOnce();
		expect(constructor).toHaveBeenCalledWith({ threshold: 0.5 });
		expect(observe).toHaveBeenCalledWith(target);

		lifecycle.runCleanup();
		expect(disconnect).toHaveBeenCalledOnce();
		notify?.(
			[
				{
					isIntersecting: true,
					intersectionRatio: 1,
				} as IntersectionObserverEntry,
			],
			{} as IntersectionObserver
		);
		expect(hook.value.isIntersecting).toBe(false);
		expect(hook.value.intersectionRatio).toBe(0);
	});
});
