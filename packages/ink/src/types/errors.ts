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

export class ParseError extends Data.TaggedError('ParseError')<{
	readonly message: string;
	readonly line: number;
	readonly column: number;
	readonly source?: string;
}> {}

export class ComponentNotFoundError extends Data.TaggedError(
	'ComponentNotFoundError'
)<{
	readonly message: string;
	readonly componentName: string;
	readonly line?: number;
}> {}

export class InvalidPropsError extends Data.TaggedError('InvalidPropsError')<{
	readonly message: string;
	readonly componentName: string;
	readonly invalidProps: readonly string[];
}> {}

export class SanitizationError extends Data.TaggedError('SanitizationError')<{
	readonly message: string;
	readonly unsafeContent: string;
}> {}

export class TransformError extends Data.TaggedError('TransformError')<{
	readonly message: string;
	readonly nodeType: string;
	readonly cause?: unknown;
}> {}

export type InkError =
	| ParseError
	| ComponentNotFoundError
	| InvalidPropsError
	| SanitizationError
	| TransformError;
