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

import type { PropValueSchema } from '../blueprint/props.js';
import { toJsonSchema } from '../blueprint/props.js';
import {
	parseRoutePattern,
	type RoutePatternParam,
} from '../routing/route-pattern.js';
import type { HttpMethod } from '../layers/types.js';
import type { AnyTypedServerRoute } from './route-contract.js';
import { isStreamResponse } from './response-contract.js';

type JsonObject = Record<string, unknown>;

export interface OpenApiInfo {
	readonly title: string;
	readonly version: string;
	readonly description?: string;
}

export interface OpenApiDocument {
	readonly openapi: '3.1.0';
	readonly info: OpenApiInfo;
	readonly paths: Record<string, Record<string, JsonObject>>;
	readonly components?: { readonly schemas: Record<string, JsonObject> };
}

type RouteMap =
	| Record<string, AnyTypedServerRoute>
	| readonly AnyTypedServerRoute[];

type AnyValueSchema = PropValueSchema<unknown, unknown>;

const BINARY_SCHEMA: JsonObject = { type: 'string', format: 'binary' };

interface TemplatePath {
	readonly path: string;
	readonly params: ReadonlySet<string>;
}

/** Convert the complete Effuse route grammar into valid OpenAPI path variants. */
const toTemplatePaths = (source: string): readonly TemplatePath[] => {
	const pattern = parseRoutePattern(source);
	if (pattern.urlSegments.some((segment) => segment.kind === 'wildcard')) {
		throw new TypeError(
			`Effuse OpenAPI cannot describe unnamed wildcard route "${source}". Use a named catch-all parameter.`
		);
	}

	let variants: { segments: string[]; params: Set<string> }[] = [
		{ segments: [], params: new Set() },
	];
	for (const segment of pattern.urlSegments) {
		if (segment.kind === 'static') {
			variants = variants.map((variant) => ({
				...variant,
				segments: [...variant.segments, segment.value],
			}));
			continue;
		}
		if (segment.kind !== 'param') continue;
		const included = variants.map((variant) => ({
			segments: [...variant.segments, `{${segment.name}}`],
			params: new Set([...variant.params, segment.name]),
		}));
		variants = segment.optional ? [...variants, ...included] : included;
	}

	return variants.map((variant) => ({
		path: variant.segments.length > 0 ? `/${variant.segments.join('/')}` : '/',
		params: variant.params,
	}));
};

/**
 * Rewrite JSON Schema `#/$defs/X` pointers to OpenAPI `#/components/schemas/X`.
 * Effect emits shared/named schemas as `$defs`; OpenAPI keeps them under
 * `components.schemas`, so every `$ref` is repointed as definitions are hoisted.
 */
const rewriteRefs = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map(rewriteRefs);
	}
	if (value !== null && typeof value === 'object') {
		const out: JsonObject = {};
		for (const [key, entry] of Object.entries(value)) {
			out[key] =
				key === '$ref' && typeof entry === 'string'
					? entry.replace('#/$defs/', '#/components/schemas/')
					: rewriteRefs(entry);
		}
		return out;
	}
	return value;
};

/**
 * Produce an OpenAPI schema object for a value schema, hoisting its `$defs` into
 * the shared `components` accumulator and dropping JSON-Schema-only keys
 * (`$schema`, `$defs`) that OpenAPI does not carry on inline schemas.
 */
const toSchemaObject = (
	schema: AnyValueSchema,
	components: Record<string, JsonObject>,
	context: string
): JsonObject => {
	let raw: JsonObject & { readonly $defs?: Record<string, JsonObject> };
	try {
		raw = toJsonSchema(schema) as JsonObject & {
			readonly $defs?: Record<string, JsonObject>;
		};
	} catch (cause) {
		throw new TypeError(
			`Effuse OpenAPI cannot describe ${context}. Use a JSON-Schema-compatible serverSchema contract.`,
			{ cause }
		);
	}
	const { $schema: _schema, $defs, ...body } = raw;
	void _schema;
	if ($defs) {
		for (const [name, definition] of Object.entries($defs)) {
			const rewritten = rewriteRefs(definition) as JsonObject;
			const existing = components[name];
			if (existing && JSON.stringify(existing) !== JSON.stringify(rewritten)) {
				throw new TypeError(
					`Effuse OpenAPI component schema "${name}" has conflicting definitions.`
				);
			}
			components[name] = rewritten;
		}
	}
	return rewriteRefs(body) as JsonObject;
};

/**
 * Flatten a source object schema (params/query/headers) into individual OpenAPI
 * parameters. Path parameters are always required per the spec.
 */
const parametersFrom = (
	schema: AnyValueSchema | undefined,
	location: 'path' | 'query' | 'header',
	components: Record<string, JsonObject>,
	context: string,
	pathParams: ReadonlyMap<string, RoutePatternParam> = new Map(),
	includedPathParams?: ReadonlySet<string>
): JsonObject[] => {
	if (!schema) {
		return [];
	}
	const object = toSchemaObject(schema, components, context);
	const properties = (object.properties as Record<string, JsonObject>) ?? {};
	const required = new Set((object.required as string[] | undefined) ?? []);
	return Object.entries(properties)
		.filter(([name]) => !includedPathParams || includedPathParams.has(name))
		.map(([name, propertySchema]) => ({
			name,
			in: location,
			required: location === 'path' ? true : required.has(name),
			schema: propertySchema,
			...(pathParams.get(name)?.catchAll ? { 'x-effuse-catch-all': true } : {}),
		}));
};

