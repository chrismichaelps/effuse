# `@effuse/auth`

Authentication for Effuse. One typed session, swappable ports with conformance
suites, and named mitigations with tests behind each of them.

> **Status:** foundation, session engine, credentials, and OAuth/OIDC have
> shipped. Single-flight refresh and authorization policies are tracked and not
> yet implemented — see [Not yet implemented](#not-yet-implemented). Read
> [SECURITY.md](./SECURITY.md) before deploying.

## Why this exists

The prevailing option in this space has a set of problems that configuration
cannot fix. Its own issue tracker makes the case — the highest-reaction open
issues are all one root cause:

| Reactions | Issue |
| --- | --- |
| 64 | Tokens rotation does not persist the new token |
| 49 | `useSession` only gets the session after manually reloading |
| 27 | Cannot modify JWT to refresh `access_token` |
| 26 | `signOut` does not reload client-side `useSession` state |
| 24 | Session data inconsistency on initial login |
| 12 | Race condition with cookie-altering requests |

Adding one field to a session there means implementing a `jwt` callback,
implementing a `session` callback, and module-augmenting three interfaces in a
separate declaration file. Four edits, none of which the compiler links to the
others.

Here it is one:

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

That single declaration produces the static type, the runtime decoder, and the
rule for what may be sent to the client. There is no `declare module` anywhere in
this package's intended usage — if a type cannot be inferred from `defineAuth`,
that is a bug.

## Getting started

```bash
pnpm add @effuse/auth
```

Generate a secret:

```bash
openssl rand -base64 32
```

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

session.claims.role;        // 'admin' | 'member' — inferred, not asserted
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
import { createOAuthClient, google, createRedirectValidator } from '@effuse/auth/server';

const oauth = createOAuthClient({
  provider: google({ clientId, clientSecret }),
  redirectUri: 'https://app.example.com/auth/callback',
  storage,
  clock: { now: () => Date.now() },
  redirects: createRedirectValidator({ baseUrl: 'https://app.example.com' }),
});

// Begin: apply setCookies to the response, then redirect.
const started = await oauth.start({ redirectTo: '/dashboard' });

// Callback:
const result = await oauth.callback(request);

if (result.ok) {
  result.profile;        // your typed mapper's output
  result.emailVerified;  // do not link accounts without this
  result.redirectTo;     // already validated, safe to redirect to
}
```

PKCE with S256, `state` bound to the browser by cookie, `nonce`, full ID-token
validation, mix-up detection, and open-redirect defence are on by default and
not configurable off. Presets exist for Google, Microsoft, Auth0, Okta, and
Keycloak; `oidc()` covers any conforming provider, and an unlisted provider is
configured exactly as a listed one.

**Account linking is deliberately not automatic.** `emailVerified` is reported
so the decision is yours — linking on an unverified email is the most common
OAuth account-takeover vector.

Plain OAuth 2.0 providers that issue no ID token (GitHub, for instance) are not
supported yet; only OpenID Connect providers work today.

### Email and password

```ts
import {
  createCredentialsProvider,
  createScryptHasher,
} from '@effuse/auth/server';

const credentials = createCredentialsProvider({
  users,   // your UserStore
  hasher: createScryptHasher(),
  limiter, // your RateLimiter
  clock: { now: () => Date.now() },
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
```

Enumeration resistance, per-identifier and per-IP rate limiting, lockout, and
transparent rehashing on cost increases are built in. There is no
"credentials does not support database sessions" caveat — it uses the same engine
as every other provider.

## Session strategies

| | Stateless | Stateful |
| --- | --- | --- |
| Where the session lives | in the signed cookie | in a `SessionStore` |
| Store read per request | no (unless a store is configured) | yes |
| Revocable server-side | only with a store | always |
| Cookie size | grows with claims; chunked past ~4 KB | constant |

Stateful when a store is supplied, stateless otherwise. Set
`session.strategy` explicitly to override. Both satisfy one interface and are
held to one shared behavioural test suite, so switching is a config change.

Running stateless with **no** store means no server-side revocation — the only
bound on a stolen token is its expiry. `engine.supportsRevocation` reports this
rather than letting `destroy` quietly do nothing.

## Entrypoints

| Import | Contains | Safe in a browser bundle |
| --- | --- | --- |
| `@effuse/auth` | types, `claim`, `defineAuth`, errors | yes |
| `@effuse/auth/server` | session engine, providers, everything using `node:crypto` | no |
| `@effuse/auth/client` | session snapshot and subscription | yes |
| `@effuse/auth/testing` | in-memory ports, controllable clock, fake IdP | tests |
| `@effuse/auth/conformance` | executable port conformance suites | tests |

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

```ts
import { createTestClock, createMemorySessionStore } from '@effuse/auth/testing';

const clock = createTestClock();
clock.advance(30 * 60_000); // expiry and lockout tested without sleeping
```

Time control matters more than it sounds: without it every expiry test is slow or
flaky, so in practice they do not get written — and expiry is where auth bugs
hide.

## Not yet implemented

Tracked, not hidden:

- Plain OAuth 2.0 providers with no ID token (GitHub) — OIDC providers are supported today
- Automatic account linking — `emailVerified` is reported; the decision is the application's
- Single-flight token refresh — [#444](https://github.com/chrismichaelps/effuse/issues/444)
- Authorization policies — [#445](https://github.com/chrismichaelps/effuse/issues/445)
- Client bindings and SSR hydration — [#446](https://github.com/chrismichaelps/effuse/issues/446)
- Password reset flows

Until policies ship, authorization is the application's responsibility. Client
session state is presentational only and must never be an enforcement point.

## Security

See [SECURITY.md](./SECURITY.md) for every mitigation, the attack it addresses,
and the test that proves it — plus an explicit list of what this package does
*not* defend against.

## Licence

MIT
