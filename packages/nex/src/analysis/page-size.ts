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

import type { FieldNode, ValueNode } from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';

/**
 * What a list field is assumed to return when the request does not say.
 *
 * Analysis has to price a list before it runs, so an unbounded list is priced
 * as though it returned this many rows.
 */
export const DEFAULT_PAGE_SIZE = 20;

const readCount = (
	value: ValueNode,
	variables: Readonly<Record<string, unknown>>
): number | undefined => {
	if (value.kind === Kind.INT) return Number.parseInt(value.value, 10);

	if (value.kind === Kind.VARIABLE) {
		const supplied = variables[value.name.value];
		return typeof supplied === 'number' && Number.isFinite(supplied)
			? supplied
			: undefined;
	}

	return undefined;
};

/**
 * How many rows a field is expected to yield, read from its pipeline.
 *
 * `| page first:` and `| take` both bound a list; everything else leaves it
 * open, and an open list is priced at {@link DEFAULT_PAGE_SIZE}.
 */
export const expectedRowCount = (
	field: FieldNode,
	variables: Readonly<Record<string, unknown>>
): number => {
	let rows: number | undefined;

	for (const stage of field.pipeline ?? []) {
		if (stage.kind === Kind.TAKE_STAGE) {
			rows = readCount(stage.count, variables) ?? rows;
			continue;
		}
		if (stage.kind !== Kind.PAGE_STAGE) continue;

		for (const argument of stage.arguments) {
			const name = argument.name.value;
			if (name !== 'first' && name !== 'last') continue;
			rows = readCount(argument.value, variables) ?? rows;
		}
	}

	return rows ?? DEFAULT_PAGE_SIZE;
};
