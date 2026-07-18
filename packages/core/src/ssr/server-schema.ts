import {
	PropSchema,
	type PropDefinition,
	type PropSchemaBuilder,
	type PropValueSchema,
} from '../blueprint/props.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- schema combinators preserve concrete member types.
type AnyValueSchema = PropValueSchema<any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- object schemas preserve concrete field types.
type AnyObjectSchema = PropSchemaBuilder<any, any>;
type AnyServerSchema = AnyValueSchema | AnyObjectSchema;

type SchemaParts<S> =
	S extends PropValueSchema<infer Output, infer Input>
		? [Output, Input]
		: S extends PropSchemaBuilder<infer Output, infer Input>
			? [Output, Input]
			: never;

export type ServerSchemaOutput<S> = SchemaParts<S>[0];
export type ServerSchemaInput<S> = SchemaParts<S>[1];
export type ServerSchemaInfer<S> = ServerSchemaOutput<S>;

const SERVER_OPTIONAL_SCHEMA: unique symbol = Symbol.for(
	'effuse.server-schema.optional'
);

export interface ServerOptionalSchema<
	S extends AnyServerSchema,
	HasDefault extends boolean = boolean,
> {
	readonly [SERVER_OPTIONAL_SCHEMA]: true;
	readonly schema: S;
	readonly defaultValue?: ServerSchemaOutput<S>;
	readonly hasDefault: HasDefault;
}

type OptionalKeys<D> = {
	[K in keyof D]-?: D[K] extends ServerOptionalSchema<AnyServerSchema>
		? K
		: never;
}[keyof D];
type RequiredKeys<D> = Exclude<keyof D, OptionalKeys<D>>;
type FieldSchema<F> = F extends ServerOptionalSchema<infer S, boolean> ? S : F;
type FieldOutput<F> =
	F extends ServerOptionalSchema<infer S, infer HasDefault>
		? HasDefault extends true
			? ServerSchemaOutput<S>
			: ServerSchemaOutput<S> | undefined
		: ServerSchemaOutput<F>;
type FieldInput<F> = ServerSchemaInput<FieldSchema<F>>;

type Simplify<T> = { -readonly [K in keyof T]: T[K] };
type ServerObjectOutput<D> = Simplify<{
	[K in keyof D]: FieldOutput<D[K]>;
}>;
type ServerObjectInput<D> = Simplify<
	{
		[K in RequiredKeys<D>]: FieldInput<D[K]>;
	} & {
		[K in OptionalKeys<D>]?: FieldInput<D[K]>;
	}
>;

function optional<S extends AnyServerSchema>(
	schema: S
): ServerOptionalSchema<S, false>;
function optional<S extends AnyServerSchema>(
	schema: S,
	defaultValue: ServerSchemaOutput<S>
): ServerOptionalSchema<S, true>;
function optional<S extends AnyServerSchema>(
	schema: S,
	defaultValue?: ServerSchemaOutput<S>
): ServerOptionalSchema<S, boolean> {
	return {
		[SERVER_OPTIONAL_SCHEMA]: true,
		schema,
		defaultValue,
		hasDefault: arguments.length === 2,
	};
}

const isOptional = (
	field: AnyServerSchema | ServerOptionalSchema<AnyServerSchema>
): field is ServerOptionalSchema<AnyServerSchema> =>
	typeof field === 'object' &&
	field !== null &&
	SERVER_OPTIONAL_SCHEMA in field;

const object = <
	const D extends Record<
		string,
		AnyServerSchema | ServerOptionalSchema<AnyServerSchema>
	>,
>(
	fields: D
): PropSchemaBuilder<ServerObjectOutput<D>, ServerObjectInput<D>> => {
	const definitions: Record<
		string,
		PropDefinition<unknown, unknown, boolean>
	> = {};

	for (const [name, field] of Object.entries(fields)) {
		if (!isOptional(field)) {
			definitions[name] = PropSchema.required(field as AnyValueSchema);
			continue;
		}
		definitions[name] = field.hasDefault
			? PropSchema.optional(field.schema as AnyValueSchema, field.defaultValue)
			: PropSchema.optional(field.schema as AnyValueSchema);
	}

	return PropSchema.struct(definitions) as PropSchemaBuilder<
		ServerObjectOutput<D>,
		ServerObjectInput<D>
	>;
};

export const serverSchema = {
	string: PropSchema.string,
	number: PropSchema.number,
	boolean: PropSchema.boolean,
	unknown: PropSchema.unknown,
	numberFromString: PropSchema.numberFromString,
	booleanFromString: PropSchema.booleanFromString,
	dateFromString: PropSchema.dateFromString,
	literal: PropSchema.literal,
	union: PropSchema.union,
	array: PropSchema.array,
	object,
	optional,
};
