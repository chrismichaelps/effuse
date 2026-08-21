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

import { NexErrorCode, NexExecutionError } from '../../errors/index.js';
import type { PipelineStageNode } from '../../language/ast/index.js';
import { Kind } from '../../language/kinds/index.js';
import { valueFromNode } from '../values.js';
import { evaluateCondition } from './filter.js';
import { paginate, type Page } from './page.js';
import type { PathReader } from './paths.js';
import { sortRows } from './sort.js';
import { uniqueRows } from './unique.js';

/** What a pipeline produced: plain rows, or a page of them. */
export type PipelineResult =
	| { readonly kind: 'rows'; readonly rows: readonly unknown[] }
	| { readonly kind: 'page'; readonly page: Page };

/**
 * A count a stage was given, or the reason it cannot be used.
 *
 * A negative one is refused rather than passed to `slice`, where it means
 * counting from the end: `take -1` would keep all but the last row and
 * `skip -1` only the last, neither of which is what anyone wrote. A literal
 * is caught before the request runs; this is where one that arrived in a
 * variable is caught.
 */
const readCount = (value: unknown, fallback: number, stage: string): number => {
	if (typeof value !== 'number' || !Number.isInteger(value)) return fallback;

	if (value < 0) {
		throw new NexExecutionError({
			message: `"| ${stage}" needs a count of none or more, found ${String(value)}`,
			code: NexErrorCode.VALIDATION,
		});
	}

	return value;
};

/**
 * Run the stages a field declared, in the order they were written.
 *
 * A `| page` stage ends the pipeline and turns the rows into a page, which is
 * why the result says which of the two it is.
 */
export const applyPipeline = async <TContext>(
	reader: PathReader<TContext>,
	rows: readonly unknown[],
	itemTypeName: string,
	stages: readonly PipelineStageNode[],
	variables: Readonly<Record<string, unknown>>,
	path: readonly (string | number)[]
): Promise<PipelineResult> => {
	let current = rows;

	for (const stage of stages) {
		switch (stage.kind) {
			case Kind.FILTER_STAGE: {
				const kept: unknown[] = [];
				for (const row of current) {
					const keep = await evaluateCondition(
						reader,
						row,
						itemTypeName,
						stage.condition,
						variables
					);
					if (keep) kept.push(row);
				}
				current = kept;
				break;
			}

			case Kind.SORT_STAGE:
				current = await sortRows(
					reader,
					current,
					itemTypeName,
					stage.field,
					stage.direction
				);
				break;

			case Kind.TAKE_STAGE:
				current = current.slice(
					0,
					readCount(
						valueFromNode(stage.count, variables),
						current.length,
						'take'
					)
				);
				break;

			case Kind.SKIP_STAGE:
				current = current.slice(
					readCount(valueFromNode(stage.count, variables), 0, 'skip')
				);
				break;

			case Kind.UNIQUE_STAGE:
				current = uniqueRows(current);
				break;

			case Kind.PAGE_STAGE:
				return {
					kind: 'page',
					page: paginate(current, stage, variables, path),
				};

			case Kind.CUSTOM_STAGE:
				break;
		}
	}

	return { kind: 'rows', rows: current };
};
