<p align="center">
  <img src="../../public/logo/logo.svg" alt="Effuse" width="150px" />
</p>

# `@effuse/auth`

Authentication for Effuse. One typed session, swappable ports with conformance
suites, and named mitigations with tests behind each of them.

The package includes the session engine, credentials, OAuth/OIDC, single-flight
token refresh, authorization policies, and client/SSR hydration. Start with the
complete [secure setup](./docs/getting-started.md), see the
[NextAuth migration guide](./docs/migrating-from-nextauth.md), and read
[SECURITY.md](./SECURITY.md) before deploying.

## Design Contract

Define claims once. The same declaration drives static inference, runtime
decoding, and client-exposure rules:

```ts
import { claim, defineAuth } from '@effuse/auth';

export const config = defineAuth({
	secrets: [process.env.AUTH_SECRET!],
	claims: {
		role: claim.enum(['admin', 'member']),
		displayName: claim.string(),
		email: claim.string({ expose: false }), // never serialised to the browser
	},
});
```

Application code does not need module augmentation or a second runtime API. If
a claim cannot be inferred from `defineAuth`, treat that as a package defect.

`defineAuth` is also the eager configuration boundary. It rejects every signing
secret shorter than 32 characters, duplicate rotation entries, unsafe cookie
metadata, and impossible `__Host-` combinations before the server accepts
traffic. Cookie domains are lowercase-normalized and may be supplied with a
legacy leading dot; schemes, ports, paths, Unicode hostnames, and malformed DNS
labels are rejected with a path-specific `ConfigError`.

## Getting started

The [secure getting-started guide](./docs/getting-started.md) covers the complete
path: installation, one typed claims declaration, explicit Effuse auth routes,
route policies, OAuth sign-in, cookie propagation, and build-time coverage.

```bash
pnpm add @effuse/auth
```

Generate a secret:

```bash
openssl rand -base64 32
```

Keep rotation secrets distinct and ordered newest first. The first secret signs
new tokens and every later secret verifies existing tokens. Weakness in any
entry compromises the rotation set, so the minimum applies to all of them.

Assemble the server. `storage` is anything with `get`/`set`/`delete`/`namespace`
— including `createMemoryStorage()` from `@effuse/server`, or a ~30-line Redis
wrapper:

```ts
import { createAuthServer } from '@effuse/auth/server';
import { createMemoryStorage } from '@effuse/server';

export const auth = createAuthServer(config, {
	storage: createMemoryStorage(),
});
```

Resolve a session in a request handler. `setCookies` must be applied to the
response — dropping it is what turns a working rotation into an intermittent
sign-out:

```ts
const { session, error, setCookies } = await auth.fromRequest(request);

if (session === undefined) {
	return new Response('Unauthorized', { status: 401 });
}

session.claims.role; // 'admin' | 'member' — inferred, not asserted
session.claims.displayName; // string
```

Sign in and out:

```ts
const { setCookies, session } = await auth.signIn({
	subject: user.id,
	claims: { role: 'admin', displayName: 'Ada', email: 'ada@example.com' },
});

const { setCookies } = await auth.signOut(request);

await auth.signOutEverywhere(user.id); // e.g. after a password change
```

Turning failures into responses — the only sanctioned path to the wire, and the
reason internals cannot leak by accident:

```ts
import { toSafeResponseInit } from '@effuse/auth';

if (error !== undefined) {
	const { status, headers, body } = toSafeResponseInit(error);
	return new Response(JSON.stringify(body), { status, headers });
}
```

### OAuth and OpenID Connect

```ts
import {
	createOAuthClient,
	github,
	google,
	createRedirectValidator,
} from '@effuse/auth/server';

const oauth = createOAuthClient({
	provider: google({ clientId, clientSecret }),
	redirectUri: 'https://app.example.com/auth/callback',
	storage,
	clock: { now: () => Date.now() },
	redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
});

// Plain OAuth providers are explicit and remain entirely server-side.
const githubOAuth = createOAuthClient({
	provider: github({
		clientId: githubClientId,
		clientSecret: githubClientSecret,
	}),
	redirectUri: 'https://app.example.com/auth/github/callback',
	storage,
	clock: { now: () => Date.now() },
	redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
});

// Begin: apply setCookies to the response, then redirect.
const started = await oauth.start({ redirectTo: '/dashboard' });

// Callback:
const result = await oauth.callback(request);

if (result.ok) {
	result.profile; // your typed mapper's output
	result.emailVerified; // do not link accounts without this
	result.redirectTo; // already validated, safe to redirect to
}
```

