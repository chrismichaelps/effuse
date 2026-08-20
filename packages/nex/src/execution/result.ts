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

import type { NexExecutionError } from '../errors/index.js';

/** What to do with a field that fails, from specification section 6. */
export const ErrorPolicy = {
	/** Return the data that did resolve, alongside the errors. */
	PARTIAL: 'partial',
	/** Stop at the first error. */
	FAIL_FAST: 'failFast',
	/** Null the failing fields and say nothing about them. */
	IGNORE: 'ignore',
} as const;

export type ErrorPolicy = (typeof ErrorPolicy)[keyof typeof ErrorPolicy];

/** A response, shaped as specification section 7 describes. */
export interface ExecutionResult {
	/** The data that resolved, or `null` when the request could not run. */
	readonly data: Record<string, unknown> | null;
	/** Every problem, present only when there was at least one. */
	readonly errors?: readonly NexExecutionError[] | undefined;
	/** Everything else worth reporting, starting with what the request cost. */
	readonly extensions: Readonly<Record<string, unknown>> & {
		readonly cost: number;
	};
}
