import { describe, expect, it } from 'vitest';
import {
	runRateLimiterConformance,
	runSessionStoreConformance,
	type ConformanceHarness,
} from '../conformance.js';
import { createStorageSessionStore } from '../server/storage-session-store.js';
import {
	createMemoryRateLimiter,
	createMemorySessionStore,
	createTestClock,
	type TestClock,
} from '../testing/index.js';
import { createMemoryAuthStorage } from '../testing/storage.js';

// The suites are written against a minimal runner surface so a third-party
// adapter can run them under vitest, jest, or node:test without adopting ours.
const harness = { describe, it, expect } as unknown as ConformanceHarness;

// The reference implementations are held to the same suite a third-party
// backend must pass. A suite the reference cannot satisfy is a suite nobody
// should be asked to satisfy.
describe('memory session store', () => {
	let clock: TestClock;

	runSessionStoreConformance({
		harness,
		createStore: () => {
			clock = createTestClock();
			return createMemorySessionStore(clock);
		},
		advanceTime: (ms) => {
			clock.advance(ms);
		},
	});
});

describe('storage-backed session store', () => {
	// The important case: a store built from nothing but key-value get/set/delete
	// passes the identical suite. That is the whole argument against a
	// fifteen-method adapter contract.
	let clock: TestClock;

	runSessionStoreConformance({
		harness,
		createStore: () => {
			clock = createTestClock();
			return createStorageSessionStore({
				storage: createMemoryAuthStorage(clock),
				clock,
				ttlMs: 3_600_000,
			});
		},
		advanceTime: (ms) => {
			clock.advance(ms);
		},
	});
});

describe('memory rate limiter', () => {
	let clock: TestClock;

	runRateLimiterConformance({
		harness,
		createLimiter: (options) => {
			clock = createTestClock();
			return createMemoryRateLimiter(options, clock);
		},
		advanceTime: (ms) => {
			clock.advance(ms);
		},
	});
});
