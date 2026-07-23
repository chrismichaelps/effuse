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

interface LocaleCandidate {
	readonly tag: string;
	readonly quality: number;
	readonly order: number;
}

/**
 * Resolves an Accept-Language header against the locales an application
 * actually ships. Quality values order the candidates, region tags fall back
 * to their base locale (en-US matches en), the wildcard resolves to the
 * fallback, and anything unmatched or malformed degrades to the fallback.
 */
export const resolveLocale = (
	header: string | null | undefined,
	availableLocales: readonly string[],
	fallbackLocale: string
): string => {
	if (header == null || header.trim() === '') {
		return fallbackLocale;
	}

	const candidates: LocaleCandidate[] = [];
	const parts = header.split(',');
	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index];
		if (part === undefined) continue;
		const [rawTag, ...rawParams] = part.trim().split(';');
		const tag = rawTag?.trim().toLowerCase() ?? '';
		if (tag === '') continue;

		// Malformed quality values keep the default weight of 1.
		let quality = 1;
		for (const rawParam of rawParams) {
			const [name, value] = rawParam.trim().split('=');
			if (name?.trim() !== 'q' || value === undefined) continue;
			const parsed = Number(value.trim());
			if (Number.isFinite(parsed)) {
				quality = parsed;
			}
		}

		candidates.push({ tag, quality, order: index });
	}

	candidates.sort((a, b) => b.quality - a.quality || a.order - b.order);

	const lowered = new Map(
		availableLocales.map((locale) => [locale.toLowerCase(), locale])
	);

	for (const { tag, quality } of candidates) {
		if (quality <= 0) continue;
		if (tag === '*') {
			return fallbackLocale;
		}

		const exact = lowered.get(tag);
		if (exact !== undefined) {
			return exact;
		}

		const base = tag.split('-')[0];
		if (base !== undefined) {
			const baseMatch = lowered.get(base);
			if (baseMatch !== undefined) {
				return baseMatch;
			}
		}
	}

	return fallbackLocale;
};
