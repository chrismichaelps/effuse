/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { claim, type InferClaims } from '../claims.js';
import {
	SESSION_SCRIPT_ID,
	renderSessionHydration,
	renderSessionScript,
	toHydrationPayload,
} from '../server/hydration.js';
import {
	createSessionClient,
	hydrateSessionClient,
	isExpired,
	readHydratedSession,
	type ClientSession,
} from '../client/index.js';
import type { Session } from '../server/session-engine.js';
import type { SessionId } from '../contract.js';

const shape = {
	role: claim.enum(['admin', 'member']),
	displayName: claim.string(),
	// Present on the server, never serialised to the browser.
	email: claim.string({ expose: false }),
	internalTier: claim.number({ expose: false }),
};

type Shape = typeof shape;

const sessionWith = (
	claims: Partial<InferClaims<Shape>> = {}
): Session<Shape> => ({
	id: 'sid_1' as SessionId,
	subject: 'u_secret_internal_id',
	claims: {
		role: 'admin',
		displayName: 'Ada',
		email: 'ada@example.com',
		internalTier: 7,
		...claims,
	} as InferClaims<Shape>,
	createdAt: 1_000,
	lastSeenAt: 2_000,
	absoluteExpiresAt: 9_999_000,
});

/**
 * Puts markup into the jsdom document.
 *
 * `innerHTML` is used deliberately and is the point of the exercise: these
 * tests assert that hostile content embedded by the server cannot escape the
 * payload block, which can only be demonstrated by handing the real HTML parser
 * the real output. Using `textContent` here would parse nothing and the tests
 * would pass without proving anything.
 */
const mount = (html: string): void => {
	document.body.innerHTML = html;
};

describe('payload projection', () => {
	it('includes only claims marked for exposure', () => {
		// The default is to omit. Tokens, hashes, and internal identifiers must not
		// reach a page anyone can view-source.
		const payload = toHydrationPayload(shape, sessionWith());

		expect(payload.claims).toEqual({ role: 'admin', displayName: 'Ada' });
		expect(payload.claims).not.toHaveProperty('email');
		expect(payload.claims).not.toHaveProperty('internalTier');
	});

	it('does not include the subject', () => {
		// An internal user id is not needed to render, and shipping one by default
		// is how identifiers end up in analytics and error reports never scoped to
		// hold them.
		const payload = toHydrationPayload(shape, sessionWith());

		expect(JSON.stringify(payload)).not.toContain('u_secret_internal_id');
	});

	it('reports anonymity without a claims object', () => {
		expect(toHydrationPayload(shape, undefined)).toEqual({
			status: 'anonymous',
		});
	});

	it('carries expiry, which is a timestamp rather than a capability', () => {
		expect(toHydrationPayload(shape, sessionWith()).expiresAt).toBe(9_999_000);
	});
});

describe('script injection', () => {
	// The payload contains user-controlled strings — display names, in practice.
	// Every one of these is a real escape people have shipped.
	const hostile = [
		'</script><script>alert(1)</script>',
		'</SCRIPT><script>alert(1)</script>',
		'</ScRiPt >',
		'<!--<script>',
		'</script >',
		'</script\t>',
		'  ',
		'</script> alert(1)',
		'"><img src=x onerror=alert(1)>',
	];

	it.each(hostile)('cannot break out of the block with %j', (displayName) => {
		const html = renderSessionHydration(
			shape,
			sessionWith({ displayName })
		);

		// The only `<` that survives is the one opening our own tag. Everything
		// from the payload has been escaped to <, which JSON.parse restores
		// but the HTML parser never sees as markup.
		const body = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>'));
		expect(body).not.toContain('<');
	});

	it.each(hostile)('round-trips %j through the browser unchanged', (displayName) => {
		mount(renderSessionHydration(shape, sessionWith({ displayName })));

		const session = readHydratedSession<Shape>();

		expect(session.status).toBe('authenticated');
		// Escaping must be lossless: a display name containing markup is a
		// legitimate value, and mangling it would be a correctness bug even though
		// it fails safe.
		expect(session.claims?.displayName).toBe(displayName);
	});

	it('creates exactly one script element regardless of payload content', () => {
		mount(
			renderSessionHydration(
				shape,
				sessionWith({ displayName: '</script><script>alert(1)</script>' })
			)
		);

		expect(document.querySelectorAll('script')).toHaveLength(1);
	});

	it('emits a non-executable block, so a claim can never become code', () => {
		const html = renderSessionScript(toHydrationPayload(shape, sessionWith()));

		expect(html).toContain('type="application/json"');
		expect(html).not.toContain('window.');
	});

	it('supports a CSP nonce and escapes it', () => {
		const html = renderSessionScript(toHydrationPayload(shape, undefined), {
			nonce: 'abc"onload="alert(1)',
		});

		expect(html).toContain('nonce="abc&quot;onload=&quot;alert(1)"');
	});
});

