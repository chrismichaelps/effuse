import { describe, expect, it } from 'vitest';
import { claim, defineAuth } from '../index.js';
import { createAuthServer } from '../server/create-auth-server.js';
import { createCredentialsProvider } from '../server/credentials.js';
import { createScryptHasher } from '../server/password-hasher.js';
import {
	createMemoryRateLimiter,
	createMemoryUserStore,
	createTestClock,
	type TestClock,
} from '../testing/index.js';
import { createMemoryAuthStorage } from '../testing/storage.js';
import type { AuthStorage } from '../contract.js';

const SECRET_CURRENT = 'k'.repeat(32);
const SECRET_PREVIOUS = 'j'.repeat(32);

const claims = {
	role: claim.enum(['admin', 'member']),
	displayName: claim.string(),
	email: claim.string({ expose: false }),
};

const config = defineAuth({
	secrets: [SECRET_CURRENT],
	claims,
	session: { idleTtlMs: 30 * 60_000, absoluteTtlMs: 8 * 60 * 60_000 },
});

/** Mimics a browser: keeps a cookie jar and replays it on the next request. */
class FakeBrowser {
	private jar = new Map<string, string>();

	apply(setCookies: readonly string[]): void {
		for (const header of setCookies) {
			const pair = header.split(';')[0] ?? '';
			const separator = pair.indexOf('=');
			if (separator <= 0) continue;

			const name = pair.slice(0, separator);
			const value = pair.slice(separator + 1);

			// Max-Age=0 means the browser drops the cookie. Modelling this is the
			// point: a clear that emits headers but leaves the jar populated would
			// pass a naive test and fail in a real browser.
			if (/Max-Age=0(;|$)/.test(header)) {
				this.jar.delete(name);
				continue;
			}
			this.jar.set(name, value);
		}
	}

	request(url = 'https://app.example.com/'): Request {
		const cookie = [...this.jar.entries()]
			.map(([name, value]) => `${name}=${value}`)
			.join('; ');

		return new Request(url, cookie === '' ? {} : { headers: { cookie } });
	}

	get cookieCount(): number {
		return this.jar.size;
	}

	/** The session token as the server would reassemble it from the jar. */
	token(name = 'effuse.session'): string {
		const chunks = [...this.jar.keys()]
			.filter((key) => new RegExp(`^(__Host-)?${name.replace(/\./g, '\\.')}\\.\\d+$`).test(key))
			.sort((a, b) => Number(a.split('.').pop()) - Number(b.split('.').pop()));

		if (chunks.length > 0) {
			return chunks
				.map((key) => decodeURIComponent(this.jar.get(key) ?? ''))
				.join('');
		}

		return decodeURIComponent(
			this.jar.get(`__Host-${name}`) ?? this.jar.get(name) ?? ''
		);
	}
}

const build = (storage?: AuthStorage, clock?: TestClock) => {
	const activeClock = clock ?? createTestClock();
	const activeStorage = storage ?? createMemoryAuthStorage(activeClock);

	return {
		clock: activeClock,
		storage: activeStorage,
		auth: createAuthServer(config, { storage: activeStorage, clock: activeClock }),
	};
};

describe('a normal browsing session', () => {
	it('signs in, serves many authenticated requests, then signs out', async () => {
		const { auth, clock } = build();
		const browser = new FakeBrowser();

		const signedIn = await auth.signIn({
			subject: 'u_1',
			claims: { role: 'admin', displayName: 'Ada', email: 'ada@example.com' },
		});
		browser.apply(signedIn.setCookies);

		// Browse for six hours, a request every twenty minutes — inside the idle
		// window but well past it in aggregate.
		for (let i = 0; i < 18; i += 1) {
			clock.advance(20 * 60_000);

			const result = await auth.fromRequest(browser.request());
			expect(result.error).toBeUndefined();
			expect(result.session?.claims.displayName).toBe('Ada');

			browser.apply(result.setCookies);
		}

		const signedOut = await auth.signOut(browser.request());
		browser.apply(signedOut.setCookies);

		expect(browser.cookieCount).toBe(0);
		expect((await auth.fromRequest(browser.request())).session).toBeUndefined();
	});

	it('expires a session left idle overnight', async () => {
		const { auth, clock } = build();
		const browser = new FakeBrowser();

		const signedIn = await auth.signIn({
			subject: 'u_1',
			claims: { role: 'admin', displayName: 'Ada', email: 'ada@example.com' },
		});
		browser.apply(signedIn.setCookies);

		clock.advance(10 * 60 * 60_000);

		const result = await auth.fromRequest(browser.request());
		expect(result.session).toBeUndefined();
		expect(result.error?._tag).toBe('SessionExpiredError');
	});

	it('ends a session at the absolute lifetime even under constant use', async () => {
		// The control that bounds a stolen token: no amount of activity extends it.
		const { auth, clock } = build();
		const browser = new FakeBrowser();

		const signedIn = await auth.signIn({
			subject: 'u_1',
			claims: { role: 'admin', displayName: 'Ada', email: 'ada@example.com' },
		});
		browser.apply(signedIn.setCookies);

		let lastOk = 0;
		for (let i = 0; i < 60; i += 1) {
			clock.advance(20 * 60_000);
			const result = await auth.fromRequest(browser.request());

			if (result.session === undefined) {
				expect(result.error?._tag).toBe('SessionExpiredError');
				expect(lastOk).toBeGreaterThan(0);
				return;
			}

			lastOk = clock.now();
			browser.apply(result.setCookies);
		}

		expect.unreachable('absolute lifetime never enforced');
	});
});

