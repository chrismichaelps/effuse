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

const ALPHABET =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64 without reaching for a runtime global.
 *
 * Cursors have to survive a trip through a browser, an edge worker, and a
 * server, so the encoding is written out rather than borrowed from whichever
 * of `Buffer` or `btoa` happens to exist.
 */
export const encodeBase64 = (text: string): string => {
	let out = '';

	for (let index = 0; index < text.length; index += 3) {
		const a = text.charCodeAt(index);
		const b = index + 1 < text.length ? text.charCodeAt(index + 1) : Number.NaN;
		const c = index + 2 < text.length ? text.charCodeAt(index + 2) : Number.NaN;

		out += ALPHABET[a >> 2];
		out += ALPHABET[((a & 3) << 4) | (Number.isNaN(b) ? 0 : b >> 4)];
		out += Number.isNaN(b)
			? '='
			: ALPHABET[((b & 15) << 2) | (Number.isNaN(c) ? 0 : c >> 6)];
		out += Number.isNaN(c) ? '=' : ALPHABET[c & 63];
	}

	return out;
};

export const decodeBase64 = (encoded: string): string | undefined => {
	const trimmed = encoded.replace(/=+$/u, '');
	if (!/^[A-Za-z0-9+/]*$/u.test(trimmed)) return undefined;

	let bits = 0;
	let buffer = 0;
	let out = '';

	for (const character of trimmed) {
		buffer = (buffer << 6) | ALPHABET.indexOf(character);
		bits += 6;

		if (bits < 8) continue;
		bits -= 8;
		out += String.fromCharCode((buffer >> bits) & 0xff);
	}

	return out;
};
