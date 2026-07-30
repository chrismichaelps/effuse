import { beforeEach, describe, expect, it } from 'vitest';
import { claim } from '../claims.js';
import { ConfigError } from '../errors.js';
import { createSessionEngine } from '../server/session-engine.js';
import { createTokenCodec } from '../server/token-codec.js';
import {
	createMemorySessionStore,
	createTestClock,
	type MemorySessionStore,
	type TestClock,
} from '../testing/index.js';
import type { SessionStrategy } from '../server/session-engine.js';

const SECRET = 's'.repeat(32);

const shape = {
	role: claim.enum(['admin', 'member']),
	email: claim.string({ expose: false }),
};

const IDLE_TTL = 30 * 60_000;
const ABSOLUTE_TTL = 8 * 60 * 60_000;
const OVERLAP = 10_000;

const build = (strategy: SessionStrategy, clock: TestClock, store: MemorySessionStore) =>
	createSessionEngine({
		strategy,
		claims: shape,
		codec: createTokenCodec({ secrets: [SECRET] }),
		clock,
		store,
		idleTtlMs: IDLE_TTL,
		absoluteTtlMs: ABSOLUTE_TTL,
		rotationOverlapMs: OVERLAP,
	});

// Both strategies are held to exactly the same behavioural contract. Switching
// between them is meant to be a configuration change, and that is only true if
// one suite governs both.
describe.each<SessionStrategy>(['stateless', 'stateful'])(
	'session engine (%s)',
	(strategy) => {
		let clock: TestClock;
		let store: MemorySessionStore;
		let engine: ReturnType<typeof build>;

		beforeEach(() => {
			clock = createTestClock();
			store = createMemorySessionStore(clock);
			engine = build(strategy, clock, store);
		});

		const issue = () =>
			engine.issue({
				subject: 'u_1',
				claims: { role: 'admin', email: 'a@example.com' },
			});

		describe('issue and read', () => {
			it('round-trips a session with its typed claims intact', async () => {
				const { token } = await issue();
				const result = await engine.read(token);

				expect(result.ok).toBe(true);
				if (!result.ok) return;
				expect(result.session.subject).toBe('u_1');
				expect(result.session.claims).toEqual({
					role: 'admin',
					email: 'a@example.com',
				});
			});

			it('mints a high-entropy identifier that is not derived from the subject', async () => {
				// A guessable session id makes every other control irrelevant.
				const first = await issue();
				const second = await issue();

				expect(first.session.id).not.toBe(second.session.id);
				expect(first.session.id.length).toBeGreaterThanOrEqual(32);
				expect(first.session.id).not.toContain('u_1');
			});

			it('reports no session for an absent token', async () => {
				const result = await engine.read(undefined);

				expect(result.ok).toBe(false);
				if (result.ok) return;
				expect(result.error._tag).toBe('SessionNotFoundError');
			});
		});

		describe('forgery and tampering', () => {
			it('rejects a token whose signature does not verify', async () => {
				const { token } = await issue();
				const result = await engine.read(`${token}tampered`);

				expect(result.ok).toBe(false);
				if (result.ok) return;
				expect(result.error._tag).toBe('TokenSignatureMismatchError');
			});

			it('rejects a validly signed token whose claims violate the declared shape', async () => {
				// Signed by us, so the signature passes — but a claim set that does
				// not match the declaration must never be handed to a policy that
				// will index into it.
				const codec = createTokenCodec({ secrets: [SECRET] });
				const forged = await codec.sign({
					sid: 'x'.repeat(43),
					sub: 'u_1',
					iat: clock.now(),
					lsa: clock.now(),
					aex: clock.now() + ABSOLUTE_TTL,
					claims: { role: 'superadmin', email: 'a@example.com' },
				});

				const result = await engine.read(forged);

				expect(result.ok).toBe(false);
				if (result.ok) return;
				expect(['InvalidTokenError', 'SessionNotFoundError']).toContain(
					result.error._tag
				);
			});
		});

		describe('expiry', () => {
			it('expires a session left idle past the idle window', async () => {
				const { token } = await issue();

				clock.advance(IDLE_TTL + 1);
				const result = await engine.read(token);

				expect(result.ok).toBe(false);
				if (result.ok) return;
				expect(result.error._tag).toBe('SessionExpiredError');
			});

			it('keeps a session alive while it is being used', async () => {
				let { token } = await issue();

				for (let i = 0; i < 5; i += 1) {
					clock.advance(IDLE_TTL - 1000);
					const result = await engine.read(token);
					expect(result.ok).toBe(true);
					if (!result.ok) return;
					if (result.renewedToken !== undefined) token = result.renewedToken;
				}
			});

			it('enforces the absolute lifetime regardless of activity', async () => {
				// This is the control that bounds a stolen session. If activity could
				// extend it, a token exfiltrated once would be valid forever.
				let { token } = await issue();

				for (let i = 0; i < 40; i += 1) {
					clock.advance(IDLE_TTL - 1000);
					const result = await engine.read(token);
					if (!result.ok) {
						expect(result.error._tag).toBe('SessionExpiredError');
						expect(clock.now()).toBeGreaterThan(ABSOLUTE_TTL);
						return;
					}
					if (result.renewedToken !== undefined) token = result.renewedToken;
				}

				expect.unreachable('absolute expiry never fired');
			});

			it('does not extend absolute expiry across a rotation', async () => {
				const first = await issue();
				clock.advance(60_000);
				const rotated = await engine.rotate(first.token);

				expect(rotated.ok).toBe(true);
				if (!rotated.ok) return;
				expect(rotated.session.absoluteExpiresAt).toBe(
					first.session.absoluteExpiresAt
				);
			});
		});

		describe('session fixation', () => {
			it('issues a new identifier on rotation and abandons the old one', async () => {
				// The mitigation: an identifier an attacker planted before sign-in
				// must not survive the privilege change.
				const before = await issue();
				const after = await engine.rotate(before.token);

				expect(after.ok).toBe(true);
				if (!after.ok) return;
				expect(after.session.id).not.toBe(before.session.id);
				expect(after.token).not.toBe(before.token);
			});

			it('preserves subject and claims across rotation unless overridden', async () => {
				const before = await issue();
				const after = await engine.rotate(before.token, {
					claims: { role: 'member', email: 'a@example.com' },
				});

				expect(after.ok).toBe(true);
				if (!after.ok) return;
				expect(after.session.subject).toBe('u_1');
				expect(after.session.claims.role).toBe('member');
			});
		});

		describe('rotation races', () => {
			it('resolves the superseded token to the successor inside the overlap window', async () => {
				// A request already in flight when rotation happens must not be signed
				// out. Both tokens are briefly valid and converge on one session.
				const before = await issue();
				const after = await engine.rotate(before.token);
				expect(after.ok).toBe(true);
				if (!after.ok) return;

				clock.advance(OVERLAP - 1);
				const stale = await engine.read(before.token);

				expect(stale.ok).toBe(true);
				if (!stale.ok) return;
				expect(stale.session.id).toBe(after.session.id);
				// The caller is told to re-set the cookie so the race closes.
				expect(stale.renewedToken).toBeDefined();
			});

			it('rejects the superseded token once the overlap window closes', async () => {
				const before = await issue();
				await engine.rotate(before.token);

				clock.advance(OVERLAP + 1);
				const stale = await engine.read(before.token);

				expect(stale.ok).toBe(false);
				if (stale.ok) return;
				expect(stale.error._tag).toBe('SessionRevokedError');
			});

			it('converges when two rotations run concurrently', async () => {
				// Real concurrency, not a mocked sequence. Both callers must end up
				// holding a token that reads back as a valid session.
				const before = await issue();

				const [a, b] = await Promise.all([
					engine.rotate(before.token),
					engine.rotate(before.token),
				]);

				expect(a.ok).toBe(true);
				expect(b.ok).toBe(true);
				if (!a.ok || !b.ok) return;

				const readA = await engine.read(a.token);
				const readB = await engine.read(b.token);

				expect(readA.ok).toBe(true);
				expect(readB.ok).toBe(true);
			});
		});

		describe('revocation', () => {
			it('rejects a destroyed session immediately', async () => {
				const { token } = await issue();
				await engine.destroy(token);

				const result = await engine.read(token);

				expect(result.ok).toBe(false);
				if (result.ok) return;
				expect(['SessionRevokedError', 'SessionNotFoundError']).toContain(
					result.error._tag
				);
			});

			it('destroys every session belonging to a subject', async () => {
				// Used on password change. Leaving sibling sessions alive is how a
				// compromised account stays compromised after the user reacts to it.
				const first = await issue();
				const second = await issue();

				const removed = await engine.destroyForSubject('u_1');
				expect(removed).toBeGreaterThanOrEqual(2);

				expect((await engine.read(first.token)).ok).toBe(false);
				expect((await engine.read(second.token)).ok).toBe(false);
			});

			it('leaves other subjects untouched', async () => {
				const mine = await issue();
				const theirs = await engine.issue({
					subject: 'u_2',
					claims: { role: 'member', email: 'b@example.com' },
				});

				await engine.destroyForSubject('u_1');

				expect((await engine.read(mine.token)).ok).toBe(false);
				expect((await engine.read(theirs.token)).ok).toBe(true);
			});
		});
	}
);

