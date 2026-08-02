import { describe, expect, it } from 'vitest';
import { createTokenCodec } from '../server/token-codec.js';
import { ConfigError } from '../errors.js';

const SECRET_A = 'a'.repeat(32);
const SECRET_B = 'b'.repeat(32);

describe('createTokenCodec', () => {
	it('round-trips a payload', async () => {
		const codec = createTokenCodec({ secrets: [SECRET_A] });
		const token = await codec.sign({ sub: 'u_1', role: 'admin' });

		await expect(codec.verify(token)).resolves.toEqual({
			sub: 'u_1',
			role: 'admin',
		});
	});

	it('produces a distinct token for a distinct payload', async () => {
		const codec = createTokenCodec({ secrets: [SECRET_A] });

		expect(await codec.sign({ sub: 'u_1' })).not.toBe(
			await codec.sign({ sub: 'u_2' })
		);
	});
});

describe('configuration validation', () => {
	it('refuses to construct without a secret', () => {
		// Failing at construction rather than on first request means a
		// misconfigured deploy cannot boot looking healthy and start minting
		// unsigned sessions once traffic arrives.
		expect(() => createTokenCodec({ secrets: [] })).toThrow(ConfigError);
	});

	it('refuses a secret short enough to brute-force', () => {
		expect(() => createTokenCodec({ secrets: ['short'] })).toThrow(ConfigError);
	});

	it('names the offending configuration path', () => {
		try {
			createTokenCodec({ secrets: ['short'] });
			expect.unreachable('expected a ConfigError');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigError);
			expect((error as ConfigError).path).toBe('secrets[0]');
		}
	});
});

describe('forgery resistance', () => {
	it('rejects a token whose payload was edited after signing', async () => {
		const codec = createTokenCodec({ secrets: [SECRET_A] });
		const token = await codec.sign({ sub: 'u_1', role: 'member' });

		const [payload, signature] = token.split('.');
		expect(payload).toBeDefined();
		expect(signature).toBeDefined();

		const tampered = Buffer.from(
			JSON.stringify({ sub: 'u_1', role: 'admin' }),
			'utf8'
		).toString('base64url');

		await expect(codec.verify(`${tampered}.${signature ?? ''}`)).resolves.toBeUndefined();
	});

	it('rejects a token signed with a secret it does not know', async () => {
		const mine = createTokenCodec({ secrets: [SECRET_A] });
		const attacker = createTokenCodec({ secrets: [SECRET_B] });

		const forged = await attacker.sign({ sub: 'u_1', role: 'admin' });

		await expect(mine.verify(forged)).resolves.toBeUndefined();
	});

	it('rejects a token with the signature stripped', async () => {
		// The "alg: none" shape, in miniature. A signature-free token must never
		// be treated as merely unsigned-but-acceptable.
		const codec = createTokenCodec({ secrets: [SECRET_A] });
		const token = await codec.sign({ sub: 'u_1' });
		const [payload] = token.split('.');

		await expect(codec.verify(payload ?? '')).resolves.toBeUndefined();
		await expect(codec.verify(`${payload ?? ''}.`)).resolves.toBeUndefined();
	});

	it('returns undefined rather than throwing on malformed input', async () => {
		// Verification runs on every request against fully attacker-controlled
		// input. A throw here would become an unhandled 500 and a trivial DoS.
		const codec = createTokenCodec({ secrets: [SECRET_A] });

		for (const bad of ['', '.', '..', 'not-a-token', 'a.b.c.d', '%%%.%%%']) {
			await expect(codec.verify(bad)).resolves.toBeUndefined();
		}
	});

	it('rejects a payload that is valid base64 but not a JSON object', async () => {
		const codec = createTokenCodec({ secrets: [SECRET_A] });
		const signOnly = createTokenCodec({ secrets: [SECRET_A] });
		const token = await signOnly.sign({ sub: 'u_1' });
		const signature = token.split('.')[1] ?? '';

		const arrayPayload = Buffer.from('[1,2,3]', 'utf8').toString('base64url');
		await expect(
			codec.verify(`${arrayPayload}.${signature}`)
		).resolves.toBeUndefined();
	});
});

describe('secret rotation', () => {
	it('signs with the first secret and verifies with any', async () => {
		// Rotation without forced sign-out: deploy with the new secret first, and
		// sessions minted under the old one keep working until they expire.
		const before = createTokenCodec({ secrets: [SECRET_A] });
		const during = createTokenCodec({ secrets: [SECRET_B, SECRET_A] });

		const oldToken = await before.sign({ sub: 'u_1' });
		await expect(during.verify(oldToken)).resolves.toEqual({ sub: 'u_1' });

		const newToken = await during.sign({ sub: 'u_1' });
		// The new token is signed with B, so the pre-rotation codec cannot read it.
		await expect(before.verify(newToken)).resolves.toBeUndefined();
	});

	it('stops accepting a secret once it is dropped from the list', async () => {
		const during = createTokenCodec({ secrets: [SECRET_B, SECRET_A] });
		const after = createTokenCodec({ secrets: [SECRET_B] });

		const signedWithA = await createTokenCodec({ secrets: [SECRET_A] }).sign({
			sub: 'u_1',
		});

		await expect(during.verify(signedWithA)).resolves.toEqual({ sub: 'u_1' });
		await expect(after.verify(signedWithA)).resolves.toBeUndefined();
	});
});
