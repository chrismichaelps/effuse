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

import { Predicate } from 'effect';
import type { HeadProps } from './types.js';
import { HYDRATION_SCRIPT_ID } from '../constants.js';

export { HYDRATION_SCRIPT_ID };

export interface HydrationData {
	head: HeadProps;
	state: Record<string, unknown>;
	url: string;
	timestamp: number;
}

/**
 * Serialize hydration data into a script tag for embedding in SSR output.
 *
 * This is now called by `renderToString` with real layer state,
 * ensuring the client receives the full hydration payload.
 */
export const serializeHydrationData = (data: HydrationData): string => {
	const json = JSON.stringify(data);
	// Escape '<' to \u003c to prevent ANY HTML break-out sequences
	// (</script, <!--, <!CDATA[, etc.) from being interpreted by the parser.
	const escaped = json.replace(/</g, '\\u003c');
	return `<script id="${HYDRATION_SCRIPT_ID}" type="application/json">${escaped}</script>`;
};

/**
 * Whether a parsed payload is actually hydration data.
 *
 * The parse result used to be cast straight to `HydrationData`, so the guard
 * below caught malformed JSON and then handed back well-formed JSON of any
 * shape: `{}`, `[]`, `"str"` and `123` all reached `applyHydratedHead`, which
 * threw reading `head.title` and aborted hydration for the whole page.
 *
 * Only `head` is checked, because that is the field this module dereferences.
 */
const isHydrationData = (value: unknown): value is HydrationData =>
	Predicate.isRecord(value) && Predicate.isRecord(value.head);

/**
 * Retrieve hydration data from the DOM on the client side.
 * Returns null if the hydration script is not found or parsing fails.
 */
export const getHydrationData = (): HydrationData | null => {
	if (typeof document === 'undefined') {
		return null;
	}

	const script = document.getElementById(HYDRATION_SCRIPT_ID);
	if (!script) {
		return null;
	}

	try {
		const content = script.textContent;
		if (!content) return null;
		const parsed: unknown = JSON.parse(content);
		return isHydrationData(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

/**
 * Whether two state objects carry the same content.
 *
 * Offered for callers comparing client state against what the server rendered;
 * nothing in the framework calls it.
 *
 * Compares by content rather than by serialisation. `JSON.stringify` is key
 * order sensitive, so it reported a mismatch whenever server and client built
 * the same state by different routes — a different branch order, a spread, a
 * merge. Key order is not part of a state object's meaning. Array order is, and
 * still counts.
 *
 * A key whose value is `undefined` matches its absence, because state reaches
 * the client as JSON and such a key never survives the trip.
 */
export const checkHydrationMatch = (
	clientState: Record<string, unknown>,
	serverState: Record<string, unknown>
): boolean => sameContent(clientState, serverState, new Set());

/** Own keys whose value is defined, since `undefined` never crosses as JSON. */
const definedKeys = (value: Record<string, unknown>): string[] =>
	Object.keys(value).filter((key) => value[key] !== undefined);

const sameContent = (
	left: unknown,
	right: unknown,
	seen: Set<unknown>
): boolean => {
	if (Object.is(left, right)) return true;

	if (
		typeof left !== 'object' ||
		typeof right !== 'object' ||
		left === null ||
		right === null
	) {
		return false;
	}

	const leftIsArray = Array.isArray(left);
	if (leftIsArray !== Array.isArray(right)) return false;

	// A cycle on either side would otherwise recur forever. `JSON.stringify`
	// threw on one; terminating with an answer is the lesser surprise.
	if (seen.has(left) || seen.has(right)) return true;
	seen.add(left);
	seen.add(right);

	try {
		if (leftIsArray) {
			const leftItems = left as unknown[];
			const rightItems = right as unknown[];
			if (leftItems.length !== rightItems.length) return false;
			return leftItems.every((item, index) =>
				sameContent(item, rightItems[index], seen)
			);
		}

		const leftRecord = left as Record<string, unknown>;
		const rightRecord = right as Record<string, unknown>;
		const leftKeys = definedKeys(leftRecord);
		const rightKeys = definedKeys(rightRecord);
		if (leftKeys.length !== rightKeys.length) return false;

		return leftKeys.every(
			(key) =>
				Object.prototype.hasOwnProperty.call(rightRecord, key) &&
				sameContent(leftRecord[key], rightRecord[key], seen)
		);
	} finally {
		seen.delete(left);
		seen.delete(right);
	}
};

/**
 * Apply the server-rendered head data to the client DOM.
 * This reconciles the document title and other head elements
 * that may have changed during client-side navigation.
 */
export const applyHydratedHead = (head: HeadProps): void => {
	if (typeof document === 'undefined') return;
	// A public export, so it is reachable without `getHydrationData` and its
	// shape check; `head.title` threw when it was handed null or a primitive.
	if (!Predicate.isRecord(head)) return;

	const title = head.title;
	if (Predicate.isString(title) && title !== '' && document.title !== title) {
		document.title = title;
	}
};

/**
 * Remove the hydration script from the DOM after rehydration.
 * Called after the client app has fully mounted and reconciled state.
 */
export const cleanupHydrationScript = (): void => {
	if (typeof document === 'undefined') return;

	const script = document.getElementById(HYDRATION_SCRIPT_ID);
	if (script) {
		script.remove();
	}
};

/**
 * Initialize client-side hydration.
 *
 * Reads the server-serialized hydration data, applies the head,
 * and returns the data for the client app to reconcile state.
 */
export const initHydration = (): HydrationData | null => {
	const data = getHydrationData();

	if (data) {
		applyHydratedHead(data.head);
	}

	return data;
};
