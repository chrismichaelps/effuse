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

import { Effect, Either, Layer, Schema } from 'effect';
import { NexSyntaxError } from '../errors/index.js';
import { DocumentNodeSchema } from '../schema/index.js';
import { ValidatorService } from '../services/index.js';

const decodeDocument = Schema.decodeUnknownEither(DocumentNodeSchema);

/** Default validator layer, backed by the AST schemas. */
export const ValidatorLayer = Layer.succeed(ValidatorService, {
	validate: (value) =>
		Effect.suspend(() => {
			const result = decodeDocument(value);
			return Either.isLeft(result)
				? Effect.fail(
						new NexSyntaxError({
							message: `Invalid Nex document: ${result.left.message}`,
							location: { start: 0, line: 1, column: 1 },
						})
					)
				: Effect.succeed(result.right);
		}),
});
