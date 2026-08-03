# Migrating from NextAuth

This is a concept migration, not a rename exercise. Effuse Auth makes session
shape, server boundaries, route coverage, and failure handling explicit.

## Concept map

| NextAuth                                                    | `@effuse/auth`                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `callbacks.jwt` + `callbacks.session` + module augmentation | One claims declaration in `defineAuth`                                               |
| Adapter with roughly fifteen methods                        | Small ports; `SessionStore` over `AuthStorage`, and `UserStore` only for credentials |
| Split `auth.config.ts` / `auth.ts` for edge compatibility   | One config; root, client, and server entrypoints enforce runtime boundaries          |
| Catch-all `/api/auth/[...nextauth]`                         | Explicit Effuse file routes visible in the route manifest                            |
| Hand-written refresh in `callbacks.jwt`                     | Built-in single-flight refresh, rotation, locking, and reuse classification          |
| String or loosely shaped errors                             | `AuthError` discriminated union plus `toSafeResponseInit`                            |
| Repeated role checks inside handlers                        | Typed policies, a central registry, and build-time route coverage                    |

## 1. Replace session callbacks with claims

Move every field currently copied through `jwt` and `session` into one claims
declaration. Mark server-only fields with `expose: false`.

```ts
export const claims = {
	role: claim.enum(['admin', 'member']),
	tenantId: claim.string({ expose: false }),
	displayName: claim.string(),
};

export const config = defineAuth({ secrets: [secret], claims });
```

There is no module augmentation. A field absent from `claims` cannot appear in a
typed session, and a value that fails the runtime decoder is rejected.

## 2. Split the adapter by responsibility

Most OAuth-only applications need only `AuthStorage`. Credentials applications
also provide `UserStore`, `PasswordHasher`, and `RateLimiter`; password changes
add the auth server's session-revocation callback and a durable completion hook.
Custom implementations must run the exported conformance suite for their port.

When upgrading from the subject-only password-change API, add `findBySubject`
and atomic `replacePasswordHash` to `UserStore`, configure `revokeSessions` and
`onPasswordChanged`, and pass `currentPassword` plus `clientIp` on every call.

Plain OAuth providers use `mode: 'oauth'`, explicit HTTPS metadata, and a
server-only `resolveIdentity` function. The built-in `github()` preset performs
the authenticated user and verified-primary-email requests. Because a plain
OAuth response has no ID token, `OAuthTokens.idToken` is optional; OIDC callbacks
still reject a missing or invalid ID token instead of falling back to userinfo.

Do not migrate unused adapter methods. Smaller ports keep session persistence,
identity lookup, password hashing, and rate limiting independently replaceable.

## 3. Keep one config and use runtime entrypoints

- `@effuse/auth` is isomorphic configuration, claims, types, and safe errors.
- `@effuse/auth/client` contains hydration and subscription only.
- `@effuse/auth/server` contains cryptography, providers, policies, and engines.

The client and root import closures are tested to contain no `node:` builtins.
Importing the server entrypoint from a browser module is an application error.

## 4. Replace the catch-all route

Mount sign-in, callback, sign-out, and session endpoints as ordinary Effuse file
routes. This keeps each method visible to generated manifests and middleware.
See [Secure getting started](./getting-started.md) for complete handlers.

Carry every returned `setCookies` value with `appendAuthCookies`. This includes
OAuth state cleanup, sign-in, sign-out, idle-window renewal, and rotation-race
convergence.

## 5. Replace refresh callbacks

Create one `TokenRefresher` per provider. Persist the callback tokens with
`remember`, then call `getAccessToken(sessionId)` before provider API calls.
Concurrent calls collapse in-process and across replicas. Do not retain the old
callback refresh code beside it; two refresh owners recreate the race.

## 6. Map failures exhaustively

Branch on `error._tag` for server decisions. Use `toSafeResponseInit(error)` at
the wire boundary. It deliberately excludes backend details, provider payloads,
and internal policy names.

Treat newly added `AuthError` members as compiler work: an exhaustive switch
should fail to build until the application chooses a policy for the new case.

## 7. Compile authorization into policy coverage

Move route-local role comparisons into `createPolicies` and
`createPolicyRegistry`. Add an explicit `public()` rule for every public route,
then run `assertPolicyCoverage` against the generated manifest in CI.

Overlapping policies combine with AND. A more permissive child route requires
`override: true`, making access widening visible in review.

## Cutover order

1. Declare claims and make the new auth package typecheck without serving traffic.
2. Implement storage ports and pass their conformance suites.
3. Mount new routes under a temporary prefix and test OAuth/credentials end to end.
4. Add policies and make route coverage pass before switching traffic.
5. Replace client session reads with SSR hydration and the single client channel.
6. Invalidate existing NextAuth cookies at cutover; they are not Effuse sessions.
7. Remove the old callbacks, refresh owner, catch-all route, and module augmentation.

## Behaviour changes to review

- Account linking is never automatic. Unverified email linking is an
  account-takeover vector.
- 401 and 403 remain distinct; signing in again cannot fix a 403.
- Client session state controls presentation only. Server policies authorize.
- Stateful sessions are the default when storage exists; stateless sessions
  without a store cannot be revoked before expiry.
- Plain OAuth providers without an ID token are not supported yet. GitHub is the
  common example; use an OIDC provider during migration.
