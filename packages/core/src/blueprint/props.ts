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

import { Schema, Effect, Either, Exit, Cause, ParseResult } from 'effect';
import { Data } from 'effect';

export class PropsValidationError extends Data.TaggedError(
	'PropsValidationError'
)<{
	readonly propName: string;
	readonly componentName: string | undefined;
	readonly message: string;
	readonly cause?: unknown;
}> {
	override toString(): string {
		return `PropsValidationError: Props validation failed for "${this.propName}": ${this.message}`;
	}
}

export interface PropDefinition<T> {
	readonly schema: Schema.Schema<T>;
	readonly required: boolean;
	readonly defaultValue?: T;
	readonly _tag: 'PropDefinition';
}

export interface PropSchemaBuilder<T extends Record<string, unknown>> {
	readonly _schema: {
		[K in keyof T]: PropDefinition<T[K]>;
	};
	readonly schema: Schema.Schema<T>;
	readonly validate: (
		props: unknown,
		componentName?: string
	) => Effect.Effect<T, PropsValidationError>;
	readonly validateSync: (props: unknown, componentName?: string) => T;
}

export interface AnyPropSchemaBuilder {
	readonly validateSync: (props: unknown, componentName?: string) => unknown;
}

type ExtractPropType<P> = P extends PropDefinition<infer T> ? T : never;

function required<T>(schema: Schema.Schema<T>): PropDefinition<T>;
function required<T extends Record<string, unknown>>(
	builder: PropSchemaBuilder<T>
): PropDefinition<T>;
/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-assertion */
function required<T>(
	schemaOrBuilder: Schema.Schema<T> | PropSchemaBuilder<Record<string, unknown>>
): PropDefinition<T> {
	if (
		typeof schemaOrBuilder === 'object' &&
		schemaOrBuilder !== null &&
		'validate' in schemaOrBuilder &&
		'schema' in schemaOrBuilder
	) {
		const builder = schemaOrBuilder as PropSchemaBuilder<
			Record<string, unknown>
		>;
		return {
			schema: builder.schema as unknown as Schema.Schema<T>,
			required: true,
			_tag: 'PropDefinition',
		};
	}
	return {
		schema: schemaOrBuilder as Schema.Schema<T>,
		required: true,
		_tag: 'PropDefinition',
	};
}

function optional<T>(
	schema: Schema.Schema<T>,
	defaultValue?: T
): PropDefinition<T | undefined>;
function optional<T extends Record<string, unknown>>(
	builder: PropSchemaBuilder<T>,
	defaultValue?: T
): PropDefinition<T | undefined>;
/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-assertion */
function optional<T>(
	schemaOrBuilder:
		| Schema.Schema<T>
		| PropSchemaBuilder<Record<string, unknown>>,
	defaultValue?: T
): PropDefinition<T | undefined> {
	let baseSchema: Schema.Schema<T>;

	if (
		typeof schemaOrBuilder === 'object' &&
		schemaOrBuilder !== null &&
		'validate' in schemaOrBuilder &&
		'schema' in schemaOrBuilder
	) {
		const builder = schemaOrBuilder as PropSchemaBuilder<
			Record<string, unknown>
		>;
		baseSchema = builder.schema as unknown as Schema.Schema<T>;
	} else {
		baseSchema = schemaOrBuilder as Schema.Schema<T>;
	}

	const schema = (defaultValue !== undefined
		? Schema.optional(baseSchema).pipe(
				Schema.withDecodingDefault(
					() => defaultValue as unknown as Exclude<T, undefined>
				)
			)
		: Schema.optional(baseSchema)) as unknown as Schema.Schema<T | undefined>;

	return {
		schema,
		required: false,
		defaultValue,
		_tag: 'PropDefinition',
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const struct = <const D extends Record<string, PropDefinition<any>>>(
	definitions: D
): PropSchemaBuilder<{ [K in keyof D]: ExtractPropType<D[K]> }> => {
	type ResultType = { [K in keyof D]: ExtractPropType<D[K]> };

	const schemaFields: Record<string, Schema.Schema<unknown>> = {};
	for (const [key, def] of Object.entries(definitions)) {
		schemaFields[key] = def.schema;
	}
	const compositeSchema = Schema.Struct(schemaFields);

	const validate = (
		props: unknown,
		componentName?: string
	): Effect.Effect<ResultType, PropsValidationError> =>
		Effect.gen(function* () {
			if (typeof props !== 'object' || props === null) {
				return yield* Effect.fail(
					new PropsValidationError({
						propName: 'props',
						componentName,
						message: 'Props must be an object',
					})
				);
			}

			const parseResult = Schema.decodeUnknownEither(compositeSchema)(props);

			if (Either.isLeft(parseResult)) {
				const error = parseResult.left;
				const issues = ParseResult.ArrayFormatter.formatErrorSync(error);
				const firstIssue = issues[0];

				return yield* Effect.fail(
					new PropsValidationError({
						propName: firstIssue?.path.join('.') ?? 'unknown',
						componentName,
						message: firstIssue?.message ?? 'Invalid prop value',
						cause: error,
					})
				);
			}

			return parseResult.right as ResultType;
		});

	const validateSync = (props: unknown, componentName?: string): ResultType => {
		const exit = Effect.runSyncExit(validate(props, componentName));
		if (Exit.isFailure(exit)) {
			const cause = exit.cause;
			const failure = Cause.failureOption(cause);
			if (failure._tag === 'Some') {
				throw failure.value;
			}
			throw new Error(String(cause));
		}
		return exit.value;
	};

	return {
		_schema: definitions as {
			[K in keyof ResultType]: PropDefinition<ResultType[K]>;
		},
		schema: compositeSchema as unknown as Schema.Schema<ResultType>,
		validate,
		validateSync,
	};
};

export const PropSchema = {
	required,
	optional,
	struct,

	String: Schema.String,
	Number: Schema.Number,
	Boolean: Schema.Boolean,
	Literal: Schema.Literal,
	Union: Schema.Union,
	Array: Schema.Array,
	Struct: Schema.Struct,
	Unknown: Schema.Unknown,
	Optional: Schema.optional,
};

export type PropSchemaInfer<S> =
	S extends PropSchemaBuilder<infer T> ? T : never;
