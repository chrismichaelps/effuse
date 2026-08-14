import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createPkcePair, verifyPkce } from '../server/oauth/pkce.js';

describe('createPkcePair', () => {
	it('derives the challenge as base64url(sha256(verifier))', async () => {
		const pair = await createPkcePair();

		const expected = createHash('sha256')
			.update(pair.verifier)
			.digest('base64url');

		expect(pair.challenge).toBe(expected);
		expect(pair.method).toBe('S256');
	});

	it('produces a verifier inside the RFC 7636 length bounds', async () => {
		// 43–128 characters. Shorter is guessable; longer is rejected by
		// conforming providers, which turns into an opaque sign-in failure.
		const pair = await createPkcePair();

		expect(pair.verifier.length).toBeGreaterThanOrEqual(43);
		expect(pair.verifier.length).toBeLessThanOrEqual(128);
	});

	it('uses only the unreserved characters the spec permits', async () => {
		const pair = await createPkcePair();

		expect(pair.verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
	});

	it('produces a distinct verifier every time', async () => {
		// A reused verifier defeats the entire mechanism: an attacker who captured
		// one authorization code could redeem the next.
		const pairs = await Promise.all(
			Array.from({ length: 25 }, async () => createPkcePair())
		);

		expect(new Set(pairs.map((pair) => pair.verifier)).size).toBe(25);
	});
});

describe('verifyPkce', () => {
	it('accepts the verifier that produced the challenge', async () => {
		const pair = await createPkcePair();

		expect(await verifyPkce(pair.verifier, pair.challenge, 'S256')).toBe(true);
	});

	it('rejects a verifier from a different pair', async () => {
		const mine = await createPkcePair();
		const other = await createPkcePair();

		expect(await verifyPkce(other.verifier, mine.challenge, 'S256')).toBe(false);
	});

	it('rejects the "plain" method outright', async () => {
		// Authorization-code interception is exactly what PKCE exists to stop, and
		// `plain` sends the secret in the same channel as the code — which is no
		// protection at all. Downgrading to it must not be negotiable.
		const pair = await createPkcePair();

		expect(await verifyPkce(pair.verifier, pair.verifier, 'plain')).toBe(
			false
		);
	});

	it('rejects an unknown method rather than defaulting to one', async () => {
		const pair = await createPkcePair();

		for (const method of ['', 'S512', 'none', 'sha256']) {
			expect(
				await verifyPkce(pair.verifier, pair.challenge, method)
			).toBe(false);
		}
	});

	it('rejects an empty or absent verifier', async () => {
		const pair = await createPkcePair();

		expect(await verifyPkce('', pair.challenge, 'S256')).toBe(false);
		expect(await verifyPkce(undefined, pair.challenge, 'S256')).toBe(false);
	});

	it('rejects a verifier outside the permitted length bounds', async () => {
		// A short verifier is brute-forceable offline against a captured challenge.
		const short = 'a'.repeat(42);
		const long = 'a'.repeat(129);

		const challengeFor = (verifier: string): string =>
			createHash('sha256').update(verifier).digest('base64url');

		expect(await verifyPkce(short, challengeFor(short), 'S256')).toBe(false);
		expect(await verifyPkce(long, challengeFor(long), 'S256')).toBe(false);
	});

	it('never throws on hostile input', async () => {
		for (const verifier of ['\0', ' ', 'a'.repeat(100_000), '%%%']) {
			await expect(verifyPkce(verifier, 'challenge', 'S256')).resolves.toBe(false);
		}
	});
});
