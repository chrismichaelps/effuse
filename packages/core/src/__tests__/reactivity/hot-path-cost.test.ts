import { Effect, SubscriptionRef } from 'effect';
import { describe, expect, it } from 'vitest';
import { getSignalRef, signal } from '../../reactivity/signal.js';
import { createRef } from '../../refs/ref.js';

/**
 * Each hot path is compared against the very `SubscriptionRef` operation it
 * used to perform, measured in the same process. That keeps the assertion
 * machine-independent and states the regression directly: if the operation
 * creeps back onto the hot path, the path cannot beat the operation.
 */
const nsPerOp = (iterations: number, fn: () => void): number => {
	for (let index = 0; index < iterations; index++) fn();
	const start = process.hrtime.bigint();
	for (let index = 0; index < iterations; index++) fn();
	return Number(process.hrtime.bigint() - start) / iterations;
};

const ITERATIONS = 20_000;

const subscriptionRefSetCost = (): number => {
	const ref = Effect.runSync(SubscriptionRef.make(0));
	let next = 0;
	return nsPerOp(ITERATIONS, () => {
		Effect.runSync(SubscriptionRef.set(ref, next++));
	});
};

const subscriptionRefGetCost = (): number => {
	const ref = Effect.runSync(SubscriptionRef.make<unknown>(null));
	return nsPerOp(ITERATIONS, () => {
		Effect.runSync(SubscriptionRef.get(ref));
	});
};

describe('reactive hot paths stay off the Effect runtime', () => {
	it('writes a signal faster than the SubscriptionRef.set it replaced', () => {
		const source = signal(0);
		let next = 0;
		const writeCost = nsPerOp(ITERATIONS, () => {
			source.value = next++;
		});

		expect(writeCost).toBeLessThan(subscriptionRefSetCost());
	});

	it('reads ref.current faster than the SubscriptionRef.get it replaced', () => {
		const ref = createRef();
		const readCost = nsPerOp(ITERATIONS, () => {
			void ref.current;
		});

		expect(readCost).toBeLessThan(subscriptionRefGetCost());
	});

	it('still exposes a subscription ref that tracks writes', () => {
		const source = signal(1);

		// Requested after a write, so the lazy ref must adopt the current value.
		source.value = 2;
		const ref = getSignalRef(source);
		expect(ref).not.toBeNull();
		expect(Effect.runSync(ref!.get)).toBe(2);

		// And must keep following writes once it exists.
		source.value = 3;
		expect(Effect.runSync(ref!.get)).toBe(3);
	});

	it('returns a stable subscription ref across calls', () => {
		const source = signal('a');
		expect(getSignalRef(source)).toBe(getSignalRef(source));
	});
});
