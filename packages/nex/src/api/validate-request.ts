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
import { analyzeDocument, type AnalysisOptions } from '../analysis/index.js';
import type { ValidationOptions } from '../validation/index.js';
import type { Catalog } from '../catalog/index.js';
import {
	NexErrorCode,
	NexValidationError,
	type NexSyntaxError,
} from '../errors/index.js';
import type { DocumentNode } from '../language/ast/index.js';
import { RequestValidatorService } from '../services/index.js';
import { parseSafe } from './parse.js';
import { runOrThrow } from './runtime.js';

/** A request to check: source text, or a document already parsed. */
export type RequestInput = string | DocumentNode;

/** Limits a request must stay inside, on top of the catalog's own rules. */
export interface RequestLimits extends AnalysisOptions, ValidationOptions {
	/** Reject a request whose estimated cost is above this. */
	readonly maxCost?: number | undefined;
	/** Reject a request that nests deeper than this. */
	readonly maxDepth?: number | undefined;
}

const asDocument = (
	input: RequestInput
): { readonly document: DocumentNode } | { readonly error: NexSyntaxError } => {
	if (typeof input !== 'string') return { document: input };

	const result = parseSafe(input);
	return result.success
		? { document: result.document }
		: { error: result.error };
};

/**
 * Check a request against a catalog.
 *
 * Returns every problem found, in the order they were found; an empty array
 * means the request is ready to execute. A request that does not parse is
 * reported as a single problem, so callers have one thing to look at.
 */
export const validateRequest = (
	input: RequestInput,
	catalog: Catalog,
	limits: RequestLimits = {}
): readonly NexValidationError[] => {
	const parsed = asDocument(input);

	if ('error' in parsed) {
		return [
			new NexValidationError({
				message: parsed.error.message,
				location: parsed.error.location,
			}),
		];
	}

	const problems = runOrThrow(
		Effect.gen(function* () {
			const validator = yield* RequestValidatorService;
			return yield* validator.validate(parsed.document, catalog, limits);
		})
	);

	return [...problems, ...checkLimits(parsed.document, catalog, limits)];
};

/**
 * Cost and depth are checked after the catalog rules, because a request that
 * does not agree with the catalog cannot be priced meaningfully.
 */
const checkLimits = (
	document: DocumentNode,
	catalog: Catalog,
	limits: RequestLimits
): readonly NexValidationError[] => {
	if (limits.maxCost === undefined && limits.maxDepth === undefined) return [];

	const analysis = analyzeDocument(document, catalog, limits);
	const problems: NexValidationError[] = [];

	if (limits.maxDepth !== undefined && analysis.depth > limits.maxDepth) {
		problems.push(
			new NexValidationError({
				message: `Request depth ${String(analysis.depth)} exceeds the maximum of ${String(limits.maxDepth)}`,
				code: NexErrorCode.DEPTH_LIMIT,
			})
		);
	}

	if (limits.maxCost !== undefined && analysis.cost > limits.maxCost) {
		problems.push(
			new NexValidationError({
				message: `Request cost ${String(analysis.cost)} exceeds the maximum of ${String(limits.maxCost)}`,
				code: NexErrorCode.COST_LIMIT,
			})
		);
	}

	return problems;
};

/** Whether a request is valid against a catalog. */
export const isValidRequest = (
	input: RequestInput,
	catalog: Catalog,
	limits: RequestLimits = {}
): boolean => validateRequest(input, catalog, limits).length === 0;
