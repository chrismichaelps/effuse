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

import { Data } from 'effect';
import type { TaggedErrorConstructor } from '../../internal/tagged.js';

interface MediaQueryErrorFields {
	readonly query: string;
	readonly reason: string;
}

export interface MediaQueryError extends Error, MediaQueryErrorFields {
	readonly _tag: 'MediaQueryError';
}

const MediaQueryErrorRuntime = class extends Data.TaggedError('MediaQueryError')<
	MediaQueryErrorFields
> {
	get message(): string {
		return `[useMediaQuery] Failed for query "${this.query}": ${this.reason}`;
	}
};

export const MediaQueryError = MediaQueryErrorRuntime as unknown as
	TaggedErrorConstructor<MediaQueryErrorFields, MediaQueryError>;

export const mediaQueryUnavailable = (query: string): MediaQueryError =>
	new MediaQueryError({
		query,
		reason: 'matchMedia is not available (SSR context)',
	});

export const mediaQueryInvalid = (query: string): MediaQueryError =>
	new MediaQueryError({
		query,
		reason: 'Invalid media query syntax',
	});
