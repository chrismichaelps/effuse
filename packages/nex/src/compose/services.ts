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

import { mergeCatalogs } from '../catalog/merge.js';
import { alreadyNarrowed } from '../execution/narrowed.js';
import type { Catalog } from '../catalog/index.js';
import { NexErrorCode, NexExecutionError } from '../errors/index.js';
import type {
	ExecutionResult,
	LiveSources,
	NexScalars,
	Resolvers,
} from '../execution/index.js';
import type { SelectedField } from '../execution/resolvers.js';
import { Kind, type OperationType } from '../language/kinds/index.js';
import { namedTypeOf } from '../validation/type-utils.js';
import type { TypeNode } from '../language/ast/index.js';
import { printValue } from '../language/printer/index.js';
import { valueToNode } from '../language/value-to-node.js';

/** How to ask one service for something. */
export type NexServiceRequest = (payload: {
	readonly query: string;
	readonly variables?: Readonly<Record<string, unknown>> | undefined;
	/**
	 * Calls this one request off.
	 *
	 * Set when the run itself was called off, or when the service was given a
	 * deadline and it passed. Hand it to whatever actually does the sending,
	 * or the work carries on for an answer nobody will read.
	 */
	readonly signal?: AbortSignal | undefined;
}) => Promise<ExecutionResult> | ExecutionResult;

/** One service, and the part of the graph it serves. */
export interface NexService {
	/** What this service can answer, as its own catalog. */
	readonly catalog: Catalog;
	/** How to reach it. Anything that takes a request and answers. */
	readonly request: NexServiceRequest;
	/**
	 * Fetch one object of a type this service owns, by its reference.
	 *
	 * A type described here and held there is the ordinary shape of a graph
	 * made of services: a post knows its author exists and nothing about what
	 * one is. When a service answers such a field with a reference rather than
	 * an object, whoever owns the type is asked to turn it into one, and this
	 * is how.
	 *
	 * It is given what the request wanted of the object, so it can ask for
	 * that and no more. Answering `null` says the reference points at nothing.
	 */
	readonly resolveRef?:
		| ((
				reference: string,
				selection: readonly SelectedField[]
		  ) => Promise<unknown> | unknown)
		| undefined;
	/**
	 * How to watch it, when it serves live operations.
	 *
	 * A live field resolves through a source rather than a resolver, and a
	 * source is a stream: a service that cannot stream contributes no live
	 * fields at all, rather than one that looks served and never answers.
	 */
	readonly subscribe?:
		| ((payload: {
				readonly query: string;
				readonly variables?: Readonly<Record<string, unknown>> | undefined;
				readonly signal?: AbortSignal | undefined;
		  }) =>
				| AsyncIterable<ExecutionResult>
				| Promise<AsyncIterable<ExecutionResult>>)
		| undefined;
	/**
	 * How long to wait for it, in milliseconds.
	 *
	 * A gateway with no deadline is one slow service away from holding every
	 * request that touches it. Left out, this waits as long as the service
	 * takes, which is right only when something else is imposing the limit.
	 */
	readonly timeoutMs?: number | undefined;
}

/** How to compose. */
export interface ComposeOptions {
	/**
	 * The scalars this graph runs with.
	 *
	 * A service answers in the form its own scalars write, so what comes back
	 * is already written. Told what those scalars are, this reads them back
	 * into the form the graph holds them in - and the graph writes them once,
	 * on its way out, rather than twice.
	 */
	readonly scalars?: NexScalars | undefined;
}

/** What composing produced: one graph, and how to answer from it. */
export interface ComposedServices<TContext = unknown> {
	/** Every service's catalog, joined into the one a client sees. */
	readonly catalog: Catalog;
	/** Resolvers that send each root field to whichever service owns it. */
	readonly resolvers: Resolvers<TContext>;
	/** Live sources that watch whichever service owns each live field. */
	readonly sources: LiveSources<TContext>;
}

const OPERATIONS: readonly OperationType[] = ['query', 'mutation', 'live'];

/**
 * Write a selection back out as source.
 *
 * What a service is sent is what the caller asked for and nothing else, so
 * the selection a resolver was handed is rendered rather than the whole field
 * being fetched and thrown away. Arguments go out as the values they already
 * are, so a service is never sent a variable it would have to be told about.
 */
const renderArguments = (args: Readonly<Record<string, unknown>>): string => {
	const written = Object.entries(args);
	if (written.length === 0) return '';

	return `(${written
		.map(([key, value]) => `${key}: ${printValue(valueToNode(value))}`)
		.join(', ')})`;
};