describe('configuration', () => {
	it('refuses a stateful engine with no store', () => {
		expect(() =>
			createSessionEngine({
				strategy: 'stateful',
				claims: shape,
				codec: createTokenCodec({ secrets: [SECRET] }),
				clock: createTestClock(),
				idleTtlMs: IDLE_TTL,
				absoluteTtlMs: ABSOLUTE_TTL,
			})
		).toThrow(ConfigError);
	});

	it('refuses an idle window longer than the absolute lifetime', () => {
		// A configuration in which idle expiry can never fire is almost certainly
		// a mistake, and one that silently removes a control.
		expect(() =>
			createSessionEngine({
				strategy: 'stateless',
				claims: shape,
				codec: createTokenCodec({ secrets: [SECRET] }),
				clock: createTestClock(),
				idleTtlMs: ABSOLUTE_TTL + 1,
				absoluteTtlMs: ABSOLUTE_TTL,
			})
		).toThrow(ConfigError);
	});
});

describe('stateless without a store', () => {
	// Supported, and the tradeoff is stated rather than hidden: no store means no
	// server-side revocation, so the only bound on a stolen token is its expiry.
	const engineFor = (clock: TestClock) =>
		createSessionEngine({
			strategy: 'stateless',
			claims: shape,
			codec: createTokenCodec({ secrets: [SECRET] }),
			clock,
			idleTtlMs: IDLE_TTL,
			absoluteTtlMs: ABSOLUTE_TTL,
		});

	it('issues and reads without any backing store', async () => {
		const clock = createTestClock();
		const engine = engineFor(clock);

		const { token } = await engine.issue({
			subject: 'u_1',
			claims: { role: 'admin', email: 'a@example.com' },
		});

		expect((await engine.read(token)).ok).toBe(true);
	});

	it('reports that revocation is unavailable rather than pretending to revoke', async () => {
		const clock = createTestClock();
		const engine = engineFor(clock);

		const { token } = await engine.issue({
			subject: 'u_1',
			claims: { role: 'admin', email: 'a@example.com' },
		});

		expect(engine.supportsRevocation).toBe(false);
		await expect(engine.destroy(token)).resolves.toBe(false);
	});
});
