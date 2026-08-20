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
 * Raised when a catalog is not coherent: a duplicate name, a reference to a
 * type that was never defined, or a definition used in the wrong position.
 *
 * A plain `Error` subclass, like every error this package surfaces.
 */
export class NexCatalogError extends Error {
	/** Discriminant for exhaustive matching without `instanceof`. */
	readonly _tag = 'NexCatalogError';
	/** Where the offending node sits, when the node carried a location. */
	readonly location: SourceLocation | undefined;

	constructor(options: {
		readonly message: string;
		readonly location?: SourceLocation | undefined;
	}) {
		super(options.message);
		this.name = 'NexCatalogError';
		this.location = options.location;
	}

	override toString(): string {
		const at =
			this.location === undefined
				? ''
				: ` (${String(this.location.line)}:${String(this.location.column)})`;
		return `NexCatalogError: ${this.message}${at}`;
	}
}
