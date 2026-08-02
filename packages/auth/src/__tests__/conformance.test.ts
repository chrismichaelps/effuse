import { describe, expect, it } from 'vitest';
import {
	runPasswordHasherConformance,
	runRateLimiterConformance,
	runSessionStoreConformance,
	runTokenCodecConformance,
	runUserStoreConformance,
	type ConformanceHarness,
} from '../conformance.js';
import { createScryptHasher } from '../server/password-hasher.js';
import { createTokenCodec } from '../server/token-codec.js';
import { createMemoryUserStore } from '../testing/index.js';
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

describe('scrypt password hasher', () => {
	// Deliberately weak parameters so the suite stays fast. Production defaults
	// are exercised in password-hasher.test.ts.
	runPasswordHasherConformance({
		harness,
		createHasher: () =>
			createScryptHasher({ cost: 2 ** 12, blockSize: 8, parallelism: 1 }),
		createWeakerHasher: () =>
			createScryptHasher({ cost: 2 ** 11, blockSize: 8, parallelism: 1 }),
	});
});

describe('hmac token codec', () => {
	runTokenCodecConformance({
		harness,
		createCodec: () => createTokenCodec({ secrets: ['c'.repeat(32)] }),
		createForeignCodec: () => createTokenCodec({ secrets: ['d'.repeat(32)] }),
	});
});

describe('memory user store', () => {
	runUserStoreConformance({
		harness,
		createStore: () => {
			const store = createMemoryUserStore();
			return { store, seed: store.seed, read: store.get };
		},
	});
});