PKCE with S256, `state` bound to the browser by cookie, mix-up detection, and
open-redirect defence are on by default and not configurable off. OIDC providers
also require `nonce` and full ID-token validation. Presets exist for GitHub,
Google, Microsoft, Auth0, Okta, and Keycloak; `oidc()` covers any conforming OIDC
provider. Plain OAuth providers use an explicit server-only identity resolver and
never become a fallback when an expected OIDC ID token is missing or invalid.

GitHub identity is revalidated through the authenticated `/user` API after every
token exchange. The stable numeric account id becomes `providerAccountId`; only
a primary address carrying GitHub's explicit `verified: true` evidence is exposed
as verified. Token responses and provider payloads are parsed by internal Zod
schemas. Applications consume ordinary Effuse types and do not import Zod.

**Account linking is deliberately not automatic.** `emailVerified` is reported
so the decision is yours — linking on an unverified email is the most common
OAuth account-takeover vector.

### Keeping access tokens fresh

```ts
import { createTokenRefresher } from '@effuse/auth/server';

const refresher = createTokenRefresher({
	tokenEndpoint,
	clientId,
	clientSecret,
	providerId: 'google',
	storage,
	store,
	clock: { now: () => Date.now() },
});

await refresher.remember({ sessionId, subject, ...result.tokens });

// Anywhere you need to call the provider:
const token = await refresher.getAccessToken(sessionId);
```

Concurrent calls for one session collapse into a single upstream redemption —
in-process via a promise map, across replicas via a store-backed lock. That is
the fix for the highest-reaction bug in the incumbent library, where a page
load's worth of parallel requests each redeem the same refresh token, the
provider invalidates it on first use, and the user is silently signed out.

Rotation, a bounded reuse-overlap window, skew-aware early refresh, and a
TTL-bounded lock are all built in.

### Email and password

```ts
import {
	createCredentialsProvider,
	createScryptHasher,
} from '@effuse/auth/server';

const credentials = createCredentialsProvider({
	users, // your UserStore
	hasher: createScryptHasher(),
	limiter, // your RateLimiter
	clock: { now: () => Date.now() },
	revokeSessions: (subject) => auth.signOutEverywhere(subject),
	onPasswordChanged: (event) =>
		securityOutbox.enqueue({
			type: 'password-changed',
			...event,
		}),
});

const result = await credentials.authenticate({
	identifier: 'ada@example.com',
	password,
	clientIp,
});

if (result.ok) {
	const { setCookies } = await auth.signIn({
		subject: result.subject,
		claims: { role: 'admin', displayName: 'Ada', email: 'ada@example.com' },
	});
}

const changed = await credentials.changePassword({
	subject: session.subject,
	currentPassword,
	newPassword,
	clientIp,
});
```

Enumeration resistance, per-identifier and per-IP rate limiting, lockout, and
transparent rehashing on cost increases are built in. There is no
"credentials does not support database sessions" caveat — it uses the same engine
as every other provider. Password change is server-only and requires current
credential reauthentication, independent subject/IP throttling, atomic
compare-and-replace persistence, all-session revocation, and a durable
completion event. A stolen session alone is insufficient.

### Password recovery

Password reset is a server capability backed by an atomic port, not a signed
token helper. That distinction is what makes replacement and single-use
redemption hold across replicas:

```ts
import {
	createPasswordResetService,
	createScryptHasher,
} from '@effuse/auth/server';

const passwordReset = createPasswordResetService({
	store: resetStore, // your PasswordResetStore
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

const issued = await passwordReset.issue({ subject: user.id, clientIp });
if (issued.ok) await emailResetLink(user.email, issued.token);

const redeemed = await passwordReset.redeem({
	token,
	newPassword,
	clientIp,
});
```

The raw 256-bit bearer token is returned once and persistence receives only its
SHA-256 digest. Issuing a replacement atomically revokes the previous link;
redemption is atomic, expires after 15 minutes by default, revokes every active
session, and requires a post-reset security-notification hook. Failed-login
counters remain intact, and the service never signs the user in automatically.
On redemption, Effuse consumes the capability and revokes sessions before
persisting the new credential. Adapter failures therefore fail closed: a link
may become unusable without changing the password, and the user must request a
new one. Make `onCompleted` enqueue into a durable outbox; it runs after the
security state commits and must be safe to retry operationally.