/**
 * Write pipeline stages back out, so a service is asked for what the caller
 * asked for rather than for everything and narrowed afterwards.
 */
const renderPipeline = (stages: readonly string[]): string =>
	stages.length === 0 ? '' : ` | ${stages.join(' | ')}`;

const renderSelection = (fields: readonly SelectedField[]): string => {
	if (fields.length === 0) return '';

	// The answer comes back and is completed by the executor here, which reads
	// each field by its name in the catalog - so what a service is sent uses
	// those names, and the caller's own aliasing is applied on this side.
	const seen = new Set<string>();

	const written = fields.map((field) => {
		if (seen.has(field.name)) {
			throw new NexExecutionError({
				message: `"${field.name}" is asked for more than once under different names, which a field answered by another service cannot carry`,
				code: NexErrorCode.INTERNAL,
			});
		}
		seen.add(field.name);

		return `${field.name}${renderArguments(field.arguments)}${renderPipeline(
			field.pipeline
		)}${renderSelection(field.fields)}`;
	});

	return ` { ${written.join(' ')} }`;
};

/** What a service said, as something a resolver can hand back or throw. */
const answerOf = (result: ExecutionResult, responseKey: string): unknown => {
	const [problem] = result.errors ?? [];
	if (problem !== undefined) {
		throw new NexExecutionError({
			message: problem.message,
			code: NexErrorCode.INTERNAL,
		});
	}

	return result.data?.[responseKey] ?? null;
};

/**
 * Make one graph out of several services.
 *
 * Each service describes and answers the part it owns, and what they share -
 * an interface, a union, the roots - joins the way `mergeCatalogs` joins it.
 * A root field is answered by whichever service declares it: the field's own
 * selection is rendered back out and sent there, so a service is asked for
 * what the caller wanted rather than for everything it could give.
 *
 * A service is reached through whatever `request` does, so an HTTP client, a
 * handler in this process, and a queue all compose the same way and none of
 * them is what this depends on.
 *
 * Fields that reach across services - a type owned here holding a field owned
 * there - are not resolved for you: give the composed graph a resolver of its
 * own for those, using `parseRef` to say which object is wanted.
 */
export const composeServices = <TContext = unknown>(
	services: Readonly<Record<string, NexService>>,
	options: ComposeOptions = {}
): ComposedServices<TContext> => {
	const scalars = options.scalars ?? {};
	const entries = Object.values(services);
	if (entries.length === 0) {
		throw new NexExecutionError({
			message: 'Composing needs at least one service to compose',
			code: NexErrorCode.INTERNAL,
		});
	}

	const catalog = mergeCatalogs(...entries.map((service) => service.catalog));

	/** Which service will turn a reference to each type into an object. */
	const ownerOf = new Map<string, NexService>();
	for (const service of entries) {
		if (service.resolveRef === undefined) continue;
		for (const name of service.catalog.types.keys()) {
			if (!ownerOf.has(name)) ownerOf.set(name, service);
		}
	}

	const resolvers: Record<
		string,
		Record<string, (...args: never[]) => unknown>
	> = {};
	const sources: Record<
		string,
		Record<string, (...args: never[]) => unknown>
	> = {};

	for (const service of entries) {
		for (const operation of OPERATIONS) {
			const root = service.catalog.getRootType(operation);
			if (root === undefined) continue;

			// The composed graph may have joined this service's root onto
			// another's, so what a field is declared on here is not
			// necessarily what it answers under there.
			const answering = catalog.getRootType(operation)?.name.value;
			if (answering === undefined) continue;

			// A live field is watched rather than resolved, so it belongs to the
			// sources; a service that cannot stream contributes none.
			const live = operation === 'live';
			if (live && service.subscribe === undefined) continue;

			const owned = ((live ? sources : resolvers)[answering] ??= {});

			for (const field of root.fields ?? []) {
				const fieldName = field.name.value;

				// Two services answering one field is an ownership question
				// nobody here can settle, and picking whichever was listed
				// first would settle it by accident.
				if (fieldName in owned) {
					throw new NexExecutionError({
						message: `More than one service answers "${answering}.${fieldName}"; exactly one has to own it`,
						code: NexErrorCode.INTERNAL,
					});
				}

				owned[fieldName] = (
					live
						? (
								args: Readonly<Record<string, unknown>>,
								_context: unknown,
								info: Forwarding
							) =>
								watchOn(service, fieldName, args, info, (value) =>
									bringHome(value, field.type, catalog, scalars)
								)
						: async (
								_source: unknown,
								args: Readonly<Record<string, unknown>>,
								_context: unknown,
								info: Forwarding
							) => {
								const answer = bringHome(
									await sendTo(service, operation, fieldName, args, info),
									field.type,
									catalog,
									scalars
								);

								// The stages went out with the request, so what came
								// back is already narrowed.
								return info.pipeline.length === 0
									? answer
									: alreadyNarrowed(answer);
							}
				) as never;
			}
		}
	}

	// A field whose type another service owns is answered by that service,
	// given the reference the first one left in its place.
	for (const [typeName, definition] of catalog.types) {
		if (definition.kind !== Kind.OBJECT_TYPE_DEFINITION) continue;

		for (const field of definition.fields ?? []) {
			const owner = ownerOf.get(namedTypeOf(field.type));
			if (owner === undefined) continue;

			// Whether the service answering this field also owns the type it
			// returns needs no deciding here: one that answered with the
			// object is left alone by the join itself.

			const owned = (resolvers[typeName] ??= {});

			// A root field already has a resolver that forwards it, and its
			// answer is what needs joining - so this wraps that rather than
			// replacing it, and reads the source directly when there is none.
			const forwarding = owned[field.name.value];
			const fieldName = field.name.value;

			owned[fieldName] = (async (
				source: unknown,
				args: never,
				context: never,
				info: { readonly selection: () => readonly SelectedField[] }
			) => {
				const value =
					forwarding === undefined
						? readField(source, fieldName)
						: await forwarding(source as never, args, context, info as never);

				return join(owner, value, info);
			}) as never;
		}
	}

	return {
		catalog,
		resolvers: resolvers as Resolvers<TContext>,
		sources: sources as LiveSources<TContext>,
	};
};

