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
import type { DocumentNode } from '../language/ast/index.js';
import { ValidatorService } from '../services/index.js';
import { runEither, runOrThrow } from './runtime.js';

const validateProgram = (value: unknown) =>
	Effect.gen(function* () {
		const validator = yield* ValidatorService;
		return yield* validator.validate(value);
	});

/**
 * Check a document that arrived from an untrusted source - a cache, a request
 * body, a persisted operation store - against the AST schema.
 *
 * @throws {NexSyntaxError} when the value is not a well-formed document.
 */
export const validateDocument = (value: unknown): DocumentNode =>
	runOrThrow(validateProgram(value));

/** Whether `value` is a well-formed Nex document AST. */
export const isDocument = (value: unknown): value is DocumentNode =>
	Either.isRight(runEither(validateProgram(value)));
