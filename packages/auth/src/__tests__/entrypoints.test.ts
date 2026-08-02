import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { claim, defineAuth } from '../index.js';
import { createAuthServer } from '../server/index.js';
import { createSessionClient } from '../client/index.js';
import { createMemoryAuthStorage } from '../testing/storage.js';
import { createTestClock } from '../testing/index.js';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const collect = async (directory: string): Promise<readonly string[]> => {
	const entries = await readdir(directory, { withFileTypes: true });

	const nested = await Promise.all(
		entries.map(async (entry) => {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) return collect(path);
			return path.endsWith('.ts') ? [path] : [];
		})
	);

	return nested.flat();
};

/** Follows relative imports from an entrypoint to its full source closure. */
const reachableFrom = async (entry: string): Promise<readonly string[]> => {
	const seen = new Set<string>();
	const queue = [entry];

	while (queue.length > 0) {
		const file = queue.pop();
		if (file === undefined || seen.has(file)) continue;
		seen.add(file);

		const source = await readFile(file, 'utf8');
		const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map(
			(match) => match[1] ?? ''
		);

		for (const specifier of specifiers) {
			if (!specifier.startsWith('.')) continue;
			queue.push(resolve(dirname(file), specifier.replace(/\.js$/, '.ts')));
		}
	}

	return [...seen];
};

