# Secure getting started

This guide mounts explicit Effuse routes. There is no catch-all auth endpoint and
no hidden router. Each route remains visible to the server manifest, policy
audit, middleware graph, and generated types.

## 1. Install

```bash
pnpm add @effuse/auth @effuse/server
```

Create the required environment values:

```bash
AUTH_SECRET="$(openssl rand -base64 32)"
APP_ORIGIN="http://localhost:5173"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

## 2. Declare one session schema

```ts
// src/auth/config.ts
import { claim, defineAuth } from '@effuse/auth';

export const authClaims = {
	role: claim.enum(['admin', 'member']),
	displayName: claim.string(),
	email: claim.string({ expose: false }).optional(),
};

export const authConfig = defineAuth({
	secrets: [process.env.AUTH_SECRET!],
	claims: authClaims,
	cookie: { secure: process.env.NODE_ENV === 'production' },
});
```

The declaration is the static type, runtime decoder, and browser-exposure
policy. It also validates every security-sensitive option during startup:

- Every rotation secret must contain at least 32 characters and be unique.
- Cookie names must be unprefixed HTTP tokens; Effuse owns the `__Host-` prefix.
- Cookie paths must be absolute and cookie domains must be bare ASCII hostnames.
- `hostPrefix: true` requires `secure: true`, `path: '/'`, and no `domain`.

When `hostPrefix` is omitted, Effuse enables it only when those browser rules
are satisfied. A leading dot in a domain is accepted for migration compatibility
and normalized away. `email` can be used by server policies but cannot enter the
hydration payload.

## 3. Assemble the server and policies

```ts
// src/auth/server.ts
import { createMemoryStorage } from '@effuse/server';
import {
	createAuthServer,
	createOAuthClient,
	createPolicies,
	createPolicyGuard,
	createPolicyRegistry,
	createRedirectValidator,
	google,
} from '@effuse/auth/server';
import { authClaims, authConfig } from './config.js';

const storage = createMemoryStorage();

export const auth = createAuthServer(authConfig, { storage });

export const googleAuth = createOAuthClient({
	provider: google({
		clientId: process.env.GOOGLE_CLIENT_ID!,
		clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
	}),
	redirectUri: `${process.env.APP_ORIGIN!}/api/auth/callback`,
	storage,
	clock: { now: () => Date.now() },
	redirects: createRedirectValidator({ baseUrl: process.env.APP_ORIGIN! }),
	secureCookies: process.env.NODE_ENV === 'production',
});

const policy = createPolicies<typeof authClaims>();
export const policies = createPolicyRegistry<typeof authClaims>()
	.protect({ path: '/api/auth/*', policy: policy.public() })
	.protect({ path: '/api/*', policy: policy.authenticated() })
	.protect({ path: '/api/admin/*', policy: policy.claim('role', 'admin') });

export const authGuard = createPolicyGuard({
	registry: policies,
	resolveSession: auth.fromRequest,
});
```

`createMemoryStorage()` makes the first run self-contained. It is process-local
and must be replaced by durable shared storage before using multiple instances
or expecting sessions to survive a restart. Run the matching
`@effuse/auth/conformance` suite against that adapter before deployment.

## 4. Mount sign-in and callback routes

```ts
// src/server/api/auth/sign-in/route.ts
import { defineServerFileHandler } from '@effuse/core';
import { appendAuthCookies, toSafeResponseInit } from '@effuse/auth/server';
import { googleAuth } from '../../../../auth/server.js';

export const GET = defineServerFileHandler('/api/auth/sign-in', async () => {
	const started = await googleAuth.start({ redirectTo: '/dashboard' });
	if (!started.ok) {
		const safe = toSafeResponseInit(started.error);
		return new Response(JSON.stringify(safe.body), safe);
	}

	return appendAuthCookies(
		Response.redirect(started.authorizationUrl, 302),
		started.setCookies
	);
});
```

```ts
// src/server/api/auth/callback/route.ts
import { defineServerFileHandler } from '@effuse/core';
import { appendAuthCookies, toSafeResponseInit } from '@effuse/auth/server';
import { auth, googleAuth } from '../../../../auth/server.js';

