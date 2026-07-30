# Security model — `@effuse/auth`

Every mitigation below has a regression test that names the attack. Where a
control is absent or partial, this document says so plainly — a security page
that only lists wins is a marketing page.

## What this package defends against

| Attack | Mitigation | Test |
| --- | --- | --- |
| Session fixation | The session identifier is regenerated on every privilege change. `signIn` always mints a fresh id and never adopts one the caller arrived with. | `session-engine.test.ts` → *session fixation*; `entrypoints.test.ts` → *issues a distinct session id per sign-in* |
| Sibling-subdomain cookie overwrite | `__Host-` cookie prefix by default. The browser then enforces `Secure`, `Path=/`, and no `Domain`, so a subdomain cannot overwrite the session cookie. Dropped automatically when a `Domain` makes the cookie ineligible, rather than emitting a cookie the browser will reject. | `cookies.test.ts` → *applies the `__Host-` prefix*, *refuses the prefix when a Domain is set* |
| Token forgery | HMAC-SHA256 with a fixed algorithm. Tokens carry no header, so there is no algorithm field to lie in — this closes `alg: none` and RS256→HS256 confusion by construction. | `token-codec.test.ts` → *forgery resistance* |
| Timing attacks on signature comparison | Both sides are hashed to a fixed width and compared with `timingSafeEqual`. Normalising the length matters: `timingSafeEqual` throws on a length mismatch, and catching that throw would itself be a timing signal. | `token-codec.test.ts`, `csrf.ts` |
| Base64 malleability | The payload must match the strict base64url alphabet and survive a re-encode round-trip. Node's decoder is lenient, and two distinct strings decoding to one payload is a signature-bypass primitive. | `token-codec.test.ts` → *malformed input*, *valid base64 but not a JSON object* |
| Replay after sign-out | Stateful sessions are deleted server-side. Stateless sessions **with a store** are equally revocable: the store is authoritative on liveness, so a missing record means revoked and a destroyed token cannot resurrect itself from its own payload. | `session-engine.test.ts` → *revocation* |
| Cookie rotation races | A rotated-away session is marked superseded rather than deleted. For a bounded overlap window a request still carrying the old token resolves to the successor and is handed a replacement cookie, so concurrent rotations converge instead of signing the user out. | `session-engine.test.ts` → *rotation races* |
| Unbounded session lifetime | Separate idle and absolute timeouts. Absolute expiry is measured from creation, is carried across rotation unchanged, and cannot be extended by activity — so a stolen token has a hard ceiling. | `session-engine.test.ts` → *enforces the absolute lifetime*, *does not extend absolute expiry across a rotation* |
| Oversized-cookie silent loss | Values beyond the ~4 KB browser cap are split into numbered chunks, measured on the percent-encoded byte length rather than character count. | `cookies.test.ts` → *chunking* |
| Stale chunks after a shrink | Clearing is driven by the chunks the request actually carried, not by what the current value would occupy. A leftover trailing chunk would otherwise make every later read fail permanently. | `cookies.test.ts` → *expires every chunk currently present* |
| Cookie shadowing | Duplicate cookie names resolve first-wins. Browsers send the more specific cookie first, so an attacker appending a value from a parent domain does not win. | `cookies.test.ts` → *keeps the first occurrence when a name repeats* |
| CSRF | Signed, session-bound, expiring double-submit token. The session id is inside the signed message, so a token minted under an attacker's own account cannot be spent against a victim. Unsafe methods are an allowlist, so an unrecognised verb is challenged rather than waved through. | `csrf.test.ts` |
| User enumeration | An unknown identifier is verified against a dummy hash produced by the configured hasher, so both paths do the same work. Both return `InvalidCredentialsError` with an identical `safeMessage`. | `credentials.test.ts` → *user enumeration*, including a statistical timing-parity assertion |
| Lockout evasion by identifier casing | Identifiers are normalised and compared case-insensitively, so `A@example.com` cannot bypass a lock on `a@example.com`. | `credentials.test.ts` → *matches the identifier case-insensitively* |
| Brute force | Account lockout after a configurable threshold, reported with `retryAfterMs`. | `credentials.test.ts` → *brute force* |
| Lockout as a denial-of-service tool | Per-identifier and per-IP rate-limit budgets are independent. A shared budget would let an attacker exhaust a victim's allowance from anywhere and lock them out without guessing anything. | `credentials.test.ts` → *keeps per-identifier and per-IP budgets independent* |
| Offline cracking of stolen hashes | scrypt at OWASP's current floor (N=2^17, r=8, p=1) by default, per-hash salt, parameters recorded in the stored hash so cost can be raised later without a migration. | `password-hasher.test.ts` |
| Memory exhaustion via a tampered hash row | Verification takes its work factor from the stored hash, so a ceiling is enforced before any derivation is attempted. | `password-hasher.test.ts` → *rejects parameters large enough to exhaust memory* |
| Foreign or corrupted hashes frozen in place | `needsRehash` returns `true` for anything unparseable, so such records are replaced at the next successful sign-in rather than trusted forever. | `password-hasher.test.ts` → *flags an unparseable hash* |
| Prototype pollution from decoded payloads | `__proto__`, `constructor`, and `prototype` are rejected in claims and cookie names; decoding builds on a null-prototype object and copies only declared keys. | `claims.test.ts` → *rejects prototype-polluting keys*; `cookies.test.ts` → *ignores prototype-polluting cookie names* |
| Claim smuggling | Undeclared keys are dropped rather than passed through, and values are type-checked rather than coerced. | `claims.test.ts` → *drops unknown keys*, *rejects a claim of the wrong type* |
| Denial of service via malformed input | Token verification, cookie parsing, CSRF verification, and password verification all return a failure value instead of throwing. These parse fully attacker-controlled input on every request; a throw would be an unhandled 500. | `token-codec.test.ts`, `cookies.test.ts`, `csrf.test.ts`, `password-hasher.test.ts` |
| Weak secrets | Signing secrets under 32 characters are rejected at construction, not on first request. A deploy that boots healthy and reveals a missing secret only under traffic is discovered by users. | `token-codec.test.ts` → *configuration validation* |
| Forced sign-out on secret rotation | Ordered secret list: the first signs, all verify. Rotation is a two-deploy operation with no session loss. | `token-codec.test.ts` → *secret rotation* |
| Server crypto in the client bundle | `@effuse/auth/client` and the isomorphic root are asserted to reach no `node:` builtin, by walking the actual import closure. | `entrypoints.test.ts` → *client bundle purity* |
| Session data leaking into HTML | Claims are `expose: false` opt-out, and `exposedClaims` is the only projection the hydration path uses. | `claims.test.ts` → *omits claims not marked for exposure* |
| Silent adapter divergence | Every port ships an executable conformance suite covering lock exclusivity under real concurrency, TTL expiry, fencing on release, and value isolation. | `conformance.ts`, exercised in `conformance.test.ts` against both reference implementations |

