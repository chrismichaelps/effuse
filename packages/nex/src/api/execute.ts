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
import { analyzeDocument, selectOperation } from '../analysis/index.js';
import type { Catalog } from '../catalog/index.js';
import { NexErrorCode, NexExecutionError } from '../errors/index.js';
import type {
	DocumentNode,
	FragmentDefinitionNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import {
	ErrorPolicy,
	type Authorize,
	type ExecutionResult,
	type Resolvers,
} from '../execution/index.js';
import { coerceVariableValues } from '../execution/index.js';
import { ExecutorService } from '../services/index.js';
import { parseSafe } from './parse.js';
import { runEitherPromise } from './runtime.js';
import {
	validateRequest,
	type RequestInput,
	type RequestLimits,
} from './validate-request.js';

/** Everything a run needs. */
export interface ExecuteOptions {
	/** The request: source text, or a document already parsed. */
	readonly request: RequestInput;
	/** The catalog the request is checked and run against. */
	readonly catalog: Catalog;
	/** Field resolvers, by type name. Anything missing reads the source value. */
	readonly resolvers?: Resolvers | undefined;
	/** Variable values supplied alongside the request. */
	readonly variables?: Readonly<Record<string, unknown>> | undefined;
	/** Which operation to run, when the document holds several. */
	readonly operationName?: string | undefined;
	/** The value the root fields resolve against. */
	readonly rootValue?: unknown;
	/** Passed to every resolver untouched: a request, a session, a loader set. */
	readonly context?: unknown;
	/** What to do with a field that fails. Defaults to `partial`. */
	readonly errorPolicy?: ErrorPolicy | undefined;
	/** Check the request against the catalog first. Defaults to `true`. */
	readonly validate?: boolean | undefined;
	/** Cost and depth limits to enforce before running. */
	readonly limits?: RequestLimits | undefined;
	/** Whether `__schema` and `__type` may be asked for. Defaults to `true`. */
	readonly introspection?: boolean | undefined;
	/**
	 * Decide whether a caller may have a field the catalog guards with `@auth`.
	 *
	 * Without one, a guarded field is refused rather than quietly resolved: a
	 * guard the server never checks is worse than no guard at all.
	 */
	readonly authorize?: Authorize | undefined;
	/**
	 * Rewrite every error before it leaves.
	 *
	 * A server that does not want internal detail on the wire replaces the
	 * message here; what the client sees is whatever this returns.
	 */
	readonly formatError?:
		| ((error: NexExecutionError) => NexExecutionError)
		| undefined;
}

/** Apply a server's error formatting, if it asked for any. */
export const formatErrors = (
	errors: readonly NexExecutionError[],
	format: ((error: NexExecutionError) => NexExecutionError) | undefined
): readonly NexExecutionError[] =>
	format === undefined ? errors : errors.map((error) => format(error));

const fragmentsOf = (
	document: DocumentNode
): ReadonlyMap<string, FragmentDefinitionNode> => {
	const fragments = new Map<string, FragmentDefinitionNode>();

	for (const definition of document.definitions) {
		if (definition.kind !== Kind.FRAGMENT_DEFINITION) continue;
		if (!fragments.has(definition.name.value)) {
			fragments.set(definition.name.value, definition);
		}
	}

	return fragments;
};

const refuse = (
	errors: readonly NexExecutionError[],
	format: ((error: NexExecutionError) => NexExecutionError) | undefined,
	cost = 0
): ExecutionResult => ({
	data: null,
	errors: formatErrors(errors, format),
	extensions: { cost },
});

/**
 * Run a request: parse it, check it, coerce its variables, then resolve it.
 *
 * The response follows specification section 7: the data that resolved, the
 * problems that stopped the rest, and what the request cost.
 */
export const execute = async (
	options: ExecuteOptions
): Promise<ExecutionResult> => {
	const parsed =
		typeof options.request === 'string'
			? parseSafe(options.request)
			: ({ success: true, document: options.request } as const);

	const format = options.formatError;

	if (!parsed.success) {
		return refuse(
			[
				new NexExecutionError({
					message: parsed.error.message,
					location: parsed.error.location,
					code: NexErrorCode.SYNTAX,
				}),
			],
			format
		);
	}

	const document = parsed.document;
	const suppliedVariables = options.variables ?? {};

	if (options.validate !== false) {
		const problems = validateRequest(document, options.catalog, {
			...options.limits,
			...(options.introspection === undefined
				? {}
				: { introspection: options.introspection }),
			variables: suppliedVariables,
			...(options.operationName === undefined
				? {}
				: { operationName: options.operationName }),
		});

		if (problems.length > 0) {
			return refuse(
				problems.map(
					(problem) =>
						new NexExecutionError({
							message: problem.message,
							path: problem.path,
							location: problem.location,
							code: problem.code,
						})
				),
				format
			);
		}
	}

	const operation = selectOperation(document, options.operationName);
	if (operation === undefined) {
		return refuse(
			[
				new NexExecutionError({
					message:
						options.operationName === undefined
							? 'The document defines no operation to run'
							: `The document defines no operation named "${options.operationName}"`,
				}),
			],
			format
		);
	}

	const coerced = coerceVariableValues(
		options.catalog,
		operation,
		suppliedVariables
	);
	if ('errors' in coerced) {
		return refuse(
			coerced.errors.map(
				(message) =>
					new NexExecutionError({ message, code: NexErrorCode.VARIABLE })
			),
			format
		);
	}

	const analysis = analyzeDocument(document, options.catalog, {
		variables: coerced.variables,
		...(options.operationName === undefined
			? {}
			: { operationName: options.operationName }),
	});

	const outcome = await runEitherPromise(
		Effect.gen(function* () {
			const executor = yield* ExecutorService;
			return yield* executor.run({
				catalog: options.catalog,
				resolvers: options.resolvers ?? {},
				fragments: fragmentsOf(document),
				operation,
				variables: coerced.variables,
				context: options.context,
				rootValue: options.rootValue ?? {},
				errorPolicy: options.errorPolicy ?? ErrorPolicy.PARTIAL,
				...(options.authorize === undefined
					? {}
					: { authorize: options.authorize }),
			});
		})
	);

	const errors = formatErrors(outcome.errors, format);

	return {
		data: outcome.data,
		...(errors.length === 0 ? {} : { errors }),
		extensions: { cost: analysis.cost },
	};
};