/** Read one field off whatever a service answered with. */
const readField = (source: unknown, fieldName: string): unknown => {
	if (typeof source !== 'object' || source === null) return null;
	return (source as Record<string, unknown>)[fieldName];
};

/**
 * Turn the reference a service left behind into the object it stands for.
 *
 * A service that answered with the object itself has already done the work,
 * so only a reference is followed - which also keeps a service that happens
 * to hold both sides from making a round trip for nothing.
 */
const join = async (
	owner: NexService,
	value: unknown,
	info: { readonly selection: () => readonly SelectedField[] }
): Promise<unknown> => {
	if (typeof value !== 'string') return value ?? null;

	return (await owner.resolveRef?.(value, info.selection())) ?? null;
};

/**
 * One signal for the run being called off and the deadline running out.
 *
 * Written out rather than reaching for `AbortSignal.any` and
 * `AbortSignal.timeout`, so this behaves the same on a runtime that predates
 * them - the same reason cursors carry their own base64.
 */
const deadlineFor = (
	upstream: AbortSignal | undefined,
	timeoutMs: number | undefined
): { readonly signal: AbortSignal | undefined; readonly done: () => void } => {
	if (timeoutMs === undefined)
		return { signal: upstream, done: () => undefined };

	const controller = new AbortController();
	const timer = setTimeout(() => {
		controller.abort(new Error(`did not answer within ${String(timeoutMs)}ms`));
	}, timeoutMs);

	const passOn = (): void => {
		controller.abort(upstream?.reason);
	};

	if (upstream !== undefined) {
		if (upstream.aborted) passOn();
		else upstream.addEventListener('abort', passOn, { once: true });
	}

	return {
		signal: controller.signal,
		done: () => {
			clearTimeout(timer);
			upstream?.removeEventListener('abort', passOn);
		},
	};
};

/** A promise that ends as soon as the signal says to, and never otherwise. */
const refusedWhenCalledOff = (signal: AbortSignal): Promise<never> =>
	new Promise<never>((_resolve, reject) => {
		if (signal.aborted) {
			reject(signal.reason ?? new Error('called off'));
			return;
		}

		signal.addEventListener(
			'abort',
			() => reject(signal.reason ?? new Error('called off')),
			{ once: true }
		);
	});

/**
 * Read a service's answer back into the form this graph holds values in.
 *
 * What a service sends has already been written by its own scalars, and this
 * graph is about to write them again on the way out. Reading them back first
 * is what makes those two the same thing rather than one applied twice.
 *
 * Only the scalars this graph was told about are touched: everything else -
 * the scalars the language defines, an object, a page - is walked into or
 * passed through as it arrived.
 */
