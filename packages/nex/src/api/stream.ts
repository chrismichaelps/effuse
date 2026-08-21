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

import { analyzeDocument, selectOperation } from '../analysis/index.js';
import type { ExecutionResult } from '../execution/index.js';
import type {
	DocumentNode,
	OperationDefinitionNode,
	SelectionNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { execute, type ExecuteOptions } from './execute.js';
import { parseSafe } from './parse.js';

/** Everything a progressive run needs. */
export interface StreamOptions<
	TContext = unknown,
> extends ExecuteOptions<TContext> {
	/**
	 * What a root field has to cost before it is worth waiting for separately.
	 *
	 * Left out, this is an ordinary run that answers once. Given a number,
	 * anything the catalog prices above it is sent after the rest rather than
	 * holding it up - so a page with one expensive field paints without it and
	 * fills in when it lands.
	 *
	 * The catalog already says what a field costs, so nothing has to be
	 * annotated for this and no request has to be rewritten to ask for it.
	 */
	readonly deferOver?: number | undefined;
}

/** One root field of a request, and what the catalog prices it at. */
interface Priced {
	readonly selection: SelectionNode;
	readonly cost: number;
}

/** A document carrying one operation with only the selections given. */
const narrowedTo = (
	document: DocumentNode,
	operation: OperationDefinitionNode,
	selections: readonly SelectionNode[]
): DocumentNode => ({
	...document,
	definitions: document.definitions.map((definition) =>
		definition === operation
			? {
					...operation,
					selectionSet: { ...operation.selectionSet, selections },
				}
			: definition
	),
});

/**
 * Run a request, sending what is ready before what is slow.
 *
 * A response is only as quick as the slowest thing in it, and a page with one
 * expensive field waits for it before showing anything. This answers with what
 * is ready and sends the rest as it lands, each snapshot carrying everything
 * known so far - so a reader replaces what it has rather than piecing anything
 * together, and the last one is the whole answer it would have waited for.
 *
 * What waits is decided by what the catalog already prices a field at, so
 * nothing is annotated for this and no request is written differently to ask
 * for it. A run given no threshold answers once, exactly as `execute` does.
 *
 * Fields are separated at the root, where they are independent of one another:
 * nothing is resolved twice to make this work.
 */
export const stream = async function* <
	TData extends object = Record<string, unknown>,
	TContext = unknown,
>(options: StreamOptions<TContext>): AsyncGenerator<ExecutionResult<TData>> {
	const parsed =
		typeof options.request === 'string'
			? parseSafe(options.request)
			: ({ success: true, document: options.request } as const);

	const operation = parsed.success
		? selectOperation(parsed.document, options.operationName)
		: undefined;

	// Anything this cannot take apart is an ordinary run: a request that does
	// not parse, one with no threshold, one that is not a query.
	if (
		options.deferOver === undefined ||
		!parsed.success ||
		operation === undefined ||
		operation.operation !== 'query'
	) {
		yield await execute<TData, TContext>(options);
		return;
	}

	const document = parsed.document;
	const threshold = options.deferOver;

	const priced: Priced[] = operation.selectionSet.selections.map(
		(selection) => ({
			selection,
			cost:
				selection.kind === Kind.FIELD
					? analyzeDocument(
							narrowedTo(document, operation, [selection]),
							options.catalog,
							{
								...(options.variables === undefined
									? {}
									: { variables: options.variables }),
								...(options.operationName === undefined
									? {}
									: { operationName: options.operationName }),
							}
						).cost
					: 0,
		})
	);

	const ready = priced.filter((one) => one.cost <= threshold);
	const waiting = priced.filter((one) => one.cost > threshold);

	if (waiting.length === 0) {
		yield await execute<TData, TContext>(options);
		return;
	}

	// Cheapest first among the ones worth waiting for, so the next thing a
	// reader sees is the soonest thing there is.
	waiting.sort((left, right) => left.cost - right.cost);

	let known: Record<string, unknown> = {};

	const run = async (
		selections: readonly SelectionNode[]
	): Promise<ExecutionResult<TData>> =>
		execute<TData, TContext>({
			...options,
			request: narrowedTo(document, operation, selections),
			validate: false,
		});

	if (ready.length > 0) {
		const first = await run(ready.map((one) => one.selection));
		if (first.data === null) {
			yield first;
			return;
		}

		known = { ...first.data };
		yield { ...first, data: known as TData };
	}

	for (const late of waiting) {
		const next = await run([late.selection]);
		known = { ...known, ...next.data };

		yield {
			...next,
			data: known as TData,
		};
	}
};
