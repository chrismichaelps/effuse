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
	SelectionSetNode,
	TypeNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { BUILT_IN_SCALARS } from '../catalog/index.js';
import {
	isCompositeName,
	listItemType,
	namedTypeOf,
} from '../validation/type-utils.js';
import { authRequirement, type Authorize } from './authorize.js';
import {
	SCHEMA_FIELD,
	TYPE_FIELD,
	schemaValue,
	typeByNameValue,
} from '../introspection/index.js';
import { collectFields, mergeSelectionSets } from './collect.js';
import { applyPipeline } from './pipeline/apply.js';
import type { PathReader } from './pipeline/paths.js';
import {
	defaultFieldResolver,
	resolverFor,
	resolveTypeName,
	type FieldResolver,
	type ResolverInfo,
	type Resolvers,
} from './resolvers.js';
import { notify, type Instrumentation } from './instrumentation.js';
import { addPath, pathToArray, type ResponsePath } from './path.js';
import { ErrorPolicy } from './result.js';
import { coerceArgumentValues } from './values.js';

/** Shared by every field that takes no arguments, so none of them allocate. */
const NO_ARGUMENTS: Readonly<Record<string, unknown>> = Object.freeze(
	Object.create(null) as Record<string, unknown>
);

/** Thrown when a non-null field produced null, to bubble to a nullable parent. */
class NullBubble extends Error {
	constructor() {
		super('null bubbled from a non-null field');
	}
}

/** Thrown to abandon the run when the policy says to stop at the first error. */
class Abort extends Error {
	constructor(readonly failure: NexExecutionError) {
		super(failure.message);
	}
}

/** What the caller said when they called the run off. */
const abortReason = (signal: AbortSignal): string => {
	const reason: unknown = signal.reason;
	if (reason instanceof Error) return reason.message;
	if (typeof reason === 'string') return reason;
	return 'the caller went away';
};

/** Everything one run needs, gathered once. */
export interface ExecutionPlan<TContext = unknown> {
	readonly catalog: Catalog;
	readonly resolvers: Resolvers<TContext>;
	readonly fragments: ReadonlyMap<string, FragmentDefinitionNode>;
	readonly operation: OperationDefinitionNode;
	readonly variables: Readonly<Record<string, unknown>>;
	readonly context: TContext;
	readonly rootValue: unknown;
	readonly errorPolicy: ErrorPolicy;
	/** Decides whether a caller may have a field the catalog guards. */
	readonly authorize?: Authorize<TContext> | undefined;
	/** Calls the run off: the caller went away, or a deadline passed. */
	readonly signal?: AbortSignal | undefined;
	/** Where the run reports what it did. */
	readonly instrumentation?: Instrumentation | undefined;
}

/** What a run produced, before it is dressed up as a response. */
export interface ExecutionOutcome {
	readonly data: Record<string, unknown> | null;
	readonly errors: readonly NexExecutionError[];
}

/** The field whose children a mutation runs one after another. */
const TRANSACTION_FIELD = 'transaction';

const isSerialRoot = (operation: OperationDefinitionNode): boolean =>
	operation.operation === 'mutation';