const bringHome = (
	value: unknown,
	type: TypeNode,
	catalog: Catalog,
	scalars: NexScalars
): unknown => {
	if (value === null || value === undefined) return value;

	if (type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.OPTIONAL_TYPE) {
		return bringHome(value, type.type, catalog, scalars);
	}

	if (type.kind === Kind.LIST_TYPE) {
		if (Array.isArray(value)) {
			return value.map((item) => bringHome(item, type.type, catalog, scalars));
		}

		// A paged field answers with the page shape rather than the rows, and
		// it is the rows the catalog describes.
		const page = value as { readonly items?: unknown };
		if (Array.isArray(page.items)) {
			return {
				...(value as Record<string, unknown>),
				items: page.items.map((item) =>
					bringHome(item, type.type, catalog, scalars)
				),
			};
		}

		return value;
	}

	const typeName = type.name.value;
	const scalar = scalars[typeName];
	if (scalar !== undefined) return scalar.parse(value);

	const definition = catalog.getType(typeName);
	if (
		definition === undefined ||
		typeof value !== 'object' ||
		Array.isArray(value)
	) {
		return value;
	}

	const record = value as Record<string, unknown>;
	const read: Record<string, unknown> = { ...record };

	for (const [key, held] of Object.entries(record)) {
		// A union or interface answers as whichever type it turned out to be,
		// which `__typename` is the only thing that says.
		const runtimeName =
			typeof record.__typename === 'string' ? record.__typename : typeName;
		const field = catalog.getField(runtimeName, key);
		if (field === undefined) continue;

		read[key] = bringHome(held, field.type, catalog, scalars);
	}

	return read;
};

/** What forwarding needs from the run it is part of. */
interface Forwarding {
	readonly selection: () => readonly SelectedField[];
	readonly pipeline: readonly string[];
	readonly signal?: AbortSignal | undefined;
}

/**
 * Watch one service for one live field, exactly as we were asked to.
 *
 * A live source hands back the value of the field it feeds, so each snapshot
 * the service sends is unwrapped to that field before it is passed on. A
 * snapshot carrying problems is thrown, which the run above reports the way
 * it reports any other failed field.
 */
const watchOn = async function* (
	service: NexService,
	fieldName: string,
	args: Readonly<Record<string, unknown>>,
	info: Forwarding,
	read: (value: unknown) => unknown
): AsyncGenerator<unknown> {
	const watch = service.subscribe;
	if (watch === undefined) return;

	const query = `live { ${fieldName}${renderArguments(args)}${renderPipeline(
		info.pipeline
	)}${renderSelection(info.selection())} }`;

	const frames = await watch({
		query,
		...(info.signal === undefined ? {} : { signal: info.signal }),
	});

	for await (const frame of frames) {
		yield read(answerOf(frame, fieldName));
	}
};

/** Ask one service for one field, exactly as it was asked of us. */
const sendTo = async (
	service: NexService,
	operation: OperationType,
	fieldName: string,
	args: Readonly<Record<string, unknown>>,
	info: Forwarding
): Promise<unknown> => {
	const query = `${operation} { ${fieldName}${renderArguments(
		args
	)}${renderPipeline(info.pipeline)}${renderSelection(info.selection())} }`;

	const deadline = deadlineFor(info.signal, service.timeoutMs);

	let result: ExecutionResult;
	try {
		const answering = Promise.resolve(
			service.request({
				query,
				...(deadline.signal === undefined ? {} : { signal: deadline.signal }),
			})
		);

		// A deadline that only works when the service cooperates is not a
		// deadline: one that ignores the signal must still not hold the
		// request, so waiting for it ends whether or not it does.
		result =
			deadline.signal === undefined
				? await answering
				: await Promise.race([
						answering,
						refusedWhenCalledOff(deadline.signal),
					]);
	} catch (cause) {
		// A service that was called off says so through whatever it threw; the
		// reason the deadline gave is the one worth reporting.
		const reason =
			deadline.signal?.aborted === true ? deadline.signal.reason : undefined;

		throw new NexExecutionError({
			message:
				reason instanceof Error
					? `"${fieldName}" ${reason.message}`
					: cause instanceof Error
						? cause.message
						: String(cause),
			code: NexErrorCode.INTERNAL,
			cause,
		});
	} finally {
		deadline.done();
	}

	return answerOf(result, fieldName);
};
