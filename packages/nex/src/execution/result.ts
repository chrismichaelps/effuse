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
import type { PatchOperation } from './patch.js';

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

const ERROR_POLICIES: readonly string[] = Object.values(ErrorPolicy);

/**
 * Whether a value is one of the ways of handling a field that failed.
 *
 * Taking an unrecognised one as the default would hand a server that asked to
 * say nothing about failures the policy that says everything about them -
 * which is the one thing it asked not to happen. A value that came from a
 * configuration file rather than from this package is exactly how that
 * happens, so it is checked rather than assumed.
 */
export const isErrorPolicy = (value: unknown): value is ErrorPolicy =>
	typeof value === 'string' && ERROR_POLICIES.includes(value);

/** What to say about a policy nobody defined. */
export const unknownErrorPolicy = (value: unknown): string =>
	`"${String(value)}" is not a way of handling a field that failed; there is ${ERROR_POLICIES.join(', ')}`;

/** How a live operation sends what it produced, per specification section 7. */
export const LiveDelivery = {
	/** Every event carries the whole response. */
	SNAPSHOT: 'snapshot',
	/** The first event carries the whole response; the rest carry changes. */
	DIFFERENTIAL: 'differential',
} as const;

export type LiveDelivery = (typeof LiveDelivery)[keyof typeof LiveDelivery];

/**
 * A response, shaped as specification section 7 describes.
 *
 * `TData` is the shape the request asks for. Pair it with what
 * `generateTypes` writes and a caller reads `result.data.posts.items` without
 * casting anything back into shape.
 */
export interface ExecutionResult<TData = Record<string, unknown>> {
	/**
	 * The data that resolved, or `null` when the request could not run.
	 *
	 * Absent on a differential snapshot, which carries {@link patch} instead.
	 */
	readonly data?: TData | null | undefined;
	/** What changed since the last snapshot, when sending differences. */
	readonly patch?: readonly PatchOperation[] | undefined;
	/** Every problem, present only when there was at least one. */
	readonly errors?: readonly NexExecutionError[] | undefined;
	/** Everything else worth reporting, starting with what the request cost. */
	readonly extensions: Readonly<Record<string, unknown>> & {
		readonly cost: number;
	};
}
