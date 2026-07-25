import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from '../storage.js';
import { runStorageConformance } from '../storage-conformance.js';

// Every adapter must satisfy the same semantics; the memory adapter is the
// reference implementation that proves the suite itself is meaningful.
runStorageConformance(
	'memory',
	() => createMemoryStorage(),
	{ describe, it, expect }
);

describe('createMemoryStorage specifics', () => {
	it('bounds entries with LRU eviction', async () => {
		const storage = createMemoryStorage({ maxEntries: 2 });

		await storage.set('a', 1);
		await storage.set('b', 2);
		await storage.get('a'); // 'b' becomes least recently used
		await storage.set('c', 3);

		expect(await storage.get('a')).toBe(1);
		expect(await storage.get('b')).toBeUndefined();
		expect(await storage.get('c')).toBe(3);
	});

	it('expires a TTL entry using the injected clock', async () => {
		let now = 1_000_000;
		const storage = createMemoryStorage({ now: () => now });

		await storage.set('k', 'v', { ttlMs: 1000 });
		expect(await storage.get('k')).toBe('v');

		now += 1500;
		expect(await storage.get('k')).toBeUndefined();
		expect(await storage.has('k')).toBe(false);
		expect(await storage.keys()).toEqual([]);
	});

	it('isolates a stored value from later caller mutation', async () => {
		const storage = createMemoryStorage();
		const value = { roles: ['user'] };

		await storage.set('u1', value);
		value.roles.push('admin');

        // The store must not observe a mutation made after the write.
		expect(await storage.get<typeof value>('u1')).toEqual({ roles: ['user'] });
	});

	it('isolates a retrieved value from caller mutation', async () => {
		const storage = createMemoryStorage();
		await storage.set('u1', { roles: ['user'] });

		const first = await storage.get<{ roles: string[] }>('u1');
		first?.roles.push('admin');

		expect(await storage.get<{ roles: string[] }>('u1')).toEqual({
			roles: ['user'],
		});
	});
});
