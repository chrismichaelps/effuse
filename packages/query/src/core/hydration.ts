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

import type { QueryKey, QueryState } from './types.js';

/** A single dehydrated query entry. */
export interface DehydratedQuery<TData = unknown, TError = unknown> {
	readonly queryHash: string;
	readonly queryKey: QueryKey;
	readonly state: QueryState<TData, TError>;
}

/** The full dehydrated state of a QueryCache. */
export interface DehydratedState {
	readonly queries: DehydratedQuery[];
}

/** Serializer for a specific type. */
export interface TypeSerializer<T> {
	readonly name: string;
	readonly serialize: (value: T) => unknown;
	readonly deserialize: (value: unknown) => T;
	readonly isInstance: (value: unknown) => value is T;
}

const BUILTIN_SERIALIZERS: TypeSerializer<unknown>[] = [
	{
		name: 'Date',
		serialize: (value) => (value as Date).toISOString(),
		deserialize: (value) => new Date(value as string),
		isInstance: (value): value is Date => value instanceof Date,
	},
	{
		name: 'Error',
		serialize: (value) => {
			const err = value as Error;
			return { message: err.message, stack: err.stack, name: err.name };
		},
		deserialize: (value) => {
			const obj = value as { message: string; stack?: string; name?: string };
			const err = new Error(obj.message);
			if (obj.stack !== undefined) {
				err.stack = obj.stack;
			}
			err.name = obj.name ?? 'Error';
			return err;
		},
		isInstance: (value): value is Error => value instanceof Error,
	},
];

/**
 * Marks a plain object that already carries the wrapper keys.
 *
 * Without it, `deserializeValue` cannot tell a wrapper this module produced
 * from user data that merely looks like one, and `{ __type: 'Date', __value }`
 * came back from hydration as a real `Date`.
 */
const RAW_MARKER = '__effuse_raw';

const looksLikeWrapper = (value: object): boolean =>
	'__type' in value && '__value' in value;

/** Recurse into an object's values without re-testing the object itself. */
const serializeProps = (
	value: object,
	serializers: TypeSerializer<unknown>[]
): Record<string, unknown> => {
	const result: Record<string, unknown> = {};
	for (const key of Object.keys(value)) {
		result[key] = serializeValue(
			(value as Record<string, unknown>)[key],
			serializers
		);
	}
	return result;
};

const serializeValue = (
	value: unknown,
	serializers: TypeSerializer<unknown>[]
): unknown => {
	if (value === null || value === undefined) return value;
	if (typeof value !== 'object') return value;

	for (const serializer of serializers) {
		if (serializer.isInstance(value)) {
			return { __type: serializer.name, __value: serializer.serialize(value) };
		}
	}

	if (Array.isArray(value)) {
		return value.map((item) => serializeValue(item, serializers));
	}

	// Escaped rather than emitted as-is: an object shaped like a wrapper is
	// indistinguishable from one on the way back. Escaping is applied to the
	// object itself and its values are serialised separately, so an object that
	// looks like the escape marker escapes too rather than recursing forever.
	if (looksLikeWrapper(value)) {
		return { __type: RAW_MARKER, __value: serializeProps(value, serializers) };
	}

	return serializeProps(value, serializers);
};

const deserializeValue = (
	value: unknown,
	serializers: TypeSerializer<unknown>[]
): unknown => {
	if (value === null || value === undefined) return value;
	if (typeof value !== 'object') return value;

	if (looksLikeWrapper(value)) {
		const typeName = (value as Record<string, unknown>).__type as string;
		const innerValue = (value as Record<string, unknown>).__value;

		// An escaped object is user data that happened to look like a wrapper:
		// unwrap one level and return it as the plain object it always was.
		if (typeName === RAW_MARKER) {
			return deserializeProps(innerValue as object, serializers);
		}

		const serializer = serializers.find((s) => s.name === typeName);
		if (serializer) {
			return serializer.deserialize(innerValue);
		}
	}

	if (Array.isArray(value)) {
		return value.map((item) => deserializeValue(item, serializers));
	}

	return deserializeProps(value, serializers);
};

/** Recurse into an object's values without re-testing the object itself. */
function deserializeProps(
	value: object,
	serializers: TypeSerializer<unknown>[]
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const key of Object.keys(value)) {
		result[key] = deserializeValue(
			(value as Record<string, unknown>)[key],
			serializers
		);
	}
	return result;
}

/** Options for dehydrate and hydrate. */
export interface DehydrateOptions {
	/** Custom type serializers for non-JSON values (Date, Map, Set, etc.). */
	readonly serializers?: TypeSerializer<unknown>[];
}

/** Serialize a QueryCache's state to a plain JSON-compatible object. */
export const dehydrate = <TData = unknown, TError = Error>(
	queries: ReadonlyArray<{
		readonly queryHash: string;
		readonly queryKey: QueryKey;
		readonly currentState: QueryState<TData, TError>;
	}>,
	options?: DehydrateOptions
): DehydratedState => {
	const serializers = [...BUILTIN_SERIALIZERS, ...(options?.serializers ?? [])];

	return {
		queries: queries.map((query) => ({
			queryHash: query.queryHash,
			queryKey: query.queryKey,
			state: {
				...query.currentState,
				data:
					query.currentState.data !== undefined
						? (serializeValue(query.currentState.data, serializers) as TData)
						: undefined,
				error:
					query.currentState.error !== null
						? (serializeValue(query.currentState.error, serializers) as TError)
						: null,
			},
		})),
	};
};

/** Restore a QueryCache's state from a dehydrated object. */
export const hydrate = <TData = unknown, TError = Error>(
	state: DehydratedState,
	options?: DehydrateOptions
): DehydratedQuery<TData, TError>[] => {
	const serializers = [...BUILTIN_SERIALIZERS, ...(options?.serializers ?? [])];

	return state.queries.map((query) => ({
		queryHash: query.queryHash,
		queryKey: query.queryKey,
		state: {
			...query.state,
			data:
				query.state.data !== undefined
					? (deserializeValue(query.state.data, serializers) as TData)
					: undefined,
			error:
				query.state.error !== null
					? (deserializeValue(query.state.error, serializers) as TError)
					: null,
		},
	}));
};