/** Run one operation against its resolvers. */
export const executeOperation = async <TContext>(
	plan: ExecutionPlan<TContext>
): Promise<ExecutionOutcome> => {
	const errors: NexExecutionError[] = [];

	const record = (error: NexExecutionError): void => {
		const watcher = plan.instrumentation?.onFieldError;
		if (watcher !== undefined) notify(() => watcher(error));

		if (plan.errorPolicy === ErrorPolicy.FAIL_FAST) throw new Abort(error);
		if (plan.errorPolicy === ErrorPolicy.IGNORE) return;
		errors.push(error);
	};

	/**
	 * Stop the run if the caller has gone.
	 *
	 * Checked before each field rather than only at the start: a run that has
	 * already lost its reader should not keep resolving on its behalf.
	 */
	const stopIfCalledOff = (path: ResponsePath | undefined): void => {
		if (plan.signal?.aborted !== true) return;

		throw new Abort(
			new NexExecutionError({
				message: `The run was called off: ${abortReason(plan.signal)}`,
				path: pathToArray(path),
				code: NexErrorCode.ABORTED,
			})
		);
	};

	/**
	 * Which fields a selection set asks of a type, worked out once.
	 *
	 * A list of five thousand rows asks the same question of the same selection
	 * set five thousand times, and the answer cannot differ: the request is
	 * fixed, and so are the variables it was given. Working it out per row is
	 * the difference between reading the request once and reading it per row.
	 */
	const collected = new Map<
		SelectionSetNode,
		Map<string, ReadonlyMap<string, readonly FieldNode[]>>
	>();

	const fieldsFor = (
		runtimeTypeName: string,
		selectionSet: SelectionSetNode
	): ReadonlyMap<string, readonly FieldNode[]> => {
		let byType = collected.get(selectionSet);
		if (byType === undefined) {
			byType = new Map();
			collected.set(selectionSet, byType);
		}

		const already = byType.get(runtimeTypeName);
		if (already !== undefined) return already;

		const groups = collectFields(
			plan.catalog,
			runtimeTypeName,
			selectionSet,
			plan.variables,
			plan.fragments
		);
		byType.set(runtimeTypeName, groups);
		return groups;
	};

	/** What a type is, asked of the catalog once per run rather than per row. */
	const composite = new Map<string, boolean>();

	const isComposite = (typeName: string): boolean => {
		const already = composite.get(typeName);
		if (already !== undefined) return already;

		const answer = isCompositeName(plan.catalog, typeName);
		composite.set(typeName, answer);
		return answer;
	};

	const readerFor = (info: ResolverInfo): PathReader<TContext> => ({
		catalog: plan.catalog,
		resolvers: plan.resolvers,
		context: plan.context,
		info,
	});

	const completeLeaf = (
		value: unknown,
		typeName: string,
		path: ResponsePath | undefined
	): unknown => {
		const definition = plan.catalog.getType(typeName);

		if (definition?.kind === Kind.ENUM_TYPE_DEFINITION) {
			const members = new Set(
				(definition.values ?? []).map((member) => member.name.value)
			);
			const serialized = typeof value === 'string' ? value : String(value);
			if (!members.has(serialized)) {
				throw new NexExecutionError({
					message: `Value ${JSON.stringify(value)} is not a member of enum "${typeName}"`,
					path: pathToArray(path),
				});
			}
			return serialized;
		}

		if (!BUILT_IN_SCALARS.has(typeName)) return value;

		const refuse = (): never => {
			throw new NexExecutionError({
				message: `Field of type "${typeName}" cannot represent ${JSON.stringify(value) ?? String(value)}`,
				path: pathToArray(path),
			});
		};

		switch (typeName) {
			case 'ID':
				if (typeof value === 'string') return value;
				if (typeof value === 'number' && Number.isInteger(value)) {
					return String(value);
				}
				return refuse();
			case 'Int':
				return typeof value === 'number' && Number.isInteger(value)
					? value
					: refuse();
			case 'Float':
				return typeof value === 'number' && Number.isFinite(value)
					? value
					: refuse();
			case 'Boolean':
				return typeof value === 'boolean' ? value : refuse();
			case 'DateTime':
				if (value instanceof Date) return value.toISOString();
				return typeof value === 'string' ? value : refuse();
			default:
				return typeof value === 'string' ? value : refuse();
		}
	};

	const completeValue = async (
		value: unknown,
		type: TypeNode,
		fields: readonly FieldNode[],
		path: ResponsePath | undefined,
		serial: boolean
	): Promise<unknown> => {
		if (type.kind === Kind.NON_NULL_TYPE) {
			const completed = await completeValue(
				value,
				type.type,
				fields,
				path,
				serial
			);
			if (completed === null) {
				throw new NexExecutionError({
					message: `Cannot return null for non-null field "${fields[0]?.name.value ?? String(path?.key)}"`,
					path: pathToArray(path),
					code: NexErrorCode.NON_NULL,
				});
			}
			return completed;
		}

		if (type.kind === Kind.OPTIONAL_TYPE) {
			return completeValue(value, type.type, fields, path, serial);
		}

		if (value === null || value === undefined) return null;

		if (type.kind === Kind.LIST_TYPE) {
			if (!Array.isArray(value)) {
				throw new NexExecutionError({
					message: `Expected a list for "${String(path?.key)}", received ${typeof value}`,
					path: pathToArray(path),
				});
			}

			const items: unknown[] = [];
			for (const [index, item] of value.entries()) {
				items.push(
					await completeValue(
						item,
						type.type,
						fields,
						addPath(path, index),
						serial
					)
				);
			}
			return items;
		}

		const typeName = type.name.value;

		if (!isComposite(typeName)) {
			return completeLeaf(value, typeName, path);
		}

		const runtimeTypeName =
			plan.catalog.getType(typeName)?.kind === Kind.OBJECT_TYPE_DEFINITION
				? typeName
				: resolveTypeName(
						plan.catalog,
						plan.resolvers,
						typeName,
						value,
						plan.context
					);

		if (runtimeTypeName === undefined) {
			throw new NexExecutionError({
				message: `Cannot tell which type "${typeName}" resolved to; add __typename to the value or a __resolveType resolver`,
				path: pathToArray(path),
			});
		}

		const selectionSet = mergeSelectionSets(fields);
		if (selectionSet === undefined) return {};

		return executeSelectionSet(
			runtimeTypeName,
			selectionSet,
			value,
			path,
			serial
		);
	};

	const rootName = plan.catalog.getRootType(plan.operation.operation)?.name
		.value;

	/** Whether a meta field written here would be one the root answers. */
	const parentIsRoot = (fieldName: string): boolean =>
		rootName !== undefined &&
		(fieldName === SCHEMA_FIELD || fieldName === TYPE_FIELD);

	/**
	 * `__schema` and `__type` are answered from the catalog, unless the
	 * resolvers say otherwise, so introspection works with no extra wiring.
	 */
	/** Read a field off the value, the way a field with no resolver is read. */
	const readProperty = (
		source: unknown,
		fieldName: string,
		args: Readonly<Record<string, unknown>>,
		infoFor: () => ResolverInfo
	): unknown => {
		if (
			parentIsRoot(fieldName) &&
			(fieldName === SCHEMA_FIELD || fieldName === TYPE_FIELD)
		) {
			return fieldName === SCHEMA_FIELD
				? schemaValue(plan.catalog)
				: typeByNameValue(plan.catalog, args.name);
		}

		if (source === null || typeof source !== 'object') return undefined;

		const property = (source as Record<string, unknown>)[fieldName];
		return typeof property === 'function'
			? (property as FieldResolver<TContext>)(
					source,
					args,
					plan.context,
					infoFor()
				)
			: property;
	};

	const resolveFieldValue = (
		parentTypeName: string,
		fieldName: string,
		source: unknown,
		args: Readonly<Record<string, unknown>>,
		info: ResolverInfo
	): unknown => {
		const resolve = resolverFor(plan.resolvers, parentTypeName, fieldName);
		return resolve(source, args, plan.context, info);
	};

	const executeField = async (
		parentTypeName: string,
		fields: readonly FieldNode[],
		source: unknown,
		path: ResponsePath | undefined,
		serial: boolean
	): Promise<unknown> => {
		const field = fields[0];
		if (field === undefined) return null;

		stopIfCalledOff(path);

		const fieldName = field.name.value;
		if (fieldName === '__typename') return parentTypeName;

		const definition = plan.catalog.getField(parentTypeName, fieldName);
		if (definition === undefined) return null;

		const supplied = plan.resolvers[parentTypeName]?.[fieldName];

		/**
		 * Built only for a resolver that was actually supplied.
		 *
		 * Most fields on most rows have none: they read the property of the
		 * same name off the value, and building an info object for each of
		 * them is the largest thing a run does for nobody.
		 */
		const infoFor = (): ResolverInfo => ({
			fieldName,
			parentTypeName,
			path: pathToArray(path),
			operation: plan.operation.operation,
			variables: plan.variables,
			catalog: plan.catalog,
		});

		// A guarded field is asked about before anything of it runs, so a
		// refusal never reaches a resolver.
		const guard = authRequirement(definition);
		if (guard !== undefined) {
			if (plan.authorize === undefined) {
				throw new NexExecutionError({
					message: `"${parentTypeName}.${fieldName}" is guarded by @auth and this server has no authorizer configured`,
					path: pathToArray(path),
					code: NexErrorCode.FORBIDDEN,
				});
			}

			const allowed = await plan.authorize({
				requires: guard.requires,
				fieldName,
				parentTypeName,
				coordinate: `${parentTypeName}.${fieldName}`,
				path: pathToArray(path),
				context: plan.context,
			});

			if (!allowed) {
				throw new NexExecutionError({
					message:
						guard.requires === undefined
							? `"${parentTypeName}.${fieldName}" is not available to this caller`
							: `"${parentTypeName}.${fieldName}" requires "${guard.requires}"`,
					path: pathToArray(path),
					code: NexErrorCode.FORBIDDEN,
				});
			}
		}

		const declaredArguments = definition.arguments;
		const args =
			(declaredArguments === undefined || declaredArguments.length === 0) &&
			(field.arguments === undefined || field.arguments.length === 0)
				? NO_ARGUMENTS
				: coerceArgumentValues(definition, field.arguments, plan.variables);

		const produced =
			supplied === undefined
				? readProperty(source, fieldName, args, infoFor)
				: resolveFieldValue(parentTypeName, fieldName, source, args, infoFor());
		const resolved = await produced;

		// A transaction runs its fields in order; everything below a mutation
		// root is otherwise free to resolve concurrently.
		const childrenSerial =
			serial &&
			(plan.operation.operation === 'mutation'
				? fieldName === TRANSACTION_FIELD
				: false);

		const stages = field.pipeline;
		if (stages === undefined || stages.length === 0) {
			return completeValue(
				resolved,
				definition.type,
				fields,
				path,
				childrenSerial
			);
		}

		const rows = Array.isArray(resolved) ? resolved : [];
		const itemType = listItemType(definition.type);
		const itemTypeName = itemType === undefined ? '' : namedTypeOf(itemType);
		const outcome = await applyPipeline(
			// A pipeline reads paths through resolvers, so it needs the same
			// information a resolver is given.
			readerFor(infoFor()),
			rows,
			itemTypeName,
			stages,
			plan.variables,
			pathToArray(path)
		);

		if (outcome.kind === 'rows') {
			return completeValue(
				outcome.rows,
				definition.type,
				fields,
				path,
				childrenSerial
			);
		}

		const items = await completeValue(
			outcome.page.items,
			definition.type,
			fields,
			addPath(path, 'items'),
			childrenSerial
		);

		return {
			items,
			pageInfo: outcome.page.pageInfo,
			totalCount: outcome.page.totalCount,
		};
	};

	const runField = async (
		parentTypeName: string,
		responseKey: string,
		fields: readonly FieldNode[],
		source: unknown,
		path: ResponsePath | undefined,
		into: Record<string, unknown>,
		serial: boolean
	): Promise<void> => {
		const fieldPath = addPath(path, responseKey);
		const definition = plan.catalog.getField(
			parentTypeName,
			fields[0]?.name.value ?? ''
		);
		const isNonNull = definition?.type.kind === Kind.NON_NULL_TYPE;

		try {
			into[responseKey] = await executeField(
				parentTypeName,
				fields,
				source,
				fieldPath,
				serial
			);
		} catch (cause) {
			if (cause instanceof Abort) throw cause;

			if (cause instanceof NullBubble) {
				if (isNonNull) throw cause;
				into[responseKey] = null;
				return;
			}

			const failure =
				cause instanceof NexExecutionError
					? cause
					: new NexExecutionError({
							message: cause instanceof Error ? cause.message : String(cause),
							path: pathToArray(fieldPath),
							code: NexErrorCode.RESOLVER,
							...(fields[0]?.loc === undefined
								? {}
								: {
										location: {
											start: fields[0].loc.start,
											line: fields[0].loc.line,
											column: fields[0].loc.column,
										},
									}),
							cause,
						});

			record(failure);
			if (isNonNull) throw new NullBubble();
			into[responseKey] = null;
		}
	};

	const executeSelectionSet = async (
		parentTypeName: string,
		selectionSet: SelectionSetNode,
		source: unknown,
		path: ResponsePath | undefined,
		serial: boolean
	): Promise<Record<string, unknown>> => {
		// A response key is whatever the request wrote, `__proto__` included,
		// so the object it is written into starts with no prototype at all.
		const groups = fieldsFor(parentTypeName, selectionSet);
		const into = Object.create(null) as Record<string, unknown>;

		let bubbled = false;

		const runOne = async (
			responseKey: string,
			fields: readonly FieldNode[]
		): Promise<void> => {
			try {
				await runField(
					parentTypeName,
					responseKey,
					fields,
					source,
					path,
					into,
					serial
				);
			} catch (cause) {
				if (!(cause instanceof NullBubble)) throw cause;
				bubbled = true;
			}
		};

		if (serial) {
			for (const [responseKey, fields] of groups) {
				await runOne(responseKey, fields);
			}
		} else {
			const pending: Promise<void>[] = [];
			for (const [responseKey, fields] of groups) {
				pending.push(runOne(responseKey, fields));
			}
			await Promise.all(pending);
		}

		if (bubbled) throw new NullBubble();
		return into;
	};

	const rootType = plan.catalog.getRootType(plan.operation.operation);
	if (rootType === undefined) {
		return {
			data: null,
			errors: [
				new NexExecutionError({
					message: `The catalog defines no ${plan.operation.operation} root type`,
				}),
			],
		};
	}

	if (plan.signal?.aborted === true) {
		return {
			data: null,
			errors: [
				new NexExecutionError({
					message: `The run was called off: ${abortReason(plan.signal)}`,
					code: NexErrorCode.ABORTED,
				}),
			],
		};
	}

	try {
		const data = await executeSelectionSet(
			rootType.name.value,
			plan.operation.selectionSet,
			plan.rootValue,
			undefined,
			isSerialRoot(plan.operation)
		);
		return { data, errors };
	} catch (cause) {
		if (cause instanceof Abort) return { data: null, errors: [cause.failure] };
		if (cause instanceof NullBubble) return { data: null, errors };

		const failure =
			cause instanceof NexExecutionError
				? cause
				: new NexExecutionError({
						message: cause instanceof Error ? cause.message : String(cause),
						cause,
					});
		return { data: null, errors: [...errors, failure] };
	}
};

/** Re-exported so callers can build a source object with no resolvers at all. */
export { defaultFieldResolver };