describe('multiple devices', () => {
	it('keeps a phone signed in when the laptop signs out', async () => {
		const { auth } = build();
		const laptop = new FakeBrowser();
		const phone = new FakeBrowser();

		const user = {
			subject: 'u_1',
			claims: {
				role: 'admin' as const,
				displayName: 'Ada',
				email: 'ada@example.com',
			},
		};

		laptop.apply((await auth.signIn(user)).setCookies);
		phone.apply((await auth.signIn(user)).setCookies);

		await auth.signOut(laptop.request());

		expect((await auth.fromRequest(laptop.request())).session).toBeUndefined();
		expect((await auth.fromRequest(phone.request())).session?.subject).toBe('u_1');
	});

	it('signs every device out at once when the password changes', async () => {
		const { auth } = build();
		const devices = [new FakeBrowser(), new FakeBrowser(), new FakeBrowser()];

		for (const device of devices) {
			const signedIn = await auth.signIn({
				subject: 'u_1',
				claims: { role: 'admin', displayName: 'Ada', email: 'ada@example.com' },
			});
			device.apply(signedIn.setCookies);
		}

		// Leaving sibling sessions alive is how a compromised account stays
		// compromised after the user reacts to the compromise.
		expect(await auth.signOutEverywhere('u_1')).toBe(3);

		for (const device of devices) {
			expect((await auth.fromRequest(device.request())).session).toBeUndefined();
		}
	});

	it('does not sign out a different user', async () => {
		const { auth } = build();
		const mine = new FakeBrowser();
		const theirs = new FakeBrowser();

		mine.apply(
			(
				await auth.signIn({
					subject: 'u_1',
					claims: { role: 'admin', displayName: 'Ada', email: 'a@example.com' },
				})
			).setCookies
		);
		theirs.apply(
			(
				await auth.signIn({
					subject: 'u_2',
					claims: { role: 'member', displayName: 'Bob', email: 'b@example.com' },
				})
			).setCookies
		);

		await auth.signOutEverywhere('u_1');

		expect((await auth.fromRequest(mine.request())).session).toBeUndefined();
		expect((await auth.fromRequest(theirs.request())).session?.subject).toBe('u_2');
	});
});

describe('large sessions', () => {
	// Chunking only bites on the stateless strategy: a stateful token carries an
	// identifier and an expiry, so it stays a few hundred bytes no matter how
	// large the session grows. That is a real advantage of stateful sessions, and
	// it is also why these tests must opt into stateless to exercise the split at
	// all.
	const statelessConfig = defineAuth({
		secrets: [SECRET_CURRENT],
		claims,
		session: { strategy: 'stateless' },
	});

	const buildStateless = () => {
		const clock = createTestClock();
		const storage = createMemoryAuthStorage(clock);
		return {
			clock,
			auth: createAuthServer(statelessConfig, { storage, clock }),
		};
	};

	it('survives a session large enough to need multiple cookies', async () => {
		// Past ~4 KB a browser drops a cookie silently, and the failure looks like
		// a signature problem rather than a size problem.
		const { auth } = buildStateless();
		const browser = new FakeBrowser();

		const signedIn = await auth.signIn({
			subject: 'u_1',
			claims: {
				role: 'admin',
				displayName: 'A'.repeat(9000),
				email: 'ada@example.com',
			},
		});
		browser.apply(signedIn.setCookies);

		expect(signedIn.setCookies.length).toBeGreaterThan(1);

		const result = await auth.fromRequest(browser.request());
		expect(result.session?.claims.displayName).toBe('A'.repeat(9000));
	});

	it('clears every chunk of a large session on sign-out', async () => {
		// A leftover trailing chunk makes every later read fail permanently, and
		// the user cannot fix it without clearing cookies by hand.
		const { auth } = buildStateless();
		const browser = new FakeBrowser();

		browser.apply(
			(
				await auth.signIn({
					subject: 'u_1',
					claims: {
						role: 'admin',
						displayName: 'A'.repeat(9000),
						email: 'ada@example.com',
					},
				})
			).setCookies
		);
		expect(browser.cookieCount).toBeGreaterThan(1);

		browser.apply((await auth.signOut(browser.request())).setCookies);

		expect(browser.cookieCount).toBe(0);
	});
});

