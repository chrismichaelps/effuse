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
import { NexExecutionError } from '../../errors/index.js';
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
		});
	}

	const offset = decodeCursor(value);
	if (offset === undefined) {
		throw new NexExecutionError({
			message: `"| page ${argument}" was given a cursor this server did not hand out`,
			path,
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

	const first = readInt(args.get('first'));
	if (first !== undefined) end = Math.min(end, start + first);

	const last = readInt(args.get('last'));
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
