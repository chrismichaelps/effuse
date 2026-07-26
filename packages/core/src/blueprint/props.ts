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
	JSONSchema,
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

declare const PROP_VALUE_SCHEMA: unique symbol;

/** Opaque Effuse value schema. Its validation engine is an implementation detail. */
export interface PropValueSchema<Output, Input = Output> {
	readonly [PROP_VALUE_SCHEMA]: {
		readonly output: Output;
		readonly input: Input;
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous schema combinators preserve member types.
type AnyPropValueSchema = PropValueSchema<any, any>;
type PropValueSchemaParts<S> =
	S extends PropValueSchema<infer O, infer I>
		? [O, I]
		: S extends PropSchemaBuilder<infer O, infer I>
			? [O, I]
			: never;
type PropValueOutput<S> = PropValueSchemaParts<S>[0];
type PropValueInput<S> = PropValueSchemaParts<S>[1];

const wrapValueSchema = <O, I>(
	schema: Schema.Schema<O, I>
): PropValueSchema<O, I> => schema as unknown as PropValueSchema<O, I>;

const unwrapValueSchema = <O, I>(
	schema: PropValueSchema<O, I>
): Schema.Schema<O, I> => schema as unknown as Schema.Schema<O, I>;

export interface PropDefinition<
	Output,
	Input = Output,
	Required extends boolean = boolean,
> {
	readonly schema: PropValueSchema<Output, Input>;
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
	readonly schema: PropValueSchema<Output, Input>;
	readonly validateSync: (props: unknown, componentName?: string) => Output;
}

export interface AnyPropSchemaBuilder {
	readonly schema: PropValueSchema<unknown, unknown>;
	readonly validateSync: (props: unknown, componentName?: string) => unknown;
}

type AnyPropSchemaMember = AnyPropValueSchema | AnyPropSchemaBuilder;

const isPropSchemaBuilder = (
	schema: AnyPropSchemaMember
): schema is AnyPropSchemaBuilder =>
	Predicate.isObject(schema) &&
	Predicate.hasProperty(schema, 'validateSync') &&
	Predicate.hasProperty(schema, 'schema');

const normalizeSchemaMember = <S extends AnyPropSchemaMember>(
	schema: S
): PropValueSchema<PropValueOutput<S>, PropValueInput<S>> =>
	(isPropSchemaBuilder(schema) ? schema.schema : schema) as PropValueSchema<
		PropValueOutput<S>,
		PropValueInput<S>
	>;

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
function required<S extends AnyPropValueSchema>(
	schema: S
): PropDefinition<PropValueOutput<S>, PropValueInput<S>, true>;
function required<
	O extends Record<string, unknown>,
	I extends Record<string, unknown>,
>(builder: PropSchemaBuilder<O, I>): PropDefinition<O, I, true>;
function required(
	schemaOrBuilder:
		| AnyPropValueSchema
		| PropSchemaBuilder<Record<string, unknown>, Record<string, unknown>>
): AnyPropDefinition {
	if (isPropSchemaBuilder(schemaOrBuilder)) {
		const builder = schemaOrBuilder;
		return {
			schema: builder.schema as PropValueSchema<unknown, unknown>,
			required: true,
			_tag: 'PropDefinition',
		};
	}
	return {
		schema: schemaOrBuilder as PropValueSchema<unknown, unknown>,
		required: true,
		_tag: 'PropDefinition',
	};
}

function optional<S extends AnyPropValueSchema>(
	schema: S
): PropDefinition<
	PropValueOutput<S> | undefined,
	PropValueInput<S> | undefined,
	false
>;
function optional<S extends AnyPropValueSchema>(
	schema: S,
	defaultValue: PropValueOutput<S>
): PropDefinition<PropValueOutput<S>, PropValueInput<S> | undefined, false>;
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
		| AnyPropValueSchema
		| PropSchemaBuilder<Record<string, unknown>, Record<string, unknown>>,
	defaultValue?: unknown
): AnyPropDefinition {
	let baseSchema: Schema.Schema<unknown, unknown>;

	if (isPropSchemaBuilder(schemaOrBuilder)) {
		const builder = schemaOrBuilder;
		baseSchema = unwrapValueSchema(
			builder.schema as PropValueSchema<unknown, unknown>
		);
	} else {
		baseSchema = unwrapValueSchema(
			schemaOrBuilder as PropValueSchema<unknown, unknown>
		);
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
		schema: wrapValueSchema(schema),
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
		schemaFields[key] = unwrapValueSchema(def.schema);
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
		schema: wrapValueSchema(
			compositeSchema as unknown as Schema.Schema<ResultType, InputType>
		),
		validateSync,
	};
};

type LiteralValue = string | number | boolean | null | bigint;
type ValueObjectOutput<D> = { [K in keyof D]: PropValueOutput<D[K]> };
type ValueObjectInput<D> = { [K in keyof D]: PropValueInput<D[K]> };

const stringSchema = wrapValueSchema(Schema.String);
const numberSchema = wrapValueSchema(Schema.Number);
const booleanSchema = wrapValueSchema(Schema.Boolean);
const unknownSchema = wrapValueSchema(Schema.Unknown);
// A multipart upload field: validates the value is a `File` and types it as one,
// so a form-data contract can carry file uploads without hand-checking instances.
// The jsonSchema annotation lets OpenAPI generation represent it as binary.
const fileSchema = wrapValueSchema(
	Schema.instanceOf(File).annotations({
		jsonSchema: { type: 'string', format: 'binary' },
	})
);
const numberFromStringSchema = wrapValueSchema(Schema.NumberFromString);
const booleanFromStringSchema = wrapValueSchema(Schema.BooleanFromString);
const dateFromStringSchema = wrapValueSchema(Schema.DateFromString);

const literal = <const L extends readonly LiteralValue[]>(
	...values: L
): PropValueSchema<L[number]> =>
	wrapValueSchema(Schema.Literal(...values) as Schema.Schema<L[number]>);

const union = <const Members extends readonly AnyPropSchemaMember[]>(
	...members: Members
): PropValueSchema<
	PropValueOutput<Members[number]>,
	PropValueInput<Members[number]>
> =>
	wrapValueSchema(
		Schema.Union(
			...members.map((member) =>
				unwrapValueSchema(normalizeSchemaMember(member))
			)
		) as Schema.Schema<
			PropValueOutput<Members[number]>,
			PropValueInput<Members[number]>
		>
	);

const array = <S extends AnyPropSchemaMember>(
	item: S
): PropValueSchema<
	readonly PropValueOutput<S>[],
	readonly PropValueInput<S>[]
> =>
	wrapValueSchema(
		Schema.Array(
			unwrapValueSchema(normalizeSchemaMember(item))
		) as Schema.Schema<
			readonly PropValueOutput<S>[],
			readonly PropValueInput<S>[]
		>
	);

const object = <const D extends Record<string, AnyPropSchemaMember>>(
	fields: D
): PropValueSchema<ValueObjectOutput<D>, ValueObjectInput<D>> => {
	const schemas = Object.fromEntries(
		Object.entries(fields).map(([key, value]) => [
			key,
			unwrapValueSchema(normalizeSchemaMember(value)),
		])
	);
	return wrapValueSchema(
		Schema.Struct(schemas) as unknown as Schema.Schema<
			ValueObjectOutput<D>,
			ValueObjectInput<D>
		>
	);
};

export const PropSchema = {
	required,
	optional,
	struct,
	string: stringSchema,
	number: numberSchema,
	boolean: booleanSchema,
	unknown: unknownSchema,
	file: fileSchema,
	numberFromString: numberFromStringSchema,
	booleanFromString: booleanFromStringSchema,
	dateFromString: dateFromStringSchema,
	literal,
	union,
	array,
	object,

	// PascalCase aliases preserve the existing Effuse schema vocabulary.
	String: stringSchema,
	Number: numberSchema,
	Boolean: booleanSchema,
	Unknown: unknownSchema,
	NumberFromString: numberFromStringSchema,
	BooleanFromString: booleanFromStringSchema,
	DateFromString: dateFromStringSchema,
	Literal: literal,
	Union: union,
	Array: array,
	Struct: object,
};

/**
 * Produce a JSON Schema (draft-07) for a value schema or object-schema builder.
 * Used by OpenAPI generation to describe request/response contracts;
 * transformations (e.g. numberFromString) are described by their encoded/wire
 * form. A builder (from `object`/`struct`) is unwrapped via its `.schema`.
 */
export const toJsonSchema = (
	schema: PropValueSchema<unknown, unknown> | AnyPropSchemaBuilder
): Record<string, unknown> => {
	const valueSchema = normalizeSchemaMember(schema);
	return JSONSchema.make(
		unwrapValueSchema(valueSchema) as Schema.Schema<unknown, unknown>
	) as unknown as Record<string, unknown>;
};

type PropSchemaParts<S> =
	S extends PropSchemaBuilder<infer O, infer I> ? [O, I] : never;
export type PropSchemaInfer<S> = PropSchemaParts<S>[0];
export type PropSchemaOutput<S> = PropSchemaParts<S>[0];
export type PropSchemaInput<S> = PropSchemaParts<S>[1];
