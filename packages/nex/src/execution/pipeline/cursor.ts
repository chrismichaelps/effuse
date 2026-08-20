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

import { decodeBase64, encodeBase64 } from '../../utils/index.js';

const PREFIX = 'nex:';

/** Hand out an opaque cursor for a row at `offset`. */
export const encodeCursor = (offset: number): string =>
	encodeBase64(`${PREFIX}${String(offset)}`);

/**
 * Read a cursor this server handed out.
 *
 * Returns `undefined` for anything else, so the caller can say so rather than
 * paging from a position it invented.
 */
export const decodeCursor = (cursor: string): number | undefined => {
	const decoded = decodeBase64(cursor);
	if (decoded === undefined || !decoded.startsWith(PREFIX)) return undefined;

	const digits = decoded.slice(PREFIX.length);
	if (!/^\d+$/u.test(digits)) return undefined;

	const offset = Number.parseInt(digits, 10);
	return Number.isSafeInteger(offset) ? offset : undefined;
};
