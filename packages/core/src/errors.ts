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

export class UnknownJSXTypeError extends Data.TaggedError(
	'UnknownJSXTypeError'
)<{
	readonly type: unknown;
}> {}

export class DuplicateKeysError extends Data.TaggedError('DuplicateKeysError')<{
	readonly component: string;
}> {}

export class ResourcePendingError extends Data.TaggedError(
	'ResourcePendingError'
)<{
	readonly message: string;
}> {}

export class PropValidationError extends Data.TaggedError(
	'PropValidationError'
)<{
	readonly cause: unknown;
}> {}

export class ScriptContextError extends Data.TaggedError('ScriptContextError')<{
	readonly message: string;
}> {}

export class StoreGetterNotConfiguredError extends Data.TaggedError(
	'StoreGetterNotConfiguredError'
)<Record<string, never>> {}

export class CauseExtractionError extends Data.TaggedError(
	'CauseExtractionError'
)<{
	readonly cause: unknown;
}> {}

export class ResourceFetchError extends Data.TaggedError('ResourceFetchError')<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export class LayerExecutionError extends Data.TaggedError(
	'LayerExecutionError'
)<{
	readonly message: string;
	readonly cause?: unknown;
}> {}
