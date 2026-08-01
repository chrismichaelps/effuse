/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Serialising the session into server-rendered HTML.
 *
 * Two of the highest-reaction bugs in the library this package improves on are
 * the same defect wearing different hats: `useSession` only updates after a
 * manual reload, and `signOut` leaves client state stale. Both come from the
 * client maintaining a second, independent session source that can disagree with
 * the server's.
 *
 * The fix is that there is only one source. The server resolves the session once
 * per request and writes it into the page; the client adopts that value rather
 * than fetching one of its own. There is no window in which the two can differ,
 * because there is nothing to differ from.
 *
 * That makes the serialisation boundary security-critical in two ways:
 *
 * - **Only claims marked for exposure are written.** Everything else — tokens,
 *   hashes, internal identifiers — stays on the server. The default is to omit.
 * - **The payload goes into a `<script type="application/json">` block, not a
 *   JavaScript literal.** JSON-in-JavaScript needs `U+2028`/`U+2029` escaping
 *   because they are valid in JSON strings but terminate a JavaScript line, and
 *   getting that wrong is a well-trodden XSS. A non-executable block removes the
 *   whole class: the only sequence that can end it is a closing tag.
 */

import { exposedClaims, type ClaimsShape, type InferClaims } from '../claims.js';
import type { Session } from './session-engine.js';

/** What the browser receives. Deliberately minimal. */
export interface SessionHydrationPayload<Shape extends ClaimsShape> {
	readonly status: 'authenticated' | 'anonymous';
	/** Only the claims declared with `expose` left at its default. */
	readonly claims?: Partial<InferClaims<Shape>>;
	/**
	 * When the session expires, so the client can render a countdown or a
	 * prompt without asking the server.
	 *
	 * Safe to expose: it is a timestamp, not a capability, and the server
	 * enforces expiry regardless of what the client believes.
	 */
	readonly expiresAt?: number;
}

/** The default element id the client reads from. */
export const SESSION_SCRIPT_ID = 'effuse-auth-session';

/**
 * Projects a session into the payload the browser may see.
 *
 * The subject is deliberately absent unless it was declared as a claim. An
 * internal user id is not something a page needs in order to render, and
 * shipping one by default is how identifiers end up in analytics and error
 * reports that were never scoped to hold them.
 */
export const toHydrationPayload = <Shape extends ClaimsShape>(
	shape: Shape,
	session: Session<Shape> | undefined
): SessionHydrationPayload<Shape> => {
	if (session === undefined) return { status: 'anonymous' };

	return {
		status: 'authenticated',
		claims: exposedClaims(shape, session.claims),
		expiresAt: session.absoluteExpiresAt,
	};
};

/**
 * Escapes a JSON string for embedding inside a `<script>` element.
 *
 * Only two sequences matter inside a non-executable block, and both are handled
 * by escaping `<`:
 *
 * - `</script>` in any casing, which would close the element early and let
 *   everything after it be parsed as markup.
 * - `<!--`, which starts an HTML comment and can swallow the rest of the page.
 *
 * `<` is a valid JSON escape for `<`, so the result still parses as the
 * same value — the substitution is invisible to `JSON.parse` and fatal to an
 * injection attempt.
 */
const escapeForScript = (json: string): string => json.replace(/</g, '\\u003C');

export interface RenderSessionScriptOptions {
	/** Element id. Defaults to {@link SESSION_SCRIPT_ID}. */
	readonly id?: string;
	/**
	 * A CSP nonce, emitted as a `nonce` attribute.
	 *
	 * Not required for correctness here — the block is not executable — but
	 * some policies restrict every `<script>` element regardless of type, and
	 * omitting it would have the browser drop the payload.
	 */
	readonly nonce?: string;
}

/**
 * Renders the payload as an inert `<script type="application/json">` element.
 *
 * The type matters. A `application/json` block is data: the browser does not
 * execute it, so a claim value cannot become code no matter what it contains.
 * The alternative — assigning to `window.__SESSION__` — makes every claim a
 * potential script, and then correctness depends on escaping `U+2028`,
 * `U+2029`, and every other sequence that is legal in JSON and meaningful in
 * JavaScript.
 */
export const renderSessionScript = <Shape extends ClaimsShape>(
	payload: SessionHydrationPayload<Shape>,
	options: RenderSessionScriptOptions = {}
): string => {
	const id = options.id ?? SESSION_SCRIPT_ID;
	const json = escapeForScript(JSON.stringify(payload));

	const nonce =
		options.nonce === undefined
			? ''
			: ` nonce="${options.nonce.replace(/"/g, '&quot;')}"`;

	return `<script type="application/json" id="${id}"${nonce}>${json}</script>`;
};

/**
 * Convenience for the common path: session in, script tag out.
 */
export const renderSessionHydration = <Shape extends ClaimsShape>(
	shape: Shape,
	session: Session<Shape> | undefined,
	options: RenderSessionScriptOptions = {}
): string => renderSessionScript(toHydrationPayload(shape, session), options);
