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

import {
	Schema,
	Effect,
	Either,
	Exit,
	Cause,
	ParseResult,
	Array as Arr,
	Option,
	Predicate,
	pipe,
} from 'effect';
import { Data } from 'effect';
import { CauseExtractionError } from '../errors.js';

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

export class PropsSchemaConflictError extends Data.TaggedError(
	'PropsSchemaConflictError'
)<{
	readonly componentName: string;
}> {
	get message(): string {
		return `[Effuse] Component "${this.componentName}" received different schemas through defineProps(schema) and propsSchema. Keep one schema as the source of truth.`;
	}
}

export interface PropDefinition<
	Output,
	Input = Output,
	Required extends boolean = boolean,
> {
	readonly schema: Schema.Schema<Output, Input>;
	readonly required: Required;
	readonly defaultValue?: Output;
	readonly _tag: 'PropDefinition';
}

export interface PropSchemaBuilder<
	Output extends Record<string, unknown>,
	Input extends Record<string, unknown> = Output,
> {
	readonly _schema: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- definitions retain their concrete types in the builder value.
		[K in keyof Output]: PropDefinition<any, any, boolean>;
	};
	readonly schema: Schema.Schema<Output, Input>;
	readonly validateSync: (props: unknown, componentName?: string) => Output;
}

export interface AnyPropSchemaBuilder {
	readonly validateSync: (props: unknown, componentName?: string) => unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- preserves each definition's invariant schema types during inference.
type AnyPropDefinition = PropDefinition<any, any, boolean>;
type PropDefinitionParts<P> =
	P extends PropDefinition<infer O, infer I, infer R> ? [O, I, R] : never;
type ExtractPropOutput<P> = PropDefinitionParts<P>[0];
type ExtractPropInput<P> = PropDefinitionParts<P>[1];
type RequiredDefinitionKeys<D> = {
	[K in keyof D]-?: PropDefinitionParts<D[K]>[2] extends true ? K : never;
}[keyof D];
type OptionalDefinitionKeys<D> = Exclude<keyof D, RequiredDefinitionKeys<D>>;
type SchemaOutput<D> = { [K in keyof D]: ExtractPropOutput<D[K]> };
type SchemaInput<D> = {
	[K in RequiredDefinitionKeys<D>]: ExtractPropInput<D[K]>;
} & {
	[K in OptionalDefinitionKeys<D>]?: ExtractPropInput<D[K]>;
};

// Build required prop definition
function required<S extends Schema.Schema.AnyNoContext>(
	schema: S
): PropDefinition<Schema.Schema.Type<S>, Schema.Schema.Encoded<S>, true>;
function required<
	O extends Record<string, unknown>,
	I extends Record<string, unknown>,
>(builder: PropSchemaBuilder<O, I>): PropDefinition<O, I, true>;
function required(
	schemaOrBuilder:
		| Schema.Schema.AnyNoContext
		| PropSchemaBuilder<Record<string, unknown>, Record<string, unknown>>
): AnyPropDefinition {
	if (
		Predicate.isObject(schemaOrBuilder) &&
		Predicate.hasProperty(schemaOrBuilder, 'validateSync') &&
		Predicate.hasProperty(schemaOrBuilder, 'schema')
	) {
		const builder = schemaOrBuilder;
		return {
			schema: builder.schema as Schema.Schema<unknown, unknown>,
			required: true,
			_tag: 'PropDefinition',
		};
	}
	return {
		schema: schemaOrBuilder as Schema.Schema<unknown, unknown>,
		required: true,
		_tag: 'PropDefinition',
	};
}

function optional<S extends Schema.Schema.AnyNoContext>(
	schema: S
): PropDefinition<
	Schema.Schema.Type<S> | undefined,
	Schema.Schema.Encoded<S> | undefined,
	false
>;
function optional<S extends Schema.Schema.AnyNoContext>(
	schema: S,
	defaultValue: Schema.Schema.Type<S>
): PropDefinition<
	Schema.Schema.Type<S>,
	Schema.Schema.Encoded<S> | undefined,
	false
>;
function optional<
	O extends Record<string, unknown>,
	I extends Record<string, unknown>,
>(
	builder: PropSchemaBuilder<O, I>
): PropDefinition<O | undefined, I | undefined, false>;
function optional<
	O extends Record<string, unknown>,
	I extends Record<string, unknown>,
>(
	builder: PropSchemaBuilder<O, I>,
	defaultValue: O
): PropDefinition<O, I | undefined, false>;
function optional(
	schemaOrBuilder:
		| Schema.Schema.AnyNoContext
		| PropSchemaBuilder<Record<string, unknown>, Record<string, unknown>>,
	defaultValue?: unknown
): AnyPropDefinition {
	let baseSchema: Schema.Schema<unknown, unknown>;

	if (
		Predicate.isObject(schemaOrBuilder) &&
		Predicate.hasProperty(schemaOrBuilder, 'validateSync') &&
		Predicate.hasProperty(schemaOrBuilder, 'schema')
	) {
		const builder = schemaOrBuilder;
		baseSchema = builder.schema as Schema.Schema<unknown, unknown>;
	} else {
		baseSchema = schemaOrBuilder as Schema.Schema<unknown, unknown>;
	}

	const schema = (defaultValue !== undefined
		? Schema.optional(baseSchema).pipe(
				Schema.withDecodingDefault(() => defaultValue)
			)
		: Schema.optional(baseSchema)) as unknown as Schema.Schema<
		unknown,
		unknown
	>;

	return {
		schema,
		required: false,
		defaultValue,
		_tag: 'PropDefinition',
	};
}

// Build property structure definition
const struct = <const D extends Record<string, AnyPropDefinition>>(
	definitions: D
): PropSchemaBuilder<SchemaOutput<D>, SchemaInput<D>> => {
	type ResultType = SchemaOutput<D>;
	type InputType = SchemaInput<D>;

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
			if (!Predicate.isObject(props)) {
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

				const { propName, message } = pipe(
					Arr.head(issues),
					Option.match({
						onNone: () => ({
							propName: 'unknown',
							message: 'Invalid prop value',
						}),
						onSome: (issue) => ({
							propName: issue.path.join('.'),
							message: issue.message,
						}),
					})
				);

				return yield* Effect.fail(
					new PropsValidationError({
						propName,
						componentName,
						message,
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
			throw new CauseExtractionError({ cause });
		}
		return exit.value;
	};

	return {
		_schema: definitions as {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime definitions preserve schema-specific variance.
			[K in keyof ResultType]: PropDefinition<any, any, boolean>;
		},
		schema: compositeSchema as unknown as Schema.Schema<ResultType, InputType>,
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

type PropSchemaParts<S> =
	S extends PropSchemaBuilder<infer O, infer I> ? [O, I] : never;
export type PropSchemaInfer<S> = PropSchemaParts<S>[0];
export type PropSchemaOutput<S> = PropSchemaParts<S>[0];
export type PropSchemaInput<S> = PropSchemaParts<S>[1];
