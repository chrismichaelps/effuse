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

import type { FieldPathNode } from '../../language/ast/index.js';
import { readPath, type PathReader } from './paths.js';

const rank = (left: unknown, right: unknown): number => {
	if (left === right) return 0;
	if (left === null || left === undefined) return -1;
	if (right === null || right === undefined) return 1;

	if (typeof left === 'string' && typeof right === 'string') {
		return left.localeCompare(right);
	}
	if (typeof left === 'boolean' && typeof right === 'boolean') {
		return Number(left) - Number(right);
	}
	if (left instanceof Date && right instanceof Date) {
		return left.getTime() - right.getTime();
	}

	const difference = Number(left) - Number(right);
	return Number.isNaN(difference) ? 0 : difference;
};

/**
 * Order rows by a path.
 *
 * Keys are read once per row up front, so a sort costs one read per row even
 * when the path goes through a resolver.
 */
export const sortRows = async (
	reader: PathReader,
	rows: readonly unknown[],
	typeName: string,
	path: FieldPathNode,
	direction: 'asc' | 'desc'
): Promise<readonly unknown[]> => {
	const keyed = await Promise.all(
		rows.map(async (row) => ({
			row,
			key: await readPath(reader, row, typeName, path),
		}))
	);

	const sign = direction === 'desc' ? -1 : 1;
	return keyed
		.map((entry, index) => ({ ...entry, index }))
		.sort((left, right) => {
			const ordered = rank(left.key, right.key) * sign;
			return ordered === 0 ? left.index - right.index : ordered;
		})
		.map((entry) => entry.row);
};
