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
import { NexErrorCode, NexExecutionError } from '../errors/index.js';
import type {
	DocumentNode,
	FragmentDefinitionNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import {
	ErrorPolicy,
	LiveDelivery,
	diffValues,
	coerceVariableValues,
	executeLive,
	type ExecutionResult,
	type LiveSources,
} from '../execution/index.js';
import { parseSafe } from './parse.js';
import { formatErrors, type ExecuteOptions } from './execute.js';
import { validateRequest } from './validate-request.js';

/** Everything a live run needs. */
export interface SubscribeOptions extends Omit<ExecuteOptions, 'rootValue'> {
	/** Where each live field's events come from, by type then field name. */
	readonly sources: LiveSources;
	/**
	 * Whether every event carries the whole response, or only what changed.
	 *
	 * Defaults to `snapshot`. With `differential`, the first event carries the
	 * whole response and the rest carry a patch against the one before, which
	 * a client applies with `applyPatch`.
	 */
	readonly delivery?: LiveDelivery | undefined;
}

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

const refusal = (
	message: string,
	format: SubscribeOptions['formatError'],
	code: NexErrorCode = NexErrorCode.INTERNAL
): ExecutionResult => ({
	data: null,
	errors: formatErrors([new NexExecutionError({ message, code })], format),
	extensions: { cost: 0 },
});

/**
 * Watch a live operation.
 *
 * Returns a stream of full snapshots, one per event, each shaped like any
 * other response. Stop reading the stream and the source is closed with it.
 */
export const subscribe = async function* (
	options: SubscribeOptions
): AsyncGenerator<ExecutionResult> {
	const parsed =
		typeof options.request === 'string'
			? parseSafe(options.request)
			: ({ success: true, document: options.request } as const);

	const format = options.formatError;

	if (!parsed.success) {
		yield refusal(parsed.error.message, format, NexErrorCode.SYNTAX);
		return;
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
			yield {
				data: null,
				errors: formatErrors(
					problems.map(
						(problem) =>
							new NexExecutionError({
								message: problem.message,
								path: problem.path,
								location: problem.location,
							})
					),
					format
				),
				extensions: { cost: 0 },
			};
			return;
		}
	}

	const operation = selectOperation(document, options.operationName);
	if (operation === undefined) {
		yield refusal('The document defines no operation to watch', format);
		return;
	}

	if (operation.operation !== 'live') {
		yield refusal(
			`Only a live operation can be watched; this document holds a ${operation.operation}`,
			format
		);
		return;
	}

	const coerced = coerceVariableValues(
		options.catalog,
		operation,
		suppliedVariables
	);
	if ('errors' in coerced) {
		yield {
			data: null,
			errors: formatErrors(
				coerced.errors.map(
					(message) =>
						new NexExecutionError({ message, code: NexErrorCode.VARIABLE })
				),
				format
			),
			extensions: { cost: 0 },
		};
		return;
	}

	const analysis = analyzeDocument(document, options.catalog, {
		variables: coerced.variables,
		...(options.operationName === undefined
			? {}
			: { operationName: options.operationName }),
	});

	const snapshots = executeLive(
		{
			catalog: options.catalog,
			resolvers: options.resolvers ?? {},
			fragments: fragmentsOf(document),
			operation,
			variables: coerced.variables,
			context: options.context,
			rootValue: {},
			errorPolicy: options.errorPolicy ?? ErrorPolicy.PARTIAL,
			...(options.authorize === undefined
				? {}
				: { authorize: options.authorize }),
		},
		options.sources
	);

	const differential = options.delivery === LiveDelivery.DIFFERENTIAL;
	let previous: Record<string, unknown> | undefined;

	for await (const outcome of snapshots) {
		const errors = formatErrors(outcome.errors, format);
		const extensions = { cost: analysis.cost };

		// A snapshot that failed has nothing to describe changes against, so
		// the next one that succeeds is sent whole again.
		if (!differential || outcome.data === null) {
			if (outcome.data === null) previous = undefined;
			else if (differential) previous = outcome.data;

			yield {
				data: outcome.data,
				...(errors.length === 0 ? {} : { errors }),
				extensions,
			};
			continue;
		}

		if (previous === undefined) {
			previous = outcome.data;
			yield {
				data: outcome.data,
				...(errors.length === 0 ? {} : { errors }),
				extensions,
			};
			continue;
		}

		const patch = diffValues(previous, outcome.data);
		previous = outcome.data;

		yield {
			patch,
			...(errors.length === 0 ? {} : { errors }),
			extensions,
		};
	}
};
