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

import { decodeBase64, encodeBase64 } from '../utils/index.js';

const PREFIX = 'nexref:';

/** What a reference points at. */
export interface ObjectReference {
	/** The type the object is. */
	readonly type: string;
	/** The value of the field that type says identifies it. */
	readonly id: string;
}

/**
 * Build the reference an object of `type` is known by.
 *
 * A client caching what it has seen needs one key per object, and a bare `id`
 * is only unique within its own type - two types both numbering from one
 * collide the moment they share a cache. A reference carries the type with the
 * value, so it is unique across the whole graph.
 *
 * It is opaque on purpose: a client that read it apart would be relying on
 * what a server may change. `parseRef` reads it back, on the server that
 * handed it out.
 */
export const refFor = (type: string, id: string): string =>
	encodeBase64(`${PREFIX}${type}:${id}`);

/**
 * Read back a reference this package handed out.
 *
 * Returns `undefined` for anything else, so a server answering a reference a
 * client sent back can say it does not know it rather than looking up
 * something it invented.
 */
export const parseRef = (reference: string): ObjectReference | undefined => {
	const decoded = decodeBase64(reference);
	if (decoded === undefined || !decoded.startsWith(PREFIX)) return undefined;

	const body = decoded.slice(PREFIX.length);
	const separator = body.indexOf(':');
	if (separator <= 0) return undefined;

	// A type name never carries the separator, so the first one ends it and
	// everything after is the value - which may carry as many as it likes.
	return { type: body.slice(0, separator), id: body.slice(separator + 1) };
};
