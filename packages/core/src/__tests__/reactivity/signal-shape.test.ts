import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { computed } from '../../reactivity/computed.js';
import {
	getSignalDep,
	getSignalRef,
	isSignal,
	signal,
} from '../../reactivity/signal.js';
import { watchEffect } from '../../effects/effect.js';
import { Dep } from '../../reactivity/dep.js';
import { isEffuseNode } from '../../render/node.js';

const nsPerOp = (iterations: number, fn: () => void): number => {
	for (let index = 0; index < iterations; index++) fn();
	const start = process.hrtime.bigint();
	for (let index = 0; index < iterations; index++) fn();
	return Number(process.hrtime.bigint() - start) / iterations;
};

const ITERATIONS = 100_000;

describe('signal instance shape', () => {
	it('keeps the internal accessors reachable', () => {
		const source = signal(1, 'named');

		expect('_dep' in source).toBe(true);
		expect('_ref' in source).toBe(true);
		expect('_version' in source).toBe(true);
		expect('_traceId' in source).toBe(true);
		expect(getSignalDep(source)).not.toBeNull();
		expect(getSignalRef(source)).not.toBeNull();
	});

	it('still detects signals through isSignal', () => {
		expect(isSignal(signal(0))).toBe(true);
		expect(isSignal(computed(() => 1))).toBe(true);
		expect(isSignal({ value: 1 })).toBe(false);
		expect(isSignal(null)).toBe(false);
		expect(isSignal(42)).toBe(false);
	});

	it('is not mistaken for a render node', () => {
		expect(isEffuseNode(signal(0))).toBe(false);
		expect(isEffuseNode(computed(() => 1))).toBe(false);
	});

	it('reports a live version box with a stable identity', () => {
		const source = signal(1) as unknown as {
			_version: { value: number };
		};

		const box = source._version;
		expect(source._version).toBe(box);
		const before = box.value;

		(source as unknown as { value: number }).value = 2;

		expect(box.value).toBeGreaterThan(before);
		expect(source._version.value).toBe(box.value);
	});

	it('reports a stable trace id', () => {
		const source = signal(1) as unknown as { _traceId: string };
		const first = source._traceId;

		expect(typeof first).toBe('string');
		expect(first.length).toBeGreaterThan(0);
		expect(source._traceId).toBe(first);
	});

	it('uses a provided name as the trace id', () => {
		const source = signal(1, 'my-signal') as unknown as { _traceId: string };
		expect(source._traceId).toBe('my-signal');
	});

	it('gives distinct signals distinct trace ids', () => {
		const first = signal(1) as unknown as { _traceId: string };
		const second = signal(1) as unknown as { _traceId: string };
		expect(first._traceId).not.toBe(second._traceId);
	});

	it('keeps reads, writes and notification working', () => {
		const source = signal(1);
		const seen: number[] = [];
		const handle = watchEffect(() => {
			seen.push(source.value);
		});

		source.value = 2;
		source.value = 2;
		source.value = 3;
		handle.stop();

		expect(seen).toEqual([1, 2, 3]);
	});

	it('keeps the lazy subscription ref in step with writes', () => {
		const source = signal(1);
		source.value = 2;

		const ref = getSignalRef(source);
		expect(Effect.runSync(ref!.get)).toBe(2);

		source.value = 3;
		expect(Effect.runSync(ref!.get)).toBe(3);
	});
});

/**
 * Allocation-heavy timings drift with GC, so creation is compared against the
 * per-instance-accessor shape it replaced, built here and measured in the same
 * process. That states the regression directly and holds on any machine.
 */
const perInstanceAccessorShape = (initial: number): object => {
	const dep = new Dep();
	const version = { value: 0 };
	let cached = initial;
	return {
		get _dep() {
			return dep;
		},
		get _version() {
			return version;
		},
		get _traceId() {
			return 'signal';
		},
		get value() {
			dep.track();
			return cached;
		},
		set value(next: number) {
			if (!Object.is(cached, next)) {
				cached = next;
				version.value++;
				dep.trigger();
			}
		},
	};
};

describe('reactive hot paths', () => {
	it('creates a signal several times faster than a per-instance shape', () => {
		const shapeCost = nsPerOp(ITERATIONS, () =>
			perInstanceAccessorShape(0)
		);
		const signalCost = nsPerOp(ITERATIONS, () => void signal(0));

		expect(signalCost).toBeLessThan(shapeCost / 3);
	});

	it('writes a signal faster than a per-instance shape', () => {
		const shape = perInstanceAccessorShape(0) as { value: number };
		let shapeNext = 0;
		const shapeCost = nsPerOp(ITERATIONS, () => {
			shape.value = shapeNext++;
		});

		const source = signal(0);
		let next = 0;
		const writeCost = nsPerOp(ITERATIONS, () => {
			source.value = next++;
		});

		expect(writeCost).toBeLessThan(shapeCost);
	});

	it('creates a computed faster than a per-instance shape', () => {
		const source = signal(0);
		const shapeCost = nsPerOp(ITERATIONS, () =>
			perInstanceAccessorShape(0)
		);
		const computedCost = nsPerOp(
			ITERATIONS,
			() => void computed(() => source.value)
		);

		expect(computedCost).toBeLessThan(shapeCost);
	});
});