interface RequestSchemas {
	readonly params?: AnyValueSchema;
	readonly query?: AnyValueSchema;
	readonly headers?: AnyValueSchema;
	readonly json?: AnyValueSchema;
	readonly formData?: AnyValueSchema;
}

const buildOperation = (
	route: AnyTypedServerRoute,
	method: HttpMethod,
	components: Record<string, JsonObject>,
	pathParams: ReadonlyMap<string, RoutePatternParam>,
	includedPathParams: ReadonlySet<string>
): JsonObject => {
	const request = (route.request?.schemas ?? {}) as RequestSchemas;
	const operation: JsonObject = {};

	const parameters = [
		...parametersFrom(
			request.params,
			'path',
			components,
			`${route.path} path parameters`,
			pathParams,
			includedPathParams
		),
		...parametersFrom(
			request.query,
			'query',
			components,
			`${route.path} query parameters`
		),
		...parametersFrom(
			request.headers,
			'header',
			components,
			`${route.path} header parameters`
		),
	];
	if (parameters.length > 0) {
		operation.parameters = parameters;
	}

	if (request.json) {
		operation.requestBody = {
			required: true,
			content: {
				'application/json': {
					schema: toSchemaObject(
						request.json,
						components,
						`${route.path} JSON request body`
					),
				},
			},
		};
	} else if (request.formData) {
		operation.requestBody = {
			required: true,
			content: {
				'multipart/form-data': {
					schema: toSchemaObject(
						request.formData,
						components,
						`${route.path} form-data request body`
					),
				},
			},
		};
	}

	const responses: JsonObject = {};
	const successStatus = String(route.metadata?.status ?? 200);
	const hasResponseBody = method !== 'HEAD' && successStatus !== '204';
	const contentType = Object.entries(route.metadata?.headers ?? {}).find(
		([name]) => name.toLowerCase() === 'content-type'
	)?.[1];
	if (isStreamResponse(route.response) && hasResponseBody) {
		responses[successStatus] = {
			description: 'OK',
			content: {
				[contentType ?? 'application/octet-stream']: {
					schema: { ...BINARY_SCHEMA },
				},
			},
		};
	} else if (route.response && hasResponseBody) {
		responses[successStatus] = {
			description: 'OK',
			content: {
				'application/json': {
					schema: toSchemaObject(
						route.response as unknown as AnyValueSchema,
						components,
						`${route.path} response body`
					),
				},
			},
		};
	} else {
		responses[successStatus] = { description: 'OK' };
	}
	if (route.errors) {
		// The error contract carries no status code, so it maps to the catch-all
		// `default` response rather than a specific 4xx/5xx.
		responses.default = {
			description: 'Error',
			content: {
				'application/json': {
					schema: toSchemaObject(
						route.errors as unknown as AnyValueSchema,
						components,
						`${route.path} error response body`
					),
				},
			},
		};
	}
	operation.responses = responses;

	return operation;
};

/**
 * Generate an OpenAPI 3.1 document from a set of typed server routes. Each route's
 * request contract becomes parameters and a request body, its response contract
 * (or streaming marker) becomes a `200`, and its error contract becomes the
 * `default` response. Shared named schemas are hoisted into `components.schemas`.
 *
 * The public surface stays pure Effuse: routes are described from their own
 * contracts, with no separate schema language to maintain.
 */
export const generateOpenApiDocument = (
	routes: RouteMap,
	info: OpenApiInfo
): OpenApiDocument => {
	const list = Array.isArray(routes)
		? routes
		: Object.values(routes as Record<string, AnyTypedServerRoute>);
	const components: Record<string, JsonObject> = {};
	const paths: Record<string, Record<string, JsonObject>> = {};

	for (const route of list) {
		const pattern = parseRoutePattern(route.path);
		const pathParams = new Map(
			pattern.params.map((param) => [param.name, param])
		);
		const request = (route.request?.schemas ?? {}) as RequestSchemas;
		const parameterSchema = request.params
			? toSchemaObject(
					request.params,
					components,
					`${route.path} path parameters`
				)
			: undefined;
		const schemaParamNames = new Set(
			Object.keys(
				(parameterSchema?.properties as
					| Record<string, JsonObject>
					| undefined) ?? {}
			)
		);
		for (const name of pathParams.keys()) {
			if (!schemaParamNames.has(name)) {
				throw new TypeError(
					`Effuse OpenAPI route "${route.path}" is missing request.params schema field "${name}".`
				);
			}
		}
		for (const name of schemaParamNames) {
			if (!pathParams.has(name)) {
				throw new TypeError(
					`Effuse OpenAPI route "${route.path}" declares non-route params field "${name}".`
				);
			}
		}

		for (const template of toTemplatePaths(route.path)) {
			const pathItem = paths[template.path] ?? (paths[template.path] = {});
			for (const methodName of Object.keys(route.methods)) {
				const method = methodName as HttpMethod;
				const key = method.toLowerCase();
				if (pathItem[key]) {
					throw new TypeError(
						`Effuse OpenAPI duplicate operation ${method} ${template.path}.`
					);
				}
				pathItem[key] = buildOperation(
					route,
					method,
					components,
					pathParams,
					template.params
				);
			}
		}
	}

	return {
		openapi: '3.1.0',
		info,
		paths,
		...(Object.keys(components).length > 0
			? { components: { schemas: components } }
			: {}),
	};
};
