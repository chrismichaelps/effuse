import { afterEach, describe, expect, it, vi } from 'vitest';
import { define, isSignal, type ComponentLifecycle } from '@effuse/core';
import { createQueryClient } from '../client/client.js';
import { useInfiniteQuery } from './useInfiniteQuery.js';
import { useIsFetching } from './useIsFetching.js';
import { useIsMutating } from './useIsMutating.js';
import { useQueries } from './useQueries.js';
import { useQuery } from './useQuery.js';

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

describe('query hook lifecycle ownership', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('does not start refetch intervals during server setup', () => {
		vi.useFakeTimers();
		const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
		vi.stubGlobal('window', undefined);
		vi.stubGlobal('document', undefined);
		const client = createQueryClient();
		const { lifecycle } = setupComponentHook(() =>
			useQuery({
				queryKey: ['server-poll'],
				queryFn: async () => 'data',
				client,
				enabled: false,
				refetchInterval: 1_000,
			})
		);

		expect(setIntervalSpy).not.toHaveBeenCalled();
		lifecycle.runCleanup();
	});

	it('mounts and automatically cleans query browser resources', () => {
		vi.useFakeTimers();
		const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
		const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
		const addEventListener = vi.fn();
		const removeEventListener = vi.fn();
		vi.stubGlobal('window', { addEventListener, removeEventListener });
		vi.stubGlobal('document', {});
		const client = createQueryClient();
		const { lifecycle } = setupComponentHook(() =>
			useQuery({
				queryKey: ['browser-poll'],
				queryFn: async () => 'data',
				client,
				enabled: false,
				refetchInterval: 1_000,
			})
		);

		expect(addEventListener).not.toHaveBeenCalled();
		expect(setIntervalSpy).not.toHaveBeenCalled();
		lifecycle.runMount();
		expect(addEventListener).toHaveBeenCalledWith(
			'focus',
			expect.any(Function)
		);
		expect(addEventListener).toHaveBeenCalledWith(
			'online',
			expect.any(Function)
		);
		expect(setIntervalSpy).toHaveBeenCalledOnce();

		lifecycle.runCleanup();
		expect(removeEventListener).toHaveBeenCalledTimes(2);
		expect(clearIntervalSpy).toHaveBeenCalledOnce();
	});

	it('defers and cleans infinite-query browser listeners', () => {
		const addEventListener = vi.fn();
		const removeEventListener = vi.fn();
		vi.stubGlobal('window', { addEventListener, removeEventListener });
		vi.stubGlobal('document', {});
		const client = createQueryClient();
		const { lifecycle } = setupComponentHook(() =>
			useInfiniteQuery({
				queryKey: ['feed'],
				queryFn: async () => ({ items: [] as string[], next: undefined }),
				initialPageParam: 0,
				getNextPageParam: (page) => page.next,
				client,
				enabled: false,
			})
		);

		expect(addEventListener).not.toHaveBeenCalled();
		lifecycle.runMount();
		expect(addEventListener).toHaveBeenCalledTimes(2);
		lifecycle.runCleanup();
		expect(removeEventListener).toHaveBeenCalledTimes(2);
	});

	it('unsubscribes cache count hooks during component cleanup', () => {
		const client = createQueryClient();
		const fetchingUnsubscribe = vi.fn();
		const mutatingUnsubscribe = vi.fn();
		vi.spyOn(client.queryCache, 'subscribe').mockReturnValue(
			fetchingUnsubscribe
		);
		vi.spyOn(client.mutationCache, 'subscribe').mockReturnValue(
			mutatingUnsubscribe
		);
		const { lifecycle } = setupComponentHook(() => {
			useIsFetching({ client });
			useIsMutating({ client });
			return {};
		});

		expect(fetchingUnsubscribe).not.toHaveBeenCalled();
		expect(mutatingUnsubscribe).not.toHaveBeenCalled();
		lifecycle.runCleanup();
		expect(fetchingUnsubscribe).toHaveBeenCalledOnce();
		expect(mutatingUnsubscribe).toHaveBeenCalledOnce();
	});

	it('preserves computed signal identity on count hooks', () => {
		const client = createQueryClient();
		const fetching = useIsFetching({ client });
		const mutating = useIsMutating({ client });

		expect(isSignal(fetching)).toBe(true);
		expect(isSignal(mutating)).toBe(true);
		fetching.dispose();
		mutating.dispose();
	});

	it('retains explicit disposal on composed standalone queries', () => {
		const client = createQueryClient();
		const [result] = useQueries([
			{
				queryKey: ['composed'],
				queryFn: async () => 'data',
				client,
				enabled: false,
			},
		]);

		expect(
			typeof (result as unknown as { dispose?: unknown }).dispose
		).toBe('function');
		(result as unknown as { dispose: () => void }).dispose();
	});
});
