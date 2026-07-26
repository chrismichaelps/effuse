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

interface DebounceErrorFields {
	readonly reason: string;
}

export interface DebounceError extends Error, DebounceErrorFields {
	readonly _tag: 'DebounceError';
}

const DebounceErrorRuntime = class extends Data.TaggedError('DebounceError')<
	DebounceErrorFields
> {
	get message(): string {
		return `[useDebounce] ${this.reason}`;
	}
};

export const DebounceError = DebounceErrorRuntime as unknown as
	TaggedErrorConstructor<DebounceErrorFields, DebounceError>;

export const debounceInvalidDelay = (delay: number): DebounceError =>
	new DebounceError({
		reason: `Invalid delay: ${String(delay)}ms. Must be >= 0`,
	});