describe('client bundle purity', () => {
	it('reaches no node: builtin from the client entrypoint', async () => {
		// The concrete failure this prevents: the incumbent library's client
		// session provider drags Node crypto polyfills into the browser build, and
		// every visitor downloads them whether or not the code ever runs. Asserted
		// rather than left to convention, because an accidental import from a
		// shared module is exactly how it happens.
		const files = await reachableFrom(join(SRC, 'client/index.ts'));

		const offenders: string[] = [];
		for (const file of files) {
			const source = await readFile(file, 'utf8');
			if (/from\s+'node:/.test(source)) offenders.push(file);
		}

		expect(offenders).toEqual([]);
	});

	it('reaches no node: builtin from the isomorphic root entrypoint', async () => {
		// The root is imported by the client and by edge runtimes, so it carries
		// the same constraint.
		const files = await reachableFrom(join(SRC, 'index.ts'));

		const offenders: string[] = [];
		for (const file of files) {
			const source = await readFile(file, 'utf8');
			if (/from\s+'node:/.test(source)) offenders.push(file);
		}

		expect(offenders).toEqual([]);
	});
});

describe('source hygiene', () => {
	it('carries the licence header on every source file', async () => {
		const files = await collect(SRC);

		const missing: string[] = [];
		for (const file of files) {
			if (file.includes('__tests__')) continue;
			const source = await readFile(file, 'utf8');
			if (!source.includes('MIT License')) missing.push(file);
		}

		expect(missing).toEqual([]);
	});
});

describe('createAuthServer', () => {
	const config = defineAuth({
		secrets: ['e'.repeat(32)],
		claims: {
			role: claim.enum(['admin', 'member']),
			email: claim.string({ expose: false }),
		},
	});

	const build = () => {
		const clock = createTestClock();
		return {
			clock,
			auth: createAuthServer(config, {
				storage: createMemoryAuthStorage(clock),
				clock,
			}),
		};
	};

	it('signs a user in and resolves the session from the resulting cookie', async () => {
		const { auth } = build();

		const signedIn = await auth.signIn({
			subject: 'u_1',
			claims: { role: 'admin', email: 'a@example.com' },
		});

		expect(signedIn.error).toBeUndefined();
		expect(signedIn.setCookies.length).toBeGreaterThan(0);

		const cookie = signedIn.setCookies
			.map((header) => header.split(';')[0])
			.join('; ');

		const resolved = await auth.fromRequest(
			new Request('https://example.com/', { headers: { cookie } })
		);

		expect(resolved.error).toBeUndefined();
		expect(resolved.session?.subject).toBe('u_1');
		expect(resolved.session?.claims.role).toBe('admin');
	});

	it('defaults to the stateful strategy when storage is supplied', () => {
		const { auth } = build();

		expect(auth.engine.strategy).toBe('stateful');
		expect(auth.engine.supportsRevocation).toBe(true);
	});

	it('falls back to stateless with no storage, and says revocation is unavailable', () => {
		const auth = createAuthServer(config);

		expect(auth.engine.strategy).toBe('stateless');
		expect(auth.engine.supportsRevocation).toBe(false);
	});

	it('clears the session on sign-out', async () => {
		const { auth } = build();

		const signedIn = await auth.signIn({
			subject: 'u_1',
			claims: { role: 'admin', email: 'a@example.com' },
		});
		const cookie = signedIn.setCookies
			.map((header) => header.split(';')[0])
			.join('; ');
		const request = new Request('https://example.com/', {
			headers: { cookie },
		});

		const signedOut = await auth.signOut(request);
		expect(signedOut.setCookies.length).toBeGreaterThan(0);
		signedOut.setCookies.forEach((header) => {
			expect(header).toContain('Max-Age=0');
		});

		const after = await auth.fromRequest(request);
		expect(after.session).toBeUndefined();
	});

	it('reports no session and no error shape confusion for an anonymous request', async () => {
		const { auth } = build();

		const result = await auth.fromRequest(new Request('https://example.com/'));

		expect(result.session).toBeUndefined();
		expect(result.error?._tag).toBe('SessionNotFoundError');
		expect(result.setCookies).toEqual([]);
	});

	it('issues a distinct session id per sign-in', async () => {
		// Session fixation: a sign-in must never adopt an identifier the caller
		// arrived carrying.
		const { auth } = build();

		const first = await auth.signIn({
			subject: 'u_1',
			claims: { role: 'admin', email: 'a@example.com' },
		});
		const second = await auth.signIn({
			subject: 'u_1',
			claims: { role: 'admin', email: 'a@example.com' },
		});

		expect(first.session?.id).not.toBe(second.session?.id);
	});
});

describe('session client', () => {
	it('starts anonymous with no hydrated payload', () => {
		const client = createSessionClient();

		expect(client.current().status).toBe('anonymous');
	});

	it('adopts the hydrated payload without fetching', () => {
		const client = createSessionClient<{
			role: ReturnType<typeof claim.enum<['admin', 'member']>>;
		}>({ status: 'authenticated', claims: { role: 'admin' }, expiresAt: undefined });

		expect(client.current().status).toBe('authenticated');
		expect(client.current().claims?.role).toBe('admin');
	});

	it('notifies every subscriber on publish', () => {
		// The single invalidation channel. Without it, a sign-out updates the
		// server and the UI keeps rendering a signed-in state until a reload.
		const client = createSessionClient();
		const seen: string[] = [];

		client.subscribe((session) => seen.push(session.status));
		client.subscribe((session) => seen.push(session.status));

		client.publish({ status: 'anonymous', claims: undefined, expiresAt: undefined });

		expect(seen).toEqual(['anonymous', 'anonymous']);
	});

	it('stops notifying after unsubscribe', () => {
		const client = createSessionClient();
		let calls = 0;

		const unsubscribe = client.subscribe(() => {
			calls += 1;
		});
		unsubscribe();
		client.publish({ status: 'anonymous', claims: undefined, expiresAt: undefined });

		expect(calls).toBe(0);
	});

	it('survives a listener that unsubscribes during notification', () => {
		// Mutating the listener set mid-iteration would silently skip a peer.
		const client = createSessionClient();
		let secondCalled = false;

		const unsubscribe = client.subscribe(() => unsubscribe());
		client.subscribe(() => {
			secondCalled = true;
		});

		client.publish({ status: 'anonymous', claims: undefined, expiresAt: undefined });

		expect(secondCalled).toBe(true);
	});
});