describe('secret rotation in production', () => {
	it('keeps existing sessions alive across a rotation deploy', async () => {
		// The deploy sequence this models: prepend the new secret, ship, wait out
		// the session lifetime, then drop the old one. No forced sign-out at any
		// point.
		const clock = createTestClock();
		const storage = createMemoryAuthStorage(clock);
		const browser = new FakeBrowser();

		const before = createAuthServer(
			defineAuth({ secrets: [SECRET_PREVIOUS], claims }),
			{ storage, clock }
		);

		browser.apply(
			(
				await before.signIn({
					subject: 'u_1',
					claims: { role: 'admin', displayName: 'Ada', email: 'a@example.com' },
				})
			).setCookies
		);

		// Deploy: new secret first, old secret retained for verification.
		const during = createAuthServer(
			defineAuth({ secrets: [SECRET_CURRENT, SECRET_PREVIOUS], claims }),
			{ storage, clock }
		);

		const stillValid = await during.fromRequest(browser.request());
		expect(stillValid.session?.subject).toBe('u_1');
	});

	it('invalidates sessions signed with a secret that has been dropped', async () => {
		const clock = createTestClock();
		const storage = createMemoryAuthStorage(clock);
		const browser = new FakeBrowser();

		const before = createAuthServer(
			defineAuth({ secrets: [SECRET_PREVIOUS], claims }),
			{ storage, clock }
		);
		browser.apply(
			(
				await before.signIn({
					subject: 'u_1',
					claims: { role: 'admin', displayName: 'Ada', email: 'a@example.com' },
				})
			).setCookies
		);

		const after = createAuthServer(
			defineAuth({ secrets: [SECRET_CURRENT], claims }),
			{ storage, clock }
		);

		const result = await after.fromRequest(browser.request());
		expect(result.session).toBeUndefined();
		expect(result.error?._tag).toBe('TokenSignatureMismatchError');
	});
});

describe('concurrent requests', () => {
	it('serves parallel requests from one browser consistently', async () => {
		// A page load is many requests at once. All of them must agree.
		const { auth } = build();
		const browser = new FakeBrowser();

		browser.apply(
			(
				await auth.signIn({
					subject: 'u_1',
					claims: { role: 'admin', displayName: 'Ada', email: 'a@example.com' },
				})
			).setCookies
		);

		const results = await Promise.all(
			Array.from({ length: 25 }, async () => auth.fromRequest(browser.request()))
		);

		expect(results.every((result) => result.session?.subject === 'u_1')).toBe(true);
		expect(new Set(results.map((result) => result.session?.id)).size).toBe(1);
	});

	it('does not sign a user out when a rotation races an in-flight request', async () => {
		// The 12-reaction "race condition with cookie altering requests" in the
		// incumbent library, reproduced end to end.
		const { auth } = build();
		const browser = new FakeBrowser();

		browser.apply(
			(
				await auth.signIn({
					subject: 'u_1',
					claims: { role: 'admin', displayName: 'Ada', email: 'a@example.com' },
				})
			).setCookies
		);

		const inFlight = browser.request();

		const rotated = await auth.engine.rotate(browser.token());
		expect(rotated.ok).toBe(true);

		// The request that was already in flight still resolves, and is handed a
		// replacement cookie rather than a 401.
		const stale = await auth.fromRequest(inFlight);
		expect(stale.session?.subject).toBe('u_1');
		expect(stale.setCookies.length).toBeGreaterThan(0);
	});
});

