/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it, vi } from 'vitest';
import { createReactiveProps } from '../../blueprint/reactive-props.js';
import { watchEffect } from '../../effects/effect.js';

/** Collects what an effect observes for one prop across updates. */
const observe = <P extends object>(
	props: ReactiveProps<P>,
	read: (proxy: P) => unknown
): { seen: unknown[]; stop: () => void } => {
	const seen: unknown[] = [];
	const handle = watchEffect(() => {
		seen.push(read(props.proxy));
	});
	return { seen, stop: handle.stop };
};

type ReactiveProps<P extends object> = ReturnType<typeof createReactiveProps<P>>;

describe('reactive props presence changes', () => {
	it('notifies when a prop is removed', () => {
		const props = createReactiveProps<{ a?: number; b?: number }>({ a: 1, b: 2 });
		const { seen, stop } = observe(props, (proxy) => proxy.a);

		props.update({ b: 2 });

		expect(seen).toEqual([1, undefined]);
		expect(props.proxy.a).toBeUndefined();
		stop();
	});

	it('notifies when a prop is added', () => {
		const props = createReactiveProps<{ a?: number; c?: number }>({ a: 1 });
		const { seen, stop } = observe(props, (proxy) => proxy.c);

		props.update({ a: 1, c: 9 });

		expect(seen).toEqual([undefined, 9]);
		expect(props.proxy.c).toBe(9);
		stop();
	});

	it('notifies across a remove and a re-add', () => {
		const props = createReactiveProps<{ a?: number }>({ a: 1 });
		const { seen, stop } = observe(props, (proxy) => proxy.a);

		props.update({});
		props.update({ a: 3 });

		expect(seen).toEqual([1, undefined, 3]);
		stop();
	});

	it('notifies when an existing prop changes', () => {
		const props = createReactiveProps<{ a: number }>({ a: 1 });
		const { seen, stop } = observe(props, (proxy) => proxy.a);

		props.update({ a: 2 });

		expect(seen).toEqual([1, 2]);
		stop();
	});

	it('does not notify when a prop is set to the same value', () => {
		const props = createReactiveProps<{ a: number }>({ a: 1 });
		const { seen, stop } = observe(props, (proxy) => proxy.a);

		props.update({ a: 1 });
		props.update({ a: 1 });

		expect(seen).toEqual([1]);
		stop();
	});

	it('reports only present props through in, keys, and spread', () => {
		const props = createReactiveProps<{ a?: number; b?: number }>({ a: 1, b: 2 });

		// Reading an absent prop must not make it appear present.
		void props.proxy.a;
		void (props.proxy as { missing?: unknown }).missing;

		props.update({ b: 5 });

		expect('a' in props.proxy).toBe(false);
		expect('b' in props.proxy).toBe(true);
		expect(Object.keys(props.proxy)).toEqual(['b']);
		expect({ ...props.proxy }).toEqual({ b: 5 });
	});

	it('keeps a prop absent that was only ever read', () => {
		const props = createReactiveProps<{ a: number }>({ a: 1 });

		void (props.proxy as { ghost?: unknown }).ghost;

		expect('ghost' in props.proxy).toBe(false);
		expect(Object.keys(props.proxy)).toEqual(['a']);
	});

	it('still refuses writes through the proxy', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const props = createReactiveProps<{ a: number }>({ a: 1 });

		(props.proxy as { a: number }).a = 5;

		expect(props.proxy.a).toBe(1);
		warn.mockRestore();
	});
});