The identifier-facing endpoint stays application-owned. It must return the same
message and comparable timing for known and unknown accounts, enqueue delivery
through a side channel, build HTTPS links from a trusted configured origin, set
`Referrer-Policy: no-referrer` on the reset page, and never expose `issued.token`
in an HTTP response. These requirements follow the
[OWASP Forgot Password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
and [NIST SP 800-63B account-recovery requirements](https://pages.nist.gov/800-63-4/sp800-63b.html#account-recovery).

## Authorization

Policies are values built against the same claims declaration the session uses,
so a typo is a compile error rather than a comparison that is always false:

```ts
import { createPolicies, createPolicyRegistry } from '@effuse/auth/server';

const p = createPolicies<typeof claims>();

const registry = createPolicyRegistry<typeof claims>()
	.protect({ path: '/api/*', policy: p.authenticated() })
	.protect({ path: '/api/admin/*', policy: p.claim('role', 'admin') })
	.protect({ path: '/health', policy: p.public(), override: true });
```

Overlapping rules combine with **AND**, so adding a rule can only ever narrow
access. Making one route more permissive than its prefix needs an explicit
`override: true` — a silent widening is one nobody reviewed.

Then guard requests, and audit the whole surface:

```ts
import { createPolicyGuard, assertPolicyCoverage } from '@effuse/auth/server';

const guard = createPolicyGuard({ registry, resolveSession: auth.fromRequest });

const { response, session } = await guard.protect(request);
if (response) return response;

// In a test or build step — fails on any route with no declared policy:
assertPolicyCoverage(manifest, registry);
```

`assertPolicyCoverage` is the setting that turns a forgotten check from an
incident into a failed CI run. Scattered `if (session.user.role !== 'admin')`
conditionals cannot be audited at all: there is no list of routes to compare
against, so a missing check is invisible until someone exploits it.

## Client and SSR hydration

The server resolves the session once and writes it into the page; the client
adopts that value. It never fetches one of its own, which is what removes the
window where the two can disagree.

```ts
// Server, while rendering:
import { renderSessionHydration } from '@effuse/auth/server';
const scriptTag = renderSessionHydration(config.claims, session);

// Client, at start-up:
import { hydrateSessionClient } from '@effuse/auth/client';
const sessionClient = hydrateSessionClient<typeof claims>();

sessionClient.current(); // synchronous — hydrated, not fetched
sessionClient.subscribe(render); // one channel, every subscriber
sessionClient.clear(); // after sign-out, no reload needed
```

Only claims left at the exposure default are serialised; `expose: false` claims
and the subject never reach the browser. The payload is an inert
`<script type="application/json">` block rather than a `window.__SESSION__`
assignment, so a display name containing `</script>` cannot become code.

**Client state is presentational.** It decides what to render, never what to
permit — a check that exists only there is one an attacker skips by not running
your JavaScript.

## Session strategies

|                         | Stateless                             | Stateful            |
| ----------------------- | ------------------------------------- | ------------------- |
| Where the session lives | in the signed cookie                  | in a `SessionStore` |
| Store read per request  | no (unless a store is configured)     | yes                 |
| Revocable server-side   | only with a store                     | always              |
| Cookie size             | grows with claims; chunked past ~4 KB | constant            |

Stateful when a store is supplied, stateless otherwise. Set
`session.strategy` explicitly to override. Both satisfy one interface and are
held to one shared behavioural test suite, so switching is a config change.

Running stateless with **no** store means no server-side revocation — the only
bound on a stolen token is its expiry. `engine.supportsRevocation` reports this
rather than letting `destroy` quietly do nothing.

## Entrypoints

| Import                     | Contains                                                  | Safe in a browser bundle |
| -------------------------- | --------------------------------------------------------- | ------------------------ |
| `@effuse/auth`             | types, `claim`, `defineAuth`, errors                      | yes                      |
| `@effuse/auth/server`      | session engine, providers, everything using `node:crypto` | no                       |
| `@effuse/auth/client`      | session snapshot, hydration, subscription                 | yes                      |
| `@effuse/auth/testing`     | in-memory ports, controllable clock, fake IdP             | tests                    |
| `@effuse/auth/conformance` | executable port conformance suites                        | tests                    |

The split is enforced by a test that walks the actual import closure, not by
convention.

## Ports

Several small interfaces rather than one ~15-method adapter, so a backend is a
detail rather than an application-wide commitment:

`AuthStorage` · `SessionStore` · `UserStore` · `PasswordHasher` · `TokenCodec` ·
`RateLimiter` · `Clock`

Most applications implement none of them. Every port has an in-memory reference
implementation and an executable conformance suite:

```ts
import { runSessionStoreConformance } from '@effuse/auth/conformance';

runSessionStoreConformance({
	harness: { describe, it, expect },
	createStore: () => createRedisSessionStore(client),
});
```

The suite covers the properties that are easy to get subtly wrong and impossible
to notice until production: lock exclusivity under real concurrency, TTL expiry,
fencing on release, and isolation of stored values from later mutation. It
already caught one such bug in this package's own reference implementation.

## Testing your app

Testing an authenticated route should be three lines, not a sign-in flow:

```ts
import { createTestSession } from '@effuse/auth/testing';

const signedIn = await createTestSession({
	claims: appClaims,
	values: { role: 'admin', displayName: 'Ada', email: 'ada@example.com' },
});

const response = await handler(signedIn.request('/api/admin'));
```

**Nothing is faked.** `createTestSession` builds a real engine with a real codec
and issues a real signed token, so the cookie it returns is accepted by the
production path because it is genuinely valid — proven by a test that reads it
back through an independently constructed server.

It also hands back `clock`, `storage`, `auth`, the raw `token`, and the
`setCookies` headers, so expiry, revocation, and rotation are all drivable:

```ts
const { clock } = signedIn;
clock.advance(31 * 60_000); // no sleeping, no flake
await signedIn.auth.signOutEverywhere('test-subject');
```

Time control matters more than it sounds: without it every expiry test is slow or
flaky, so in practice they do not get written — and expiry is where auth bugs
hide.

For OAuth, `createFakeIdp()` generates a real RSA keypair, signs genuine tokens,
serves discovery and JWKS, and its token endpoint actually verifies the PKCE
challenge — so a green flow test is evidence your client sent the right verifier,
not merely that it sent something. It also mints deliberately wrong tokens
(foreign key, `alg: none`, wrong issuer, bad nonce) so hostile cases are
generated rather than hand-written.

## Writing a backend

Implementing a port? Run its conformance suite and find out whether you got it
right:

```ts
import {
	runSessionStoreConformance,
	runRateLimiterConformance,
	runPasswordHasherConformance,
	runTokenCodecConformance,
	runUserStoreConformance,
} from '@effuse/auth/conformance';

runSessionStoreConformance({
	harness: { describe, it, expect },
	createStore: () => createRedisSessionStore(client),
	advanceTime: (ms) => clock.advance(ms), // omit to skip the TTL cases
});
```

The harness is a minimal `{ describe, it, expect }` surface, so the suites run
under vitest, jest, or `node:test` without adopting this repo's runner.

They cover the properties that are easy to get subtly wrong and impossible to
notice until production: lock exclusivity under real concurrency, TTL that
actually expires, fencing on release, value isolation from later mutation,
independent rate-limit budgets per scope, salting, and `verify` returning `false`
rather than throwing on a foreign hash.

Every reference implementation in `@effuse/auth/testing` passes the same suites —
a suite the reference cannot satisfy is one nobody should be asked to satisfy.

## Mutation testing

The package carries a bounded mutation gate for the boot-time configuration
contract. Run it from the repository root with:

```bash
pnpm --filter @effuse/auth test:mutation
```

The gate mutates `src/config.ts`, credentials and password-reset services, the
plain-OAuth token/identity decision range, the GitHub identity resolver, and the
OAuth boundary utilities. It runs related Vitest coverage per test and requires
every non-equivalent mutant to be killed. Zod schema declarations are covered by
direct malformed-payload matrices instead of static initialization mutants.
Reports are written to
`packages/auth/reports/mutation/` and intentionally ignored by Git. The narrow
scope keeps the command practical for pull requests; broader security and
protocol behavior remains covered by the full regression, adversarial,
conformance, and lifecycle suites.

## Responsibility Boundaries

- Account linking is an application policy. Effuse reports `emailVerified` but
  never links identities automatically from an unverified email.
- Client session state is presentational only. Authorization is enforced from a
  server-resolved session or policy decision.
- Production deployments provide durable session, rate-limit, and lock ports;
  memory adapters are intended for development and deterministic tests.
- Cookie mutations returned by request resolution must be applied to the final
  response, including rotation and sign-out paths.

## Security

See [SECURITY.md](./SECURITY.md) for every mitigation, the attack it addresses,
and the test that proves it — plus an explicit list of what this package does
_not_ defend against.

## Licence

MIT
