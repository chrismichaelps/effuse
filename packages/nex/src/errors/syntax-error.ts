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

import { NexErrorCode } from './codes.js';

/** A position inside a Nex source document. */
export interface SourceLocation {
	/** Zero-based offset of the character the error points at. */
	readonly start: number;
	/** One-based line of that character. */
	readonly line: number;
	/** One-based column of that character. */
	readonly column: number;
}

/**
 * Raised when source text cannot be lexed or parsed.
 *
 * A plain `Error` subclass: using `@effuse/nex` never requires Effect, even
 * though the package is built on it internally.
 */
export class NexSyntaxError extends Error {
	/** Discriminant for exhaustive matching without `instanceof`. */
	readonly _tag = 'NexSyntaxError';
	/** What kind of problem this is, for a client that branches on it. */
	readonly code: NexErrorCode = NexErrorCode.SYNTAX;
	readonly location: SourceLocation;
	/**
	 * The source around the problem, with a caret under it.
	 *
	 * Present whenever the source was at hand when the error was raised, which
	 * covers everything the lexer and the parser report.
	 */
	readonly excerpt: string | undefined;

	constructor(options: {
		readonly message: string;
		readonly location: SourceLocation;
		readonly excerpt?: string | undefined;
	}) {
		super(options.message);
		this.name = 'NexSyntaxError';
		this.location = options.location;
		this.excerpt = options.excerpt;
	}

	override toString(): string {
		const at = `(${String(this.location.line)}:${String(this.location.column)})`;
		const head = `NexSyntaxError: ${this.message} ${at}`;
		return this.excerpt === undefined ? head : `${head}\n\n${this.excerpt}`;
	}
}

/**
 * Normalise a thrown value into a {@link NexSyntaxError}, so the Effect error
 * channel stays typed even though the scanners throw.
 */
export const toSyntaxError = (cause: unknown): NexSyntaxError =>
	cause instanceof NexSyntaxError
		? cause
		: new NexSyntaxError({
				message: String(cause),
				location: { start: 0, line: 1, column: 1 },
			});
