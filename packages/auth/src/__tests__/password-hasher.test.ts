import { describe, expect, it } from 'vitest';
import { createScryptHasher } from '../server/password-hasher.js';

// Deliberately weak parameters so the suite stays fast. Production defaults are
// exercised separately in the defaults test below.
const fast = { cost: 2 ** 12, blockSize: 8, parallelism: 1 };

describe('createScryptHasher', () => {
	it('verifies a password against its own hash', async () => {
		const hasher = createScryptHasher(fast);
		const stored = await hasher.hash('correct horse battery staple');

		await expect(
			hasher.verify('correct horse battery staple', stored)
		).resolves.toBe(true);
	});

	it('rejects a wrong password', async () => {
		const hasher = createScryptHasher(fast);
		const stored = await hasher.hash('correct horse battery staple');

		await expect(hasher.verify('wrong', stored)).resolves.toBe(false);
	});

	it('salts each hash, so identical passwords do not collide', async () => {
		// Without a per-hash salt, a stolen table reveals which accounts share a
		// password and becomes vulnerable to a single precomputed dictionary.
		const hasher = createScryptHasher(fast);

		expect(await hasher.hash('same')).not.toBe(await hasher.hash('same'));
	});

	it('records its parameters in the stored hash', async () => {
		// Self-describing storage is what makes raising cost possible later
		// without a migration: an old hash still carries the parameters needed to
		// verify it.
		const stored = await createScryptHasher(fast).hash('pw');

		expect(stored.startsWith('scrypt$')).toBe(true);
		expect(stored.split('$')).toHaveLength(6);
	});

	it('verifies a hash produced under different parameters', async () => {
		const weak = createScryptHasher({ ...fast, cost: 2 ** 12 });
		const strong = createScryptHasher({ ...fast, cost: 2 ** 14 });

		const stored = await weak.hash('pw');

		await expect(strong.verify('pw', stored)).resolves.toBe(true);
	});
});

describe('needsRehash', () => {
	it('flags a hash weaker than current policy', async () => {
		const weak = createScryptHasher({ ...fast, cost: 2 ** 12 });
		const strong = createScryptHasher({ ...fast, cost: 2 ** 14 });

		expect(strong.needsRehash(await weak.hash('pw'))).toBe(true);
	});

	it('does not flag a hash at current policy', async () => {
		const hasher = createScryptHasher(fast);

		expect(hasher.needsRehash(await hasher.hash('pw'))).toBe(false);
	});

	it('flags an unparseable hash so it gets replaced on next sign-in', async () => {
		const hasher = createScryptHasher(fast);

		expect(hasher.needsRehash('not-a-hash')).toBe(true);
		expect(hasher.needsRehash('')).toBe(true);
		// A bcrypt hash imported from another system: verifiable by nothing here,
		// so it must be marked for replacement rather than silently trusted.
		expect(hasher.needsRehash('$2b$10$abcdefghijklmnopqrstuv')).toBe(true);
	});
});

describe('malformed stored hashes', () => {
	it('returns false rather than throwing', async () => {
		// A corrupted or foreign row in the users table must fail one sign-in, not
		// take down the endpoint for everybody.
		const hasher = createScryptHasher(fast);

		for (const bad of [
			'',
			'not-a-hash',
			'scrypt$',
			'scrypt$a$b$c$d$e',
			'scrypt$16384$8$1$notbase64!!$deadbeef',
			'$2b$10$abcdefghijklmnopqrstuv',
		]) {
			await expect(hasher.verify('pw', bad)).resolves.toBe(false);
		}
	});

	it('rejects parameters large enough to exhaust memory', async () => {
		// The stored hash dictates the work factor, so a tampered row could
		// otherwise be turned into a memory-exhaustion denial of service.
		const hasher = createScryptHasher(fast);
		const hostile = `scrypt$${String(2 ** 30)}$64$16$c2FsdA$aGFzaA`;

		await expect(hasher.verify('pw', hostile)).resolves.toBe(false);
	});
});

describe('defaults', () => {
	it('ships parameters strong enough to be worth the wait', async () => {
		// OWASP's floor for scrypt is N=2^17, r=8, p=1. A default below that would
		// mean most deployments run under-protected, since defaults are what most
		// deployments use.
		const hasher = createScryptHasher();
		const stored = await hasher.hash('pw');
		const cost = Number(stored.split('$')[1]);

		expect(cost).toBeGreaterThanOrEqual(2 ** 17);
		await expect(hasher.verify('pw', stored)).resolves.toBe(true);
	}, 20_000);
});
