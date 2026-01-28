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

export class LocalStorageError extends Data.TaggedError('LocalStorageError')<{
	readonly key: string;
	readonly operation: 'read' | 'write' | 'remove';
	readonly reason: string;
}> {
	get message(): string {
		return `[useLocalStorage] Failed to ${this.operation} key "${this.key}": ${this.reason}`;
	}
}

export const storageReadError = (
	key: string,
	reason: string
): LocalStorageError =>
	new LocalStorageError({ key, operation: 'read', reason });

export const storageWriteError = (
	key: string,
	reason: string
): LocalStorageError =>
	new LocalStorageError({ key, operation: 'write', reason });

export const storageRemoveError = (
	key: string,
	reason: string
): LocalStorageError =>
	new LocalStorageError({ key, operation: 'remove', reason });

export const storageUnavailable = (key: string): LocalStorageError =>
	new LocalStorageError({
		key,
		operation: 'read',
		reason: 'localStorage is not available (SSR context)',
	});