describe('reading the payload', () => {
	it('adopts the server-rendered session with no fetch', () => {
		// The whole design: the value is already in the page. Fetching it again
		// reopens the window between server and client state.
		mount(renderSessionHydration(shape, sessionWith()));

		const session = readHydratedSession<Shape>();

		expect(session.status).toBe('authenticated');
		expect(session.claims).toEqual({ role: 'admin', displayName: 'Ada' });
	});

	it('matches what the server projected, exactly', () => {
		const server = toHydrationPayload(shape, sessionWith());
		mount(renderSessionHydration(shape, sessionWith()));

		const client = readHydratedSession<Shape>();

		expect(client.claims).toEqual(server.claims);
		expect(client.expiresAt).toBe(server.expiresAt);
	});

	it('reads anonymous when the server rendered anonymous', () => {
		mount(renderSessionHydration(shape, undefined));

		expect(readHydratedSession<Shape>().status).toBe('anonymous');
	});

	it('falls back to anonymous when the element is absent', () => {
		mount('<div>no payload here</div>');

		expect(readHydratedSession<Shape>().status).toBe('anonymous');
	});

	it('falls back to anonymous rather than throwing on malformed JSON', () => {
		// A thrown error during hydration takes the application down before it
		// starts. "Looks signed out" is recoverable by a reload; a blank page is not.
		for (const body of ['{', 'null', '[]', '"a string"', '', '   ', 'undefined']) {
			mount(
				`<script type="application/json" id="${SESSION_SCRIPT_ID}">${body}</script>`
			);

			expect(() => readHydratedSession<Shape>()).not.toThrow();
			expect(readHydratedSession<Shape>().status).toBe('anonymous');
		}
	});

	it('treats a payload with no status as anonymous', () => {
		mount(
			`<script type="application/json" id="${SESSION_SCRIPT_ID}">{"claims":{"role":"admin"}}</script>`
		);

		expect(readHydratedSession<Shape>().status).toBe('anonymous');
	});

	it('returns anonymous when there is no document at all', () => {
		// Server-side imports of the client module must not explode.
		expect(readHydratedSession<Shape>(SESSION_SCRIPT_ID, undefined).status).toBe(
			'anonymous'
		);
	});
});

describe('the invalidation channel', () => {
	it('notifies every subscriber on publish', () => {
		// The fix for "signOut does not reload client-side useSession state": one
		// event, every subscriber, no polling and no reload.
		const client = createSessionClient<Shape>();
		const seen: string[] = [];

		client.subscribe((session) => seen.push(`a:${session.status}`));
		client.subscribe((session) => seen.push(`b:${session.status}`));

		client.publish({
			status: 'authenticated',
			claims: { role: 'admin' },
			expiresAt: undefined,
		});

		expect(seen).toEqual(['a:authenticated', 'b:authenticated']);
	});

	it('updates the snapshot before notifying, so listeners read the new value', () => {
		const client = createSessionClient<Shape>();
		let observed: ClientSession<Shape> | undefined;

		client.subscribe(() => {
			observed = client.current();
		});

		client.publish({
			status: 'authenticated',
			claims: { role: 'member' },
			expiresAt: undefined,
		});

		expect(observed?.status).toBe('authenticated');
	});

	it('clears to anonymous on sign-out with no reload', () => {
		mount(renderSessionHydration(shape, sessionWith()));
		const client = hydrateSessionClient<Shape>();

		expect(client.current().status).toBe('authenticated');

		client.clear();

		expect(client.current().status).toBe('anonymous');
		expect(client.current().claims).toBeUndefined();
	});

	it('stops notifying after unsubscribe', () => {
		const client = createSessionClient<Shape>();
		let calls = 0;

		const unsubscribe = client.subscribe(() => {
			calls += 1;
		});
		unsubscribe();
		client.clear();

		expect(calls).toBe(0);
	});

	it('survives a listener that unsubscribes during notification', () => {
		const client = createSessionClient<Shape>();
		let secondCalled = false;

		const unsubscribe = client.subscribe(() => unsubscribe());
		client.subscribe(() => {
			secondCalled = true;
		});

		client.clear();

		expect(secondCalled).toBe(true);
	});

	it('keeps notifying peers when one listener throws', () => {
		// Half a UI believing the user is still signed in is worse than a
		// swallowed error in one component.
		const client = createSessionClient<Shape>();
		let secondCalled = false;

		client.subscribe(() => {
			throw new Error('boom');
		});
		client.subscribe(() => {
			secondCalled = true;
		});

		expect(() => client.clear()).not.toThrow();
		expect(secondCalled).toBe(true);
	});
});

describe('expiry', () => {
	it('reports an expired session against the server-reported instant', () => {
		mount(renderSessionHydration(shape, sessionWith()));
		const session = readHydratedSession<Shape>();

		expect(isExpired(session, 9_998_999)).toBe(false);
		expect(isExpired(session, 9_999_000)).toBe(true);
	});

	it('never reports an anonymous session as expired', () => {
		expect(isExpired({ status: 'anonymous', claims: undefined, expiresAt: undefined })).toBe(
			false
		);
	});
});

describe('what the client is not', () => {
	it('exposes no way to mint or verify a session', () => {
		// Presentational state only. A check that exists here is one an attacker
		// skips by not running the JavaScript.
		const client = createSessionClient<Shape>();

		expect(Object.keys(client).sort()).toEqual([
			'clear',
			'current',
			'publish',
			'subscribe',
		]);
	});
});
