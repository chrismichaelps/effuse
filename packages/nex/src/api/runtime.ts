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

import { Effect, Either, ManagedRuntime } from 'effect';
import type { NexSyntaxError } from '../errors/index.js';
import { NexLanguageLayer } from '../layers/index.js';
import type {
	AnalyzerService,
	ExecutorService,
	CatalogService,
	LexerService,
	RequestValidatorService,
	ParserService,
	PrinterService,
	ValidatorService,
} from '../services/index.js';

type LanguageServices =
	| AnalyzerService
	| ExecutorService
	| CatalogService
	| LexerService
	| ParserService
	| PrinterService
	| ValidatorService
	| RequestValidatorService;

const runtime = ManagedRuntime.make(NexLanguageLayer);

/**
 * Run a program against the language layer and hand back a plain value.
 *
 * Every public function goes through here, which is what keeps Effect an
 * implementation detail: callers see values and ordinary thrown errors.
 */
export const runEither = <A>(
	program: Effect.Effect<A, NexSyntaxError, LanguageServices>
): Either.Either<A, NexSyntaxError> => runtime.runSync(Effect.either(program));

/** Run a program, throwing its failure the way a plain function would. */
export const runOrThrow = <A>(
	program: Effect.Effect<A, NexSyntaxError, LanguageServices>
): A => {
	const result = runEither(program);
	if (Either.isLeft(result)) throw result.left;
	return result.right;
};

/** Run a program that awaits work outside the process, such as a resolver. */
export const runPromise = <A>(
	program: Effect.Effect<A, never, LanguageServices>
): Promise<A> => runtime.runPromise(program);

/** Alias kept for call sites that read better with the longer name. */
export const runEitherPromise = runPromise;
