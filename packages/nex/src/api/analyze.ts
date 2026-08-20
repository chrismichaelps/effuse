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

import { Effect } from 'effect';
import type { AnalysisOptions, RequestAnalysis } from '../analysis/index.js';
import type { Catalog } from '../catalog/index.js';
import { AnalyzerService } from '../services/index.js';
import { parse } from './parse.js';
import { runOrThrow } from './runtime.js';
import type { RequestInput } from './validate-request.js';

/**
 * Price a request and measure its depth without running it.
 *
 * Page sizes come from the request itself, so pass the variables it will run
 * with to price it the way it will actually behave.
 *
 * @throws {NexSyntaxError} when source text does not parse.
 */
export const analyzeRequest = (
	input: RequestInput,
	catalog: Catalog,
	options: AnalysisOptions = {}
): RequestAnalysis => {
	const document = typeof input === 'string' ? parse(input) : input;

	return runOrThrow(
		Effect.gen(function* () {
			const analyzer = yield* AnalyzerService;
			return yield* analyzer.analyze(document, catalog, options);
		})
	);
};
