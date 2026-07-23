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

/** Value substituted for a URL that fails validation. */
const SAFE_FALLBACK = '#';

/** Protocols permitted in a rendered href/src. */
const SAFE_PROTOCOLS = new Set([
	'http:',
	'https:',
	'mailto:',
	'tel:',
	'ftp:',
]);

export interface SanitizeUrlOptions {
	/** Permit `data:image/*` URLs (except SVG). Enable only for image `src`. */
	readonly allowDataImages?: boolean;
}

const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)[;,]/i;

/**
 * Decode HTML entities that could hide a dangerous scheme, then strip control
 * characters and whitespace that browsers ignore inside a protocol. This
 * defeats the entity/obfuscation bypasses (`javascript&#58;`, `java\tscript:`)
 * that break naive `javascript:` string checks (CVE-2025-24981 class).
 */
const normalizeForProtocolCheck = (value: string): string => {
	const decoded = value.replace(
		/&#(x?)([0-9a-f]+);?/gi,
		(_match, hex: string, digits: string) => {
			const codePoint = Number.parseInt(digits, hex ? 16 : 10);
			if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
				return '';
			}
			try {
				return String.fromCodePoint(codePoint);
			} catch {
				return '';
			}
		}
	);

	// Remove all control characters (incl. NUL and tab/newline) and every
	// Unicode whitespace character before comparing the protocol.
	// eslint-disable-next-line no-control-regex
	return decoded.replace(/[\u0000-\u0020\s]/g, '').toLowerCase();
};

/**
 * Returns a URL safe to place in a rendered `href`/`src`, or `#` when the
 * input carries a dangerous or unknown scheme.
 *
 * Relative URLs, anchors, and protocol-relative URLs are allowed. Absolute
 * URLs must use an explicitly safe protocol. Data URLs are rejected unless
 * `allowDataImages` is set and the media type is a raster image.
 */
export const sanitizeUrl = (
	url: string,
	options: SanitizeUrlOptions = {}
): string => {
	if (typeof url !== 'string') {
		return SAFE_FALLBACK;
	}

	const trimmed = url.trim();
	if (trimmed === '') {
		return SAFE_FALLBACK;
	}

	const normalized = normalizeForProtocolCheck(trimmed);

	// Explicitly reject known-dangerous data URLs regardless of options.
	if (normalized.startsWith('data:')) {
		if (options.allowDataImages && SAFE_DATA_IMAGE.test(trimmed)) {
			return trimmed;
		}
		return SAFE_FALLBACK;
	}

	// No scheme separator before the first path/query/fragment boundary means
	// the URL is relative, an anchor, or protocol-relative — all safe.
	const schemeMatch = /^([a-z][a-z0-9+.-]*):/.exec(normalized);
	if (schemeMatch === null || schemeMatch[1] === undefined) {
		return trimmed;
	}

	const protocol = `${schemeMatch[1]}:`;
	if (SAFE_PROTOCOLS.has(protocol)) {
		return trimmed;
	}

	return SAFE_FALLBACK;
};