export const GET = defineServerFileHandler(
	'/api/auth/callback',
	async ({ request }) => {
		const callback = await googleAuth.callback(request);
		if (!callback.ok) {
			const safe = toSafeResponseInit(callback.error);
			return appendAuthCookies(
				new Response(JSON.stringify(safe.body), safe),
				callback.setCookies
			);
		}

		const signedIn = await auth.signIn({
			subject: `google:${callback.profile.providerAccountId}`,
			claims: {
				role: 'member',
				displayName: callback.profile.name ?? 'Member',
				...(callback.profile.email === undefined
					? {}
					: { email: callback.profile.email }),
			},
		});
		if (signedIn.error) {
			const safe = toSafeResponseInit(signedIn.error);
			return new Response(JSON.stringify(safe.body), safe);
		}

		return appendAuthCookies(
			Response.redirect(new URL(callback.redirectTo, request.url), 302),
			[...callback.setCookies, ...signedIn.setCookies]
		);
	}
);
```

The sample uses the provider-scoped stable subject and does not link accounts by
email. If an application later adds linking, it must require
`callback.emailVerified === true` and an explicit account-linking flow.

## 5. Protect a route

```ts
// src/server/api/admin/report/route.ts
import { defineServerFileHandler } from '@effuse/core';
import { appendAuthCookies } from '@effuse/auth/server';
import { authGuard } from '../../../../auth/server.js';

export const GET = defineServerFileHandler(
	'/api/admin/report',
	async ({ request, response }) => {
		const guarded = await authGuard.protect(request);
		if (guarded.response) {
			return appendAuthCookies(guarded.response, guarded.setCookies);
		}

		return appendAuthCookies(
			response.json({ generatedFor: guarded.session?.claims.displayName }),
			guarded.setCookies
		);
	}
);
```

Never drop `setCookies`: session rotation can succeed on the server while the
browser keeps the superseded token. `appendAuthCookies` preserves repeated
cookie fields and the original response status, body, and headers.

Finally, audit the compiled route manifest during a build or test:

```ts
import { assertPolicyCoverage } from '@effuse/auth/server';
import { policies } from './auth/server.js';
import { serverManifest } from './generated/server-manifest.js';

assertPolicyCoverage(serverManifest, policies);
```

This fails the build if a route or HTTP method has no explicit policy.

## 6. Sign in

Navigate to `/api/auth/sign-in`. Google returns to the explicit callback route,
which validates PKCE, state, nonce, issuer, signature, audience, and redirect
target before issuing the Effuse session.

## 7. Add password recovery

Implement `PasswordResetStore` with atomic replacement and consumption, then
run `runPasswordResetStoreConformance` against the production adapter. Assemble
the service with the same user, session, password-hasher, and rate-limiter ports
used by sign-in:

```ts
import {
	createPasswordResetService,
	createScryptHasher,
} from '@effuse/auth/server';

export const passwordReset = createPasswordResetService({
	store: resetStore,
	users,
	hasher: createScryptHasher(),
	sessions: sessionStore,
	limiter,
	clock: { now: () => Date.now() },
	onCompleted: (event) =>
		securityOutbox.enqueue({
			type: 'password-reset-completed',
			...event,
		}),
});
```

The request endpoint should resolve the identifier, call `issue` only for a
known subject, queue the HTTPS link to the verified recovery address, and always
return the same generic response in comparable time. Never return the token to
the browser. Construct the link from a configured trusted origin, not the Host
header supplied by the request.

The reset page should confirm the new password, send the token and password to
`redeem`, set `Referrer-Policy: no-referrer`, and send the user through normal
sign-in after success. Effuse does not auto-login. A successful redemption
atomically consumes the link, revokes every subject session, preserves failed
authentication counters, and invokes the required completion-notification hook.
The service consumes the capability and revokes sessions before writing the new
credential. If an adapter fails, it fails closed and the user requests another
link instead of retaining a reusable capability. Implement `onCompleted` as a
durable outbox enqueue: it runs after the security state commits, so delivery
failures need operational retry rather than a rollback.

This division follows the
[OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
and [NIST SP 800-63B account recovery](https://pages.nist.gov/800-63-4/sp800-63b.html#account-recovery):
cryptographically random, hashed, single-use, expiring capabilities; throttled
verification; side-channel delivery; uniform account-facing responses; session
invalidation; and a recovery notification.

The complete route setup is also checked into
[`docs/snippets/getting-started.ts`](./snippets/getting-started.ts) and compiled
by the package's `typecheck` command. Runtime behavior is covered by the passing
OAuth flow, policy, entrypoint, HTTP response, and hydration tests. See
[`SECURITY.md`](../SECURITY.md) for the attack-to-test index.
