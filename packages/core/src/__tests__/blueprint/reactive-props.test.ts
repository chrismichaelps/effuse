/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createReactiveProps } from '../../blueprint/reactive-props.js';
import { computed } from '../../reactivity/computed.js';
import { watch } from '../../effects/index.js';
import { signal } from '../../reactivity/signal.js';
import { define } from '../../blueprint/define.js';
import { createScriptContext } from '../../blueprint/script-context.js';

describe('createReactiveProps', () => {
	it('should create a proxy that returns prop values', () => {
		const { proxy } = createReactiveProps({ name: 'Effuse', count: 42 });

		expect(proxy.name).toBe('Effuse');
		expect(proxy.count).toBe(42);
	});

	it('should allow computed to track prop reads', () => {
		const { proxy, update } = createReactiveProps({ value: 10 });

		const doubled = computed(() => (proxy.value as number) * 2);
		expect(doubled.value).toBe(20);

		update({ value: 15 });
		expect(doubled.value).toBe(30);
	});

	it('should allow watch to track prop changes', async () => {
		const { proxy, update } = createReactiveProps({ status: 'idle' });

		const changes: string[] = [];
		watch(
			() => proxy.status as string,
			(newVal, oldVal) => {
				changes.push(`${oldVal} → ${newVal}`);
			}
		);

		update({ status: 'loading' });
		await new Promise((r) => setTimeout(r, 10));

		update({ status: 'done' });
		await new Promise((r) => setTimeout(r, 10));

		expect(changes).toContain('idle → loading');
		expect(changes).toContain('loading → done');
	});

	it('should add new keys via update', () => {
		const { proxy, update } = createReactiveProps<{ a: number; b?: number }>({ a: 1 });

		expect(proxy.a).toBe(1);
		expect(proxy.b).toBeUndefined();

		update({ a: 2, b: 3 });
		expect(proxy.a).toBe(2);
		expect(proxy.b).toBe(3);
	});

	it('should enumerate keys via Object.keys', () => {
		const { proxy, update } = createReactiveProps<{ x: number; y?: number }>({ x: 1 });

		expect(Object.keys(proxy)).toEqual(['x']);

		update({ x: 2, y: 3 });
		expect(Object.keys(proxy)).toEqual(['x', 'y']);
	});

	it('should support the in operator', () => {
		const { proxy, update } = createReactiveProps<{ a: number; b?: number }>({ a: 1 });

		expect('a' in proxy).toBe(true);
		expect('b' in proxy).toBe(false);

		update({ a: 1, b: 2 });
		expect('b' in proxy).toBe(true);
	});

	describe('readonly enforcement', () => {
		let warnSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		});

		afterEach(() => {
			warnSpy.mockRestore();
		});

		it('should warn when mutating a prop in development', () => {
			const { proxy } = createReactiveProps({ name: 'test' });

			// @ts-expect-error — props are readonly
			proxy.name = 'hacked';

			if (process.env.NODE_ENV !== 'production') {
				expect(warnSpy).toHaveBeenCalledWith(
					expect.stringContaining('Attempted to mutate prop "name"')
				);
			}
		});
	});
});

describe('reactive props — blueprint integration', () => {
	it('should make props reactive inside script context', () => {
		const { context } = createScriptContext({ title: 'Hello' });

		// props should be a Proxy, not a frozen plain object
		expect(() => {
			// @ts-expect-error
			context.props.title = ' mutated';
		}).not.toThrow();

		// Reading should still work
		expect(context.props.title).toBe('Hello');
	});

	it('should allow computed derived from props in script', () => {
		const Component = define({
			props: { count: 0 as number },
			script: ({ props }) => {
				const doubled = computed(() => props.count * 2);
				return { doubled };
			},
			template: ({ doubled }) => doubled.value,
		});

		const blueprint = Component as unknown as {
			state: (props: Record<string, unknown>) => Record<string, unknown>;
		};
		const state = blueprint.state({ count: 5 });
		expect((state as { exposed: { doubled: { value: number } } }).exposed.doubled.value).toBe(10);
	});

	it('should pass reactive props to template', () => {
		let capturedProps: unknown;

		const Component = define({
			props: { label: 'default' },
			script: () => ({ greeting: 'hi' }),
			template: (ctx) => {
				capturedProps = ctx;
				return null;
			},
		});

		const blueprint = Component as unknown as {
			state: (props: Record<string, unknown>) => Record<string, unknown>;
			view: (ctx: { props: Record<string, unknown>; state: Record<string, unknown> }) => unknown;
		};

		const state = blueprint.state({ label: 'test' });
		blueprint.view({ props: { label: 'test' }, state });

		expect(capturedProps).toBeDefined();
	});
});
