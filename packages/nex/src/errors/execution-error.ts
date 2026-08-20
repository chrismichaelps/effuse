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
 * Raised when a request that agrees with the catalog cannot be carried out: a
 * resolver threw, a non-null field produced null, a cursor was not one this
 * server handed out.
 *
 * A plain `Error` subclass, like every error this package surfaces.
 */
export class NexExecutionError extends Error {
	/** Discriminant for exhaustive matching without `instanceof`. */
	readonly _tag = 'NexExecutionError';
	/** Response path to the field that failed, including list indices. */
	readonly path: readonly (string | number)[];
	/** Where the field was written, when the node carried a location. */
	readonly location: SourceLocation | undefined;
	/** Whatever the resolver threw, when it threw something. */
	readonly extensions: Readonly<Record<string, unknown>>;

	constructor(options: {
		readonly message: string;
		readonly path?: readonly (string | number)[] | undefined;
		readonly location?: SourceLocation | undefined;
		readonly cause?: unknown;
		readonly extensions?: Readonly<Record<string, unknown>> | undefined;
	}) {
		super(
			options.message,
			options.cause === undefined ? {} : { cause: options.cause }
		);
		this.name = 'NexExecutionError';
		this.path = options.path ?? [];
		this.location = options.location;
		this.extensions = options.extensions ?? {};
	}

	/** The shape this error takes in a response, per specification section 7. */
	toJSON(): Readonly<Record<string, unknown>> {
		return {
			message: this.message,
			path: this.path,
			...(Object.keys(this.extensions).length === 0
				? {}
				: { extensions: this.extensions }),
		};
	}
}
