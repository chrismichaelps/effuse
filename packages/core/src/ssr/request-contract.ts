import type {
	ServerValidationHelpers,
	ServerValidator,
} from './validation.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each request source retains its validator output.
type AnyServerValidator = ServerValidator<any>;
type ValidatorOutput<V> =
	V extends ServerValidator<infer Output> ? Output : never;
type Simplify<T> = { [K in keyof T]: T[K] };
type SourceOutput<Key extends string, Validator> =
	Validator extends AnyServerValidator
		? { readonly [K in Key]: ValidatorOutput<Validator> }
		: Record<never, never>;

type BodyDefinition<
	Json extends AnyServerValidator | undefined,
	FormData extends AnyServerValidator | undefined,
> =
	| { readonly json?: Json; readonly formData?: never }
	| { readonly json?: never; readonly formData?: FormData };

export type ServerRequestDefinition<
	Params extends AnyServerValidator | undefined = undefined,
	Query extends AnyServerValidator | undefined = undefined,
	Headers extends AnyServerValidator | undefined = undefined,
	Json extends AnyServerValidator | undefined = undefined,
	FormData extends AnyServerValidator | undefined = undefined,
> = {
	readonly params?: Params;
	readonly query?: Query;
	readonly headers?: Headers;
} & BodyDefinition<Json, FormData>;

export type ServerRequestOutput<
	Definition extends ServerRequestDefinition<
		AnyServerValidator | undefined,
		AnyServerValidator | undefined,
		AnyServerValidator | undefined,
		AnyServerValidator | undefined,
		AnyServerValidator | undefined
	>,
> = Simplify<
	SourceOutput<'params', Definition['params']> &
		SourceOutput<'query', Definition['query']> &
		SourceOutput<'headers', Definition['headers']> &
		SourceOutput<'json', Definition['json']> &
		SourceOutput<'formData', Definition['formData']>
>;

export interface ServerRequestContract<
	Definition extends ServerRequestDefinition<
		AnyServerValidator | undefined,
		AnyServerValidator | undefined,
		AnyServerValidator | undefined,
		AnyServerValidator | undefined,
		AnyServerValidator | undefined
	>,
> {
	readonly schemas: Readonly<Definition>;
	parse: (context: {
		readonly validate: ServerValidationHelpers;
	}) => Promise<ServerRequestOutput<Definition>>;
}

export const defineServerRequest = <
	const Definition extends ServerRequestDefinition<
		AnyServerValidator | undefined,
		AnyServerValidator | undefined,
		AnyServerValidator | undefined,
		AnyServerValidator | undefined,
		AnyServerValidator | undefined
	>,
>(definition: Definition): ServerRequestContract<Definition> => {
	if (definition.json && definition.formData) {
		throw new TypeError(
			'Effuse server request contracts cannot declare both json and formData bodies.'
		);
	}

	const schemas = Object.freeze({ ...definition }) as Readonly<Definition>;
	return Object.freeze({
		schemas,
		parse: async ({
			validate,
		}: {
			readonly validate: ServerValidationHelpers;
		}) => {
			const output: Record<string, unknown> = {};
			if (schemas.params) output.params = validate.params(schemas.params);
			if (schemas.query) output.query = validate.query(schemas.query);
			if (schemas.headers) output.headers = validate.headers(schemas.headers);
			if (schemas.json) output.json = await validate.json(schemas.json);
			if (schemas.formData) {
				output.formData = await validate.formData(schemas.formData);
			}
			return output as ServerRequestOutput<Definition>;
		},
	});
};
