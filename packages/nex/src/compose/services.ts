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
import type { Catalog } from '../catalog/index.js';
import { NexErrorCode, NexExecutionError } from '../errors/index.js';
import type {
	ExecutionResult,
	LiveSources,
	Resolvers,
} from '../execution/index.js';
import type { SelectedField } from '../execution/resolvers.js';
import type { OperationType } from '../language/kinds/index.js';
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

		return `${field.name}${renderArguments(field.arguments)}${renderSelection(
			field.fields
		)}`;
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
	services: Readonly<Record<string, NexService>>
): ComposedServices<TContext> => {
	const entries = Object.values(services);
	if (entries.length === 0) {
		throw new NexExecutionError({
			message: 'Composing needs at least one service to compose',
			code: NexErrorCode.INTERNAL,
		});
	}

	const catalog = mergeCatalogs(...entries.map((service) => service.catalog));
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
							) => watchOn(service, fieldName, args, info)
						: (
								_source: unknown,
								args: Readonly<Record<string, unknown>>,
								_context: unknown,
								info: Forwarding
							) => sendTo(service, operation, fieldName, args, info)
				) as never;
			}
		}
	}

	return {
		catalog,
		resolvers: resolvers as Resolvers<TContext>,
		sources: sources as LiveSources<TContext>,
	};
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

/** What forwarding needs from the run it is part of. */
interface Forwarding {
	readonly selection: () => readonly SelectedField[];
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
	info: Forwarding
): AsyncGenerator<unknown> {
	const watch = service.subscribe;
	if (watch === undefined) return;

	const query = `live { ${fieldName}${renderArguments(args)}${renderSelection(
		info.selection()
	)} }`;

	const frames = await watch({
		query,
		...(info.signal === undefined ? {} : { signal: info.signal }),
	});

	for await (const frame of frames) {
		yield answerOf(frame, fieldName);
	}
};

/** Ask one service for one field, exactly as it was asked of us. */
const sendTo = async (
	service: NexService,
	operation: OperationType,
	fieldName: string,
	args: Readonly<Record<string, unknown>>,
	info: {
		readonly selection: () => readonly SelectedField[];
		readonly signal?: AbortSignal | undefined;
	}
): Promise<unknown> => {
	const query = `${operation} { ${fieldName}${renderArguments(args)}${renderSelection(
		info.selection()
	)} }`;

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
