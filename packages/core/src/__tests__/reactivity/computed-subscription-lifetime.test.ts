import { describe, expect, it, vi } from 'vitest';
import { computed, disposeComputed } from '../../reactivity/computed.js';
import { getSignalDep, signal } from '../../reactivity/signal.js';
import { watchEffect } from '../../effects/effect.js';

const subscriberCount = (source: ReturnType<typeof signal<number>>): number =>
	getSignalDep(source)?.subscriberCount ?? -1;

describe('computed subscription lifetime', () => {
	it('does not retain subscriptions for computeds nobody observes', () => {
		const source = signal(1);
		expect(subscriberCount(source)).toBe(0);

		for (let index = 0; index < 100; index++) {
			const derived = computed(() => source.value * 2);
			expect(derived.value).toBe(source.value * 2);
		}

		expect(subscriberCount(source)).toBe(0);
	});

	it('releases source subscriptions when the last observer stops', () => {
		const source = signal(1);
		const derived = computed(() => source.value * 2);

		const handle = watchEffect(() => {
			void derived.value;
		});
		expect(subscriberCount(source)).toBeGreaterThan(0);

		handle.stop();
		expect(subscriberCount(source)).toBe(0);
	});

	it('keeps pushing updates to observers while observed', () => {
		const source = signal(1);
		const derived = computed(() => source.value * 2);
		const seen: number[] = [];

		const handle = watchEffect(() => {
			seen.push(derived.value);
		});

		source.value = 2;
		source.value = 3;
		handle.stop();

		expect(seen).toEqual([2, 4, 6]);
	});

	it('recomputes on read after a source changed while unobserved', () => {
		const source = signal(1);
		const getter = vi.fn(() => source.value * 2);
		const derived = computed(getter);

		expect(derived.value).toBe(2);
		expect(getter).toHaveBeenCalledTimes(1);

		source.value = 5;

		expect(derived.value).toBe(10);
		expect(getter).toHaveBeenCalledTimes(2);
	});

	it('serves a cached value while unobserved and unchanged', () => {
		const source = signal(1);
		const getter = vi.fn(() => source.value * 2);
		const derived = computed(getter);

		expect(derived.value).toBe(2);
		expect(derived.value).toBe(2);
		expect(derived.value).toBe(2);

		expect(getter).toHaveBeenCalledTimes(1);
	});

	it('does not recompute when an unrelated signal changes', () => {
		const source = signal(1);
		const unrelated = signal('a');
		const getter = vi.fn(() => source.value * 2);
		const derived = computed(getter);

		expect(derived.value).toBe(2);
		unrelated.value = 'b';
		expect(derived.value).toBe(2);

		expect(getter).toHaveBeenCalledTimes(1);
	});

	it('resubscribes and refreshes when observation resumes', () => {
		const source = signal(1);
		const derived = computed(() => source.value * 2);

		const first = watchEffect(() => {
			void derived.value;
		});
		first.stop();
		expect(subscriberCount(source)).toBe(0);

		source.value = 4;

		const seen: number[] = [];
		const second = watchEffect(() => {
			seen.push(derived.value);
		});
		expect(seen).toEqual([8]);
		expect(subscriberCount(source)).toBeGreaterThan(0);

		source.value = 5;
		expect(seen).toEqual([8, 10]);
		second.stop();
	});

	it('propagates through chained computeds', () => {
		const source = signal(1);
		const doubled = computed(() => source.value * 2);
		const quadrupled = computed(() => doubled.value * 2);

		expect(quadrupled.value).toBe(4);
		source.value = 3;
		expect(quadrupled.value).toBe(12);
		expect(subscriberCount(source)).toBe(0);
	});

	it('tracks a diamond dependency exactly once per observer run', () => {
		const source = signal(1);
		const left = computed(() => source.value + 1);
		const right = computed(() => source.value + 2);
		const seen: number[] = [];

		const handle = watchEffect(() => {
			seen.push(left.value + right.value);
		});

		source.value = 2;
		handle.stop();

		expect(seen).toEqual([5, 7]);
		expect(subscriberCount(source)).toBe(0);
	});

	it('drops dependencies that a later run no longer reads', () => {
		const toggle = signal(true);
		const used = signal(1);
		const derived = computed(() => (toggle.value ? used.value : 0));

		const handle = watchEffect(() => {
			void derived.value;
		});
		expect(subscriberCount(used)).toBeGreaterThan(0);

		toggle.value = false;
		expect(derived.value).toBe(0);
		expect(subscriberCount(used)).toBe(0);

		handle.stop();
	});

	it('still supports explicit disposal', () => {
		const source = signal(1);
		const derived = computed(() => source.value * 2);

		const handle = watchEffect(() => {
			void derived.value;
		});
		expect(subscriberCount(source)).toBeGreaterThan(0);

		disposeComputed(derived);
		expect(subscriberCount(source)).toBe(0);

		handle.stop();
	});
});
