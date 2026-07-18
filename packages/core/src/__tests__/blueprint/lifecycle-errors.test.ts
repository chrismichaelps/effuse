import { describe, expect, it } from 'vitest';
import {
	createComponentLifecycleSync,
	LifecycleError,
} from '../../blueprint/lifecycle.js';

describe('component lifecycle errors', () => {
	it('runs every mount callback and aggregates failures', () => {
		const lifecycle = createComponentLifecycleSync();
		const calls: string[] = [];
		lifecycle.onBeforeMount(() => {
			calls.push('before-failed');
			throw new Error('before mount failed');
		});
		lifecycle.onBeforeMount(() => calls.push('before-ok'));
		lifecycle.onMount(() => {
			calls.push('mount-failed');
			throw new Error('mount failed');
		});
		lifecycle.onMount(() => {
			calls.push('mount-ok');
		});

		try {
			lifecycle.runMount();
			expect.unreachable('mount failures must be observable');
		} catch (error) {
			expect(error).toBeInstanceOf(LifecycleError);
			const lifecycleError = error as LifecycleError;
			expect(lifecycleError.phase).toBe('mount');
			expect(lifecycleError.failures.map(({ hook }) => hook)).toEqual([
				'beforeMount',
				'mount',
			]);
		}
		expect(calls).toEqual([
			'before-failed',
			'before-ok',
			'mount-failed',
			'mount-ok',
		]);
	});

	it('finishes cleanup in ownership order before throwing once', () => {
		const lifecycle = createComponentLifecycleSync();
		const calls: string[] = [];
		lifecycle.onMount(() => {
			calls.push('mount-1');
			return () => {
				calls.push('cleanup-1');
				throw new Error('cleanup 1 failed');
			};
		});
		lifecycle.onMount(() => {
			calls.push('mount-2');
			return () => calls.push('cleanup-2');
		});
		lifecycle.onBeforeUnmount(() => {
			calls.push('before-unmount');
			throw new Error('before unmount failed');
		});
		lifecycle.onUnmount(() => {
			calls.push('unmount-1');
			throw new Error('unmount 1 failed');
		});
		lifecycle.onUnmount(() => calls.push('unmount-2'));
		lifecycle.runMount();

		expect(() => lifecycle.runCleanup()).toThrow(LifecycleError);
		expect(calls).toEqual([
			'mount-1',
			'mount-2',
			'before-unmount',
			'cleanup-2',
			'cleanup-1',
			'unmount-2',
			'unmount-1',
		]);
		expect(() => lifecycle.runCleanup()).not.toThrow();
	});
});