## What this package does not do yet

These are tracked, not hidden. Do not assume coverage that has not shipped.

- **OAuth and OIDC** are not implemented ([#443](https://github.com/chrismichaelps/effuse/issues/443)). PKCE, `state`, `nonce`, ID-token validation, open-redirect defence, and mix-up protection all land there.
- **Single-flight token refresh** is not implemented ([#444](https://github.com/chrismichaelps/effuse/issues/444)). The `SessionStore` lock primitive it needs exists and is conformance-tested, but nothing uses it yet.
- **Authorization policies** are not implemented ([#445](https://github.com/chrismichaelps/effuse/issues/445)). Until then, authorization is the application's responsibility.
- **Password reset flows** are not implemented. Reset tokens must be single-use, short-lived, stored hashed, and invalidated on password change.
- **Sibling-session revocation on password change** is available as `signOutEverywhere(subject)` but is not called automatically by `changePassword` — the two stores are independent ports and wiring them is the application's call.

## Deliberately strict defaults

Loosen these only with a reason you would defend in review.

| Default | Why it is strict | Cost of loosening |
| --- | --- | --- |
| `cookie.hostPrefix: true` | Stops sibling-subdomain cookie overwrite. | Setting a `Domain` silently drops the prefix and reopens session fixation on a shared apex domain. |
| `cookie.secure: true` | Keeps the session off plaintext transports. | Only disable for local `http` development. |
| `cookie.sameSite: 'lax'` | CSRF defence in depth. | `'none'` requires `Secure` and is rejected at config time otherwise. |
| Minimum 32-character secrets | Below ~128 bits of entropy, a captured token is grindable offline. | Rejected at construction; there is no override. |
| scrypt N=2^17 | OWASP's current floor. | Defaults are what most deployments run, so the default is the recommendation. |
| Password minimum length 12, no composition rules | Length correlates with strength; composition rules push people toward predictable substitutions, which is why current NIST guidance drops them. | — |
| Absolute session lifetime 12 hours | Bounds a stolen token. | Raising it raises the ceiling on undetected use of a stolen session. |

## Reporting

Report vulnerabilities through the process in the repository root
[`SECURITY.md`](../../SECURITY.md). Please do not open a public issue.
