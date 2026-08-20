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

import { Effect, Either } from 'effect';
import type { NexSyntaxError } from '../errors/index.js';
import type { DocumentNode } from '../language/ast/index.js';
import { ParserService } from '../services/index.js';
import { runEither, runOrThrow } from './runtime.js';

const parseProgram = (source: string) =>
	Effect.gen(function* () {
		const parser = yield* ParserService;
		return yield* parser.parse(source);
	});

/**
 * Parse Nex source into a document AST.
 *
 * @throws {NexSyntaxError} when the source is not a valid Nex document.
 */
export const parse = (source: string): DocumentNode =>
	runOrThrow(parseProgram(source));

/** The outcome of a parse that reports failures instead of throwing. */
export type ParseResult =
	| { readonly success: true; readonly document: DocumentNode }
	| { readonly success: false; readonly error: NexSyntaxError };

/** Parse Nex source, reporting syntax errors as a value instead of throwing. */
export const parseSafe = (source: string): ParseResult => {
	const result = runEither(parseProgram(source));
	return Either.isLeft(result)
		? { success: false, error: result.left }
		: { success: true, document: result.right };
};
