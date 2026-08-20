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

import type { SourceLocation } from './syntax-error.js';

/**
 * Raised when a request is well-formed but does not agree with the catalog:
 * an unknown field, an argument of the wrong type, a pipeline stage applied
 * where it cannot work.
 *
 * A plain `Error` subclass, like every error this package surfaces.
 */
export class NexValidationError extends Error {
	/** Discriminant for exhaustive matching without `instanceof`. */
	readonly _tag = 'NexValidationError';
	/** Where the offending node sits, when the node carried a location. */
	readonly location: SourceLocation | undefined;
	/** Response path to the offending node, by field name. */
	readonly path: readonly string[];

	constructor(options: {
		readonly message: string;
		readonly location?: SourceLocation | undefined;
		readonly path?: readonly string[] | undefined;
	}) {
		super(options.message);
		this.name = 'NexValidationError';
		this.location = options.location;
		this.path = options.path ?? [];
	}

	override toString(): string {
		const at =
			this.location === undefined
				? ''
				: ` (${String(this.location.line)}:${String(this.location.column)})`;
		return `NexValidationError: ${this.message}${at}`;
	}
}
