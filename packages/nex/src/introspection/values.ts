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

import { BUILT_IN_SCALARS, type Catalog } from '../catalog/index.js';
import type {
	DirectiveDefinitionNode,
	DirectiveNode,
	EnumValueDefinitionNode,
	FieldDefinitionNode,
	InputValueDefinitionNode,
	TypeDefinitionNode,
	TypeNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { printValue } from '../language/printer/index.js';
import { introspectionTypes } from './definitions.js';
import { OPTIONAL_FEATURES, PIPELINE_OPERATORS } from './operators.js';

const TYPE_KINDS: Readonly<Record<string, string>> = {
	[Kind.SCALAR_TYPE_DEFINITION]: 'SCALAR',
	[Kind.OBJECT_TYPE_DEFINITION]: 'OBJECT',
	[Kind.INTERFACE_TYPE_DEFINITION]: 'INTERFACE',
	[Kind.UNION_TYPE_DEFINITION]: 'UNION',
	[Kind.ENUM_TYPE_DEFINITION]: 'ENUM',
	[Kind.INPUT_OBJECT_TYPE_DEFINITION]: 'INPUT_OBJECT',
};

const DEPRECATED = 'deprecated';
const CONNECTION = 'connection';
const COST = 'cost';
const AUTH = 'auth';

/** A value the executor reads with its ordinary field resolution. */
type Introspected = Record<string, unknown>;

const describe = (node: {
	readonly description?: { readonly value: string } | undefined;
}): string | null => node.description?.value ?? null;

const directiveNamed = (
	directives: readonly DirectiveNode[] | undefined,
	name: string
): DirectiveNode | undefined =>
	directives?.find((directive) => directive.name.value === name);

const argumentOf = (
	directive: DirectiveNode | undefined,
	name: string
): string | number | null => {
	const value = directive?.arguments?.find(
		(argument) => argument.name.value === name
	)?.value;

	if (value === undefined) return null;
	if (value.kind === Kind.INT) return Number.parseInt(value.value, 10);
	if (value.kind === Kind.STRING || value.kind === Kind.ENUM)
		return value.value;
	return null;
};

const deprecation = (node: {
	readonly directives?: readonly DirectiveNode[] | undefined;
}): { isDeprecated: boolean; deprecationReason: string | null } => {
	const directive = directiveNamed(node.directives, DEPRECATED);
	if (directive === undefined) {
		return { isDeprecated: false, deprecationReason: null };
	}

	const reason = argumentOf(directive, 'reason');
	return {
		isDeprecated: true,
		deprecationReason: typeof reason === 'string' ? reason : null,
	};
};

/** Describe a type reference, wrappers and all. */
const typeReference = (catalog: Catalog, type: TypeNode): Introspected => {
	switch (type.kind) {
		case Kind.NON_NULL_TYPE:
			return {
				kind: 'NON_NULL',
				name: null,
				description: null,
				ofType: () => typeReference(catalog, type.type),
			};
		case Kind.OPTIONAL_TYPE:
			return {
				kind: 'OPTIONAL',
				name: null,
				description: null,
				ofType: () => typeReference(catalog, type.type),
			};
		case Kind.LIST_TYPE:
			return {
				kind: 'LIST',
				name: null,
				description: null,
				ofType: () => typeReference(catalog, type.type),
			};
		case Kind.NAMED_TYPE:
			return namedTypeValue(catalog, type.name.value);
	}
};

const inputValue = (
	catalog: Catalog,
	definition: InputValueDefinitionNode
): Introspected => ({
	__typename: '__InputValue',
	name: definition.name.value,
	description: describe(definition),
	type: () => typeReference(catalog, definition.type),
	defaultValue:
		definition.defaultValue === undefined
			? null
			: printValue(definition.defaultValue),
	...deprecation(definition),
});

const fieldValue = (
	catalog: Catalog,
	definition: FieldDefinitionNode
): Introspected => {
	const cost = argumentOf(directiveNamed(definition.directives, COST), 'value');
	const auth = argumentOf(
		directiveNamed(definition.directives, AUTH),
		'requires'
	);

	return {
		__typename: '__Field',
		name: definition.name.value,
		description: describe(definition),
		args: () =>
			(definition.arguments ?? []).map((argument) =>
				inputValue(catalog, argument)
			),
		type: () => typeReference(catalog, definition.type),
		isConnection:
			directiveNamed(definition.directives, CONNECTION) !== undefined,
		cost: typeof cost === 'number' ? cost : null,
		auth: typeof auth === 'string' ? auth : null,
		...deprecation(definition),
	};
};

const enumValue = (definition: EnumValueDefinitionNode): Introspected => ({
	__typename: '__EnumValue',
	name: definition.name.value,
	description: describe(definition),
	...deprecation(definition),
});

/** Whether a listing should include something marked deprecated. */
const includeDeprecated = (args: Readonly<Record<string, unknown>>): boolean =>
	args.includeDeprecated === true;

/** Describe one named type. */
export const namedTypeValue = (
	catalog: Catalog,
	name: string
): Introspected => {
	const definition = catalog.getType(name);

	if (definition === undefined) {
		return BUILT_IN_SCALARS.has(name)
			? { __typename: '__Type', kind: 'SCALAR', name, description: null }
			: { __typename: '__Type', kind: 'SCALAR', name, description: null };
	}

	return typeValue(catalog, definition);
};

/** Describe a type definition the catalog holds. */
export const typeValue = (
	catalog: Catalog,
	definition: TypeDefinitionNode
): Introspected => {
	const base: Introspected = {
		__typename: '__Type',
		kind: TYPE_KINDS[definition.kind] ?? 'SCALAR',
		name: definition.name.value,
		description: describe(definition),
		ofType: null,
		fields: null,
		interfaces: null,
		possibleTypes: null,
		enumValues: null,
		inputFields: null,
	};

	if (
		definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
		definition.kind === Kind.INTERFACE_TYPE_DEFINITION
	) {
		base.fields = (
			_source: unknown,
			args: Readonly<Record<string, unknown>>
		): readonly Introspected[] =>
			(definition.fields ?? [])
				.filter(
					(field) =>
						includeDeprecated(args) ||
						directiveNamed(field.directives, DEPRECATED) === undefined
				)
				.map((field) => fieldValue(catalog, field));
		base.interfaces = () =>
			(definition.interfaces ?? []).map((type) =>
				namedTypeValue(catalog, type.name.value)
			);
	}

	if (
		definition.kind === Kind.INTERFACE_TYPE_DEFINITION ||
		definition.kind === Kind.UNION_TYPE_DEFINITION
	) {
		base.possibleTypes = () =>
			catalog
				.getPossibleTypes(definition.name.value)
				.map((type) => namedTypeValue(catalog, type.name.value));
	}

	if (definition.kind === Kind.ENUM_TYPE_DEFINITION) {
		base.enumValues = (
			_source: unknown,
			args: Readonly<Record<string, unknown>>
		): readonly Introspected[] =>
			(definition.values ?? [])
				.filter(
					(value) =>
						includeDeprecated(args) ||
						directiveNamed(value.directives, DEPRECATED) === undefined
				)
				.map(enumValue);
	}

	if (definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
		base.inputFields = () =>
			(definition.fields ?? []).map((field) => inputValue(catalog, field));
	}

	return base;
};

const directiveValue = (
	catalog: Catalog,
	definition: DirectiveDefinitionNode
): Introspected => ({
	__typename: '__Directive',
	name: definition.name.value,
	description: describe(definition),
	locations: definition.locations.map((location) => location.value),
	args: () =>
		(definition.arguments ?? []).map((argument) =>
			inputValue(catalog, argument)
		),
	isRepeatable: definition.repeatable,
});

/** Describe the whole catalog, for the `__schema` meta field. */
export const schemaValue = (catalog: Catalog): Introspected => ({
	__typename: '__Schema',
	description: null,
	types: () =>
		[...catalog.types.values(), ...introspectionTypes().values()].map((type) =>
			typeValue(catalog, type)
		),
	queryType: () => rootTypeValue(catalog, 'query'),
	mutationType: () => rootTypeValue(catalog, 'mutation'),
	liveType: () => rootTypeValue(catalog, 'live'),
	directives: () =>
		[...catalog.directives.values()].map((directive) =>
			directiveValue(catalog, directive)
		),
	pipelineOperators: () =>
		PIPELINE_OPERATORS.map((operator) => ({
			__typename: '__PipelineOperator',
			...operator,
		})),
	features: () =>
		OPTIONAL_FEATURES.map((feature) => ({
			__typename: '__Feature',
			...feature,
		})),
});

const rootTypeValue = (
	catalog: Catalog,
	operation: 'query' | 'mutation' | 'live'
): Introspected | null => {
	const root = catalog.getRootType(operation);
	return root === undefined ? null : typeValue(catalog, root);
};

/** Describe one type by name, for the `__type` meta field. */
export const typeByNameValue = (
	catalog: Catalog,
	name: unknown
): Introspected | null => {
	if (typeof name !== 'string') return null;

	const definition = catalog.getType(name);
	if (definition !== undefined) return typeValue(catalog, definition);

	return BUILT_IN_SCALARS.has(name)
		? { __typename: '__Type', kind: 'SCALAR', name, description: null }
		: null;
};
