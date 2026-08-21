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

import type { Catalog } from '../catalog/index.js';
import { NexErrorCode, NexExecutionError } from '../errors/index.js';
import type {
	FieldNode,
	FragmentDefinitionNode,
	OperationDefinitionNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { collectFields } from './collect.js';
import {
	executeOperation,
	type ExecutionOutcome,
	type ExecutionPlan,
} from './execute.js';
import { authRequirement } from './authorize.js';
import type { ResolverInfo } from './resolvers.js';
import { coerceArgumentValues } from './values.js';

/** Where the events of a live field come from. */
export type LiveSource<TContext = unknown> = (
	args: Readonly<Record<string, unknown>>,
	context: TContext,
	info: ResolverInfo
) => AsyncIterable<unknown> | Promise<AsyncIterable<unknown>>;

/** Live sources by type name, then field name. */
export type LiveSources<TContext = unknown> = Readonly<
	Record<string, Readonly<Record<string, LiveSource<TContext>>>>
>;

/** The one field a live operation watches, once fragments are flattened. */
export const liveRootField = (
	catalog: Catalog,
	operation: OperationDefinitionNode,
	rootTypeName: string,
	variables: Readonly<Record<string, unknown>>,
	fragments: ReadonlyMap<string, FragmentDefinitionNode>
): { readonly responseKey: string; readonly field: FieldNode } | undefined => {
	const groups = collectFields(
		catalog,
		rootTypeName,
		operation.selectionSet,
		variables,
		fragments
	);

	for (const [responseKey, fields] of groups) {
		const field = fields[0];
		if (field !== undefined) return { responseKey, field };
	}

	return undefined;
};

/**
 * Open the stream a live operation watches, then run the selection set once
 * per event, handing back a full snapshot each time.
 *
 * Differential updates are a transport concern; what this produces is the
 * same response shape a query would, over and over.
 */
export const executeLive = async function* <TContext>(
	plan: ExecutionPlan<TContext>,
	sources: LiveSources<TContext>
): AsyncGenerator<Awaited<ReturnType<typeof executeOperation>>> {
	const rootType = plan.catalog.getRootType(plan.operation.operation);
	if (rootType === undefined) {
		yield {
			data: null,
			errors: [
				new NexExecutionError({
					message: 'The catalog defines no live root type',
				}),
			],
		};
		return;
	}

	const rootTypeName = rootType.name.value;
	const selected = liveRootField(
		plan.catalog,
		plan.operation,
		rootTypeName,
		plan.variables,
		plan.fragments
	);

	if (selected === undefined) {
		yield {
			data: null,
			errors: [
				new NexExecutionError({
					message: 'A live operation must watch exactly one field',
				}),
			],
		};
		return;
	}

	const fieldName = selected.field.name.value;
	const source = sources[rootTypeName]?.[fieldName];

	if (source === undefined) {
		yield {
			data: null,
			errors: [
				new NexExecutionError({
					message: `No live source for field "${fieldName}" on type "${rootTypeName}"`,
					path: [selected.responseKey],
				}),
			],
		};
		return;
	}

	const definition = plan.catalog.getField(rootTypeName, fieldName);
	if (definition === undefined) return;

	// Read through a call rather than a check: `aborted` flips while the loop
	// runs, and a narrowed check would be answered once and never again.
	const calledOffNow = (): boolean => plan.signal?.aborted === true;

	const calledOff = (): ExecutionOutcome => ({
		data: null,
		errors: [
			new NexExecutionError({
				message: 'The run was called off: the caller went away',
				path: [selected.responseKey],
				code: NexErrorCode.ABORTED,
			}),
		],
	});

	if (calledOffNow()) {
		yield calledOff();
		return;
	}

	// A guarded stream is refused before it is opened: a source that starts
	// producing for a caller who may not read it is a leak, not an error.
	const guard = authRequirement(definition);
	if (guard !== undefined) {
		const refusal = (message: string): ExecutionOutcome => ({
			data: null,
			errors: [
				new NexExecutionError({
					message,
					path: [selected.responseKey],
					code: NexErrorCode.FORBIDDEN,
				}),
			],
		});

		if (plan.authorize === undefined) {
			yield refusal(
				`"${rootTypeName}.${fieldName}" is guarded by @auth and this server has no authorizer configured`
			);
			return;
		}

		const allowed = await plan.authorize({
			requires: guard.requires,
			fieldName,
			parentTypeName: rootTypeName,
			coordinate: `${rootTypeName}.${fieldName}`,
			path: [selected.responseKey],
			context: plan.context,
		});

		if (!allowed) {
			yield refusal(
				guard.requires === undefined
					? `"${rootTypeName}.${fieldName}" is not available to this caller`
					: `"${rootTypeName}.${fieldName}" requires "${guard.requires}"`
			);
			return;
		}
	}

	const info: ResolverInfo = {
		fieldName,
		parentTypeName: rootTypeName,
		path: [selected.responseKey],
		operation: plan.operation.operation,
		variables: plan.variables,
		catalog: plan.catalog,
		...(plan.signal === undefined ? {} : { signal: plan.signal }),
		// A live source is opened before anything of the field is resolved, so
		// what was asked for below it is not yet worked out here.
		selection: () => [],
		...(plan.resumeFrom === undefined ? {} : { resumeFrom: plan.resumeFrom }),
	};

	const args = coerceArgumentValues(
		definition,
		selected.field.arguments,
		plan.variables
	);

	let events: AsyncIterable<unknown>;
	try {
		events = await source(args, plan.context, info);
	} catch (cause) {
		yield {
			data: null,
			errors: [
				new NexExecutionError({
					message: cause instanceof Error ? cause.message : String(cause),
					path: [selected.responseKey],
					cause,
				}),
			],
		};
		return;
	}

	// A source that fails part way through has to be reported the way a field
	// failure is: a broker dropping its connection ends the stream, it does not
	// throw out of the loop a server is reading.
	const reading = events[Symbol.asyncIterator]();

	for (;;) {
		if (calledOffNow()) {
			await reading.return?.().catch(() => undefined);
			return;
		}

		let step: IteratorResult<unknown>;
		try {
			step = await reading.next();
		} catch (cause) {
			yield {
				data: null,
				errors: [
					new NexExecutionError({
						message: cause instanceof Error ? cause.message : String(cause),
						path: [selected.responseKey],
						code: NexErrorCode.INTERNAL,
						cause,
					}),
				],
			};
			return;
		}

		if (step.done === true) return;
		const event = step.value;

		// Each event stands in for the field's own value, so the snapshot runs
		// with a root that already holds it.
		yield await executeOperation({
			...plan,
			rootValue: { [fieldName]: event },
		});
	}
};

/** Whether an operation is one that streams. */
export const isLiveOperation = (operation: OperationDefinitionNode): boolean =>
	operation.operation === 'live' &&
	operation.kind === Kind.OPERATION_DEFINITION;
