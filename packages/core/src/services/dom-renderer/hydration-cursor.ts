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

import { isDebugEnabled } from '../../config/index.js';

/**
 * Position in the server-rendered DOM that the client renderer is currently
 * adopting. `next` is the node a claim will try to take; claiming advances it,
 * and anything left over when a parent is finished is discarded.
 */
export interface HydrationCursor {
	readonly parent: Node;
	next: ChildNode | null;
}

export const createHydrationCursor = (parent: Node): HydrationCursor => ({
	parent,
	next: parent.firstChild,
});

const warnMismatch = (message: string): void => {
	if (!isDebugEnabled()) return;
	// eslint-disable-next-line no-console
	console.warn(`[effuse] Hydration mismatch: ${message}`);
};

const isElementNode = (node: ChildNode | null): node is Element =>
	node !== null && node.nodeType === 1;

const isTextNode = (node: ChildNode | null): node is Text =>
	node !== null && node.nodeType === 3;

const advance = (cursor: HydrationCursor, claimed: ChildNode): void => {
	cursor.next = claimed.nextSibling;
};

/** Place a node the server never rendered at the cursor, without claiming. */
export const insertAtCursor = (cursor: HydrationCursor, node: Node): void => {
	cursor.parent.insertBefore(node, cursor.next);
};

/**
 * Adopt the server-rendered element for `tag`, or create one when the markup
 * does not match. A mismatch is repaired locally: the client node is inserted
 * at the cursor and the stale server node is dropped with the rest of the
 * unclaimed siblings.
 */
export const claimElement = (cursor: HydrationCursor, tag: string): Element => {
	const candidate = cursor.next;
	if (
		isElementNode(candidate) &&
		candidate.tagName.toLowerCase() === tag.toLowerCase()
	) {
		advance(cursor, candidate);
		return candidate;
	}

	warnMismatch(
		`expected <${tag}>, server rendered ${describeNode(candidate)}. Rendering it on the client instead.`
	);
	const element = document.createElement(tag);
	insertAtCursor(cursor, element);
	return element;
};

/**
 * Adopt the server-rendered text for `text`. Server output merges adjacent
 * text children into one node, so a claim may only need the first slice of the
 * candidate — the remainder stays for the next claim.
 */
export const claimText = (cursor: HydrationCursor, text: string): Text => {
	// An empty string has no server representation; give the client renderer a
	// real node to own so later updates have somewhere to write.
	if (text === '') {
		const empty = document.createTextNode('');
		insertAtCursor(cursor, empty);
		return empty;
	}

	const candidate = cursor.next;
	if (isTextNode(candidate)) {
		if (candidate.data === text) {
			advance(cursor, candidate);
			return candidate;
		}

		if (candidate.data.startsWith(text)) {
			const remainder = candidate.splitText(text.length);
			cursor.next = remainder;
			return candidate;
		}

		warnMismatch(
			`expected text ${JSON.stringify(text)}, server rendered ${JSON.stringify(candidate.data)}.`
		);
		candidate.data = text;
		advance(cursor, candidate);
		return candidate;
	}

	warnMismatch(
		`expected text ${JSON.stringify(text)}, server rendered ${describeNode(candidate)}.`
	);
	const textNode = document.createTextNode(text);
	insertAtCursor(cursor, textNode);
	return textNode;
};

/**
 * Remove everything the client render did not claim. Called once per parent,
 * after its children have been walked.
 */
export const dropUnclaimed = (cursor: HydrationCursor): void => {
	let node = cursor.next;
	while (node) {
		const next: ChildNode | null = node.nextSibling;
		node.remove();
		node = next;
	}
	cursor.next = null;
};

const describeNode = (node: ChildNode | null): string => {
	if (!node) return 'nothing';
	if (isElementNode(node)) return `<${node.tagName.toLowerCase()}>`;
	if (isTextNode(node)) return `text ${JSON.stringify(node.data)}`;
	return 'a non-element node';
};