describe('credentials sign-in end to end', () => {
	const hasher = createScryptHasher({
		cost: 2 ** 12,
		blockSize: 8,
		parallelism: 1,
	});

	const setup = async () => {
		const clock = createTestClock();
		const storage = createMemoryAuthStorage(clock);
		const auth = createAuthServer(config, { storage, clock });

		const users = createMemoryUserStore();
		users.seed({
			subject: 'u_1',
			identifier: 'ada@example.com',
			passwordHash: await hasher.hash('a-perfectly-reasonable-passphrase'),
			failedAttempts: 0,
		});

		const credentials = createCredentialsProvider({
			users,
			hasher,
			limiter: createMemoryRateLimiter({ limit: 20, windowMs: 60_000 }, clock),
			clock,
			lockoutThreshold: 5,
			lockoutDurationMs: 15 * 60_000,
		});

		return { auth, clock, credentials, users };
	};

	it('turns a correct password into a working session cookie', async () => {
		// The full flow the incumbent library's credentials provider cannot do
		// cleanly: password in, typed session out, same engine as any other
		// provider, no special-casing.
		const { auth, credentials } = await setup();
		const browser = new FakeBrowser();

		const authenticated = await credentials.authenticate({
			identifier: 'ada@example.com',
			password: 'a-perfectly-reasonable-passphrase',
			clientIp: '203.0.113.10',
		});
		expect(authenticated.ok).toBe(true);
		if (!authenticated.ok) return;

		const signedIn = await auth.signIn({
			subject: authenticated.subject,
			claims: { role: 'admin', displayName: 'Ada', email: 'ada@example.com' },
		});
		browser.apply(signedIn.setCookies);

		const result = await auth.fromRequest(browser.request());
		expect(result.session?.subject).toBe('u_1');
	});

	it('never mints a session for a wrong password', async () => {
		const { credentials } = await setup();

		const result = await credentials.authenticate({
			identifier: 'ada@example.com',
			password: 'wrong',
			clientIp: '203.0.113.10',
		});

		expect(result.ok).toBe(false);
	});

	it('locks out a sustained guessing attack and recovers afterwards', async () => {
		const { clock, credentials } = await setup();

		for (let i = 0; i < 5; i += 1) {
			await credentials.authenticate({
				identifier: 'ada@example.com',
				password: `guess-${String(i)}`,
				clientIp: '203.0.113.66',
			});
		}

		const locked = await credentials.authenticate({
			identifier: 'ada@example.com',
			password: 'a-perfectly-reasonable-passphrase',
			clientIp: '203.0.113.66',
		});
		expect(locked.ok).toBe(false);
		if (locked.ok) return;
		expect(locked.error._tag).toBe('AccountLockedError');

		clock.advance(15 * 60_000 + 1);

		const recovered = await credentials.authenticate({
			identifier: 'ada@example.com',
			password: 'a-perfectly-reasonable-passphrase',
			clientIp: '203.0.113.66',
		});
		expect(recovered.ok).toBe(true);
	});

	it('signs every session out when the password changes', async () => {
		// The two ports are independent, so this is the application wiring the
		// package expects — and it is worth proving the pieces compose.
		const { auth, credentials } = await setup();
		const devices = [new FakeBrowser(), new FakeBrowser()];

		for (const device of devices) {
			device.apply(
				(
					await auth.signIn({
						subject: 'u_1',
						claims: {
							role: 'admin',
							displayName: 'Ada',
							email: 'ada@example.com',
						},
					})
				).setCookies
			);
		}

		const changed = await credentials.changePassword({
			subject: 'u_1',
			newPassword: 'an-entirely-different-passphrase',
		});
		expect(changed.ok).toBe(true);
		await auth.signOutEverywhere('u_1');

		for (const device of devices) {
			expect((await auth.fromRequest(device.request())).session).toBeUndefined();
		}

		// And the old password no longer works.
		const oldPassword = await credentials.authenticate({
			identifier: 'ada@example.com',
			password: 'a-perfectly-reasonable-passphrase',
			clientIp: '203.0.113.10',
		});
		expect(oldPassword.ok).toBe(false);
	});
});

describe('csrf across a real request', () => {
	it('accepts a token minted for the signed-in session and rejects one from another', async () => {
		const { auth } = build();

		const mine = await auth.signIn({
			subject: 'u_1',
			claims: { role: 'admin', displayName: 'Ada', email: 'a@example.com' },
		});
		const theirs = await auth.signIn({
			subject: 'u_2',
			claims: { role: 'member', displayName: 'Bob', email: 'b@example.com' },
		});

		expect(mine.session).toBeDefined();
		expect(theirs.session).toBeDefined();
		if (mine.session === undefined || theirs.session === undefined) return;

		const myToken = await auth.csrf.issue(mine.session.id);

		expect(await auth.csrf.verify(mine.session.id, myToken)).toBe(true);
		// An attacker with a valid token from their own account cannot spend it
		// against a victim's session.
		expect(await auth.csrf.verify(theirs.session.id, myToken)).toBe(false);
	});

	it('challenges state-changing methods only', () => {
		const { auth } = build();

		expect(auth.csrf.requiresCsrf('GET')).toBe(false);
		expect(auth.csrf.requiresCsrf('POST')).toBe(true);
	});
});
