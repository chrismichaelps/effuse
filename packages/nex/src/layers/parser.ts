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

import { Effect, Layer } from 'effect';
import { toSyntaxError } from '../errors/index.js';
import { parse } from '../language/parser/index.js';
import { LexerService, ParserService } from '../services/index.js';

/**
 * Default parser layer.
 *
 * It requires {@link LexerService}, so an embedder can swap the token source -
 * a caching or instrumented lexer, say - without touching the grammar.
 */
export const ParserLayer = Layer.effect(
	ParserService,
	Effect.gen(function* () {
		const lexer = yield* LexerService;

		return {
			parse: (source) =>
				lexer
					.tokenize(source)
					.pipe(
						Effect.flatMap(() =>
							Effect.try({ try: () => parse(source), catch: toSyntaxError })
						)
					),
		};
	})
);
