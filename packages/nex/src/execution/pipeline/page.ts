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

import type { PageStageNode } from '../../language/ast/index.js';
import { NexErrorCode, NexExecutionError } from '../../errors/index.js';
import { valueFromNode } from '../values.js';
import { decodeCursor, encodeCursor } from './cursor.js';

/** The page shape every `| page` stage produces, per specification section 8. */
export interface Page {
	readonly items: readonly unknown[];
	readonly pageInfo: {
		readonly hasNextPage: boolean;
		readonly hasPreviousPage: boolean;
		readonly startCursor: string | null;
		readonly endCursor: string | null;
	};
	readonly totalCount: number;
}

/**
 * How many rows a page was asked for, or the reason it cannot be that many.
 *
 * A negative size widens the window rather than narrowing it, so a caller
 * asking for fewer than none was answered with everything - whatever the
 * server had set as a limit. A literal is refused before the request runs;
 * one that arrived in a variable is refused here.
 */
const readSize = (value: unknown, which: string): number | undefined => {
	// Read before narrowing: a negative one used to fall through as "no size
	// given", which is the widest answer there is rather than the narrowest.
	if (typeof value === 'number' && Number.isInteger(value) && value < 0) {
		throw new NexExecutionError({
			message: `"| page ${which}" needs a count of none or more, found ${String(value)}`,
			code: NexErrorCode.VALIDATION,
		});
	}

	return readInt(value);
};

const readInt = (value: unknown): number | undefined =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0
		? value
		: undefined;

const readOffset = (
	value: unknown,
	argument: string,
	path: readonly (string | number)[]
): number => {
	if (typeof value !== 'string') {
		throw new NexExecutionError({
			message: `"| page ${argument}" needs a cursor, received ${JSON.stringify(value)}`,
			path,
			code: NexErrorCode.CURSOR,
		});
	}

	const offset = decodeCursor(value);
	if (offset === undefined) {
		throw new NexExecutionError({
			message: `"| page ${argument}" was given a cursor this server did not hand out`,
			path,
			code: NexErrorCode.CURSOR,
		});
	}

	return offset;
};

/**
 * Cut a window out of the rows a pipeline produced.
 *
 * Cursors carry the row's offset in the list the pipeline built, so paging
 * forward and backward walk the same list the request asked for.
 */
export const paginate = (
	rows: readonly unknown[],
	stage: PageStageNode,
	variables: Readonly<Record<string, unknown>>,
	path: readonly (string | number)[]
): Page => {
	const args = new Map(
		stage.arguments.map((argument) => [
			argument.name.value,
			valueFromNode(argument.value, variables),
		])
	);

	let start = 0;
	let end = rows.length;

	const after = args.get('after');
	if (after !== undefined && after !== null) {
		start = Math.min(readOffset(after, 'after', path) + 1, rows.length);
	}

	const before = args.get('before');
	if (before !== undefined && before !== null) {
		end = Math.max(readOffset(before, 'before', path), start);
	}

	const first = readSize(args.get('first'), 'first');
	if (first !== undefined) end = Math.min(end, start + first);

	const last = readSize(args.get('last'), 'last');
	if (last !== undefined) start = Math.max(start, end - last);

	const items = rows.slice(start, end);

	return {
		items,
		pageInfo: {
			hasNextPage: end < rows.length,
			hasPreviousPage: start > 0,
			startCursor: items.length === 0 ? null : encodeCursor(start),
			endCursor: items.length === 0 ? null : encodeCursor(end - 1),
		},
		totalCount: rows.length,
	};
};
