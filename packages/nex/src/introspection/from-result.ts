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

import { DEFAULT_IDENTITY_FIELD } from '../catalog/index.js';
import { NexCatalogError } from '../errors/index.js';
import type {
	ArgumentNode,
	DefinitionNode,
	DirectiveDefinitionNode,
	DirectiveNode,
	DocumentNode,
	EnumValueDefinitionNode,
	FieldDefinitionNode,
	InputValueDefinitionNode,
	NameNode,
	NamedTypeNode,
	OperationTypeDefinitionNode,
	StringValueNode,
	TypeNode,
	ValueNode,
} from '../language/ast/index.js';
import { Kind, OperationType } from '../language/kinds/index.js';
import { parseValueSource } from '../language/parser/index.js';

/** What a server said about itself, as far as this reader cares. */
interface TypeRef {
	readonly kind?: string;
	readonly name?: string | null;
	readonly ofType?: TypeRef | null;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

const asArray = (value: unknown): readonly unknown[] =>
	Array.isArray(value) ? value : [];

const name = (value: string): NameNode => ({ kind: Kind.NAME, value });

const description = (value: unknown): StringValueNode | undefined => {
	if (typeof value !== 'string' || value === '') return undefined;

	// A description that spans lines reads better as a block; a one-liner is
	// how it was almost certainly written in the first place.
	return value.includes('\n')
		? { kind: Kind.STRING, value, block: true }
		: { kind: Kind.STRING, value };
};

/** Rebuild a type reference from the wrappers introspection reported. */
const typeFromRef = (ref: TypeRef | null | undefined): TypeNode | undefined => {
	if (ref === null || ref === undefined) return undefined;

	switch (ref.kind) {
		case 'NON_NULL': {
			const inner = typeFromRef(ref.ofType);
			return inner === undefined
				? undefined
				: { kind: Kind.NON_NULL_TYPE, type: inner };
		}
		case 'OPTIONAL': {
			const inner = typeFromRef(ref.ofType);
			return inner === undefined
				? undefined
				: { kind: Kind.OPTIONAL_TYPE, type: inner };
		}
		case 'LIST': {
			const inner = typeFromRef(ref.ofType);
			return inner === undefined
				? undefined
				: { kind: Kind.LIST_TYPE, type: inner };
		}
		default:
			return typeof ref.name === 'string'
				? { kind: Kind.NAMED_TYPE, name: name(ref.name) }
				: undefined;
	}
};

/**
 * `@identity`, written back the way the type declared it.
 *
 * The argument is left off when the field is the one a type identifies by
 * without saying, so what comes back out reads the way it went in.
 */
const identityDirective = (field: string): DirectiveNode =>
	directive(
		'identity',
		field === DEFAULT_IDENTITY_FIELD
			? []
			: [{ name: 'field', value: { kind: Kind.STRING, value: field } }]
	);

const directive = (
	directiveName: string,
	args: readonly { readonly name: string; readonly value: ValueNode }[] = []
): DirectiveNode => ({
	kind: Kind.DIRECTIVE,
	name: name(directiveName),
	...(args.length === 0
		? {}
		: {
				arguments: args.map(
					(argument): ArgumentNode => ({
						kind: Kind.ARGUMENT,
						name: name(argument.name),
						value: argument.value,
					})
				),
			}),
});

/** The directives that carry what a field knows beyond its shape. */
const fieldDirectives = (
	field: Record<string, unknown>
): readonly DirectiveNode[] => {
	const directives: DirectiveNode[] = [];

	if (field.isConnection === true) directives.push(directive('connection'));

	if (typeof field.cost === 'number') {
		directives.push(
			directive('cost', [
				{ name: 'value', value: { kind: Kind.INT, value: String(field.cost) } },
			])
		);
	}

	if (typeof field.auth === 'string') {
		directives.push(
			directive('auth', [
				{ name: 'requires', value: { kind: Kind.STRING, value: field.auth } },
			])
		);
	}

	directives.push(...deprecation(field));

	return directives;
};

const deprecation = (
	node: Record<string, unknown>
): readonly DirectiveNode[] => {
	if (node.isDeprecated !== true) return [];

	return [
		directive(
			'deprecated',
			typeof node.deprecationReason === 'string'
				? [
						{
							name: 'reason',
							value: { kind: Kind.STRING, value: node.deprecationReason },
						},
					]
				: []
		),
	];
};

const defaultValue = (value: unknown): ValueNode | undefined =>
	typeof value === 'string' ? parseValueSource(value) : undefined;

const inputValue = (raw: unknown): InputValueDefinitionNode | undefined => {
	const record = asRecord(raw);
	if (record === undefined || typeof record.name !== 'string') return undefined;

	const type = typeFromRef(record.type as TypeRef);
	if (type === undefined) return undefined;

	const described = description(record.description);
	const fallback = defaultValue(record.defaultValue);
	const directives = deprecation(record);

	return {
		kind: Kind.INPUT_VALUE_DEFINITION,
		...(described === undefined ? {} : { description: described }),
		name: name(record.name),
		type,
		...(fallback === undefined ? {} : { defaultValue: fallback }),
		...(directives.length === 0 ? {} : { directives }),
	};
};

const fieldDefinition = (raw: unknown): FieldDefinitionNode | undefined => {
	const record = asRecord(raw);
	if (record === undefined || typeof record.name !== 'string') return undefined;

	const type = typeFromRef(record.type as TypeRef);
	if (type === undefined) return undefined;

	const args = asArray(record.args)
		.map(inputValue)
		.filter((value): value is InputValueDefinitionNode => value !== undefined);
	const described = description(record.description);
	const directives = fieldDirectives(record);

	return {
		kind: Kind.FIELD_DEFINITION,
		...(described === undefined ? {} : { description: described }),
		name: name(record.name),
		...(args.length === 0 ? {} : { arguments: args }),
		type,
		...(directives.length === 0 ? {} : { directives }),
	};
};

const enumValue = (raw: unknown): EnumValueDefinitionNode | undefined => {
	const record = asRecord(raw);
	if (record === undefined || typeof record.name !== 'string') return undefined;

	const described = description(record.description);
	const directives = deprecation(record);

	return {
		kind: Kind.ENUM_VALUE_DEFINITION,
		...(described === undefined ? {} : { description: described }),
		name: name(record.name),
		...(directives.length === 0 ? {} : { directives }),
	};
};

const namedTypes = (raw: unknown): readonly NamedTypeNode[] =>
	asArray(raw)
		.map((entry) => asRecord(entry)?.name)
		.filter((value): value is string => typeof value === 'string')
		.map(
			(value): NamedTypeNode => ({ kind: Kind.NAMED_TYPE, name: name(value) })
		);

const typeDefinition = (raw: unknown): DefinitionNode | undefined => {
	const record = asRecord(raw);
	if (record === undefined || typeof record.name !== 'string') return undefined;
	if (record.name.startsWith('__')) return undefined;

	const described = description(record.description);
	const common = {
		...(described === undefined ? {} : { description: described }),
		name: name(record.name),
	};

	switch (record.kind) {
		case 'SCALAR':
			return { kind: Kind.SCALAR_TYPE_DEFINITION, ...common };

		case 'OBJECT':
		case 'INTERFACE': {
			const fields = asArray(record.fields)
				.map(fieldDefinition)
				.filter((field): field is FieldDefinitionNode => field !== undefined);
			const interfaces = namedTypes(record.interfaces);

			// A type that said what identifies it has to still say so here, or
			// a catalog rebuilt from a server loses what a client caches by.
			const identity =
				record.kind === 'OBJECT' && typeof record.identityField === 'string'
					? [identityDirective(record.identityField)]
					: [];

			return {
				kind:
					record.kind === 'OBJECT'
						? Kind.OBJECT_TYPE_DEFINITION
						: Kind.INTERFACE_TYPE_DEFINITION,
				...common,
				...(identity.length === 0 ? {} : { directives: identity }),
				...(interfaces.length === 0 ? {} : { interfaces }),
				...(fields.length === 0 ? {} : { fields }),
			};
		}

		case 'UNION': {
			const types = namedTypes(record.possibleTypes);
			return {
				kind: Kind.UNION_TYPE_DEFINITION,
				...common,
				...(types.length === 0 ? {} : { types }),
			};
		}

		case 'ENUM': {
			const values = asArray(record.enumValues)
				.map(enumValue)
				.filter(
					(value): value is EnumValueDefinitionNode => value !== undefined
				);
			return {
				kind: Kind.ENUM_TYPE_DEFINITION,
				...common,
				...(values.length === 0 ? {} : { values }),
			};
		}

		case 'INPUT_OBJECT': {
			const fields = asArray(record.inputFields)
				.map(inputValue)
				.filter(
					(field): field is InputValueDefinitionNode => field !== undefined
				);
			return {
				kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
				...common,
				...(fields.length === 0 ? {} : { fields }),
			};
		}

		default:
			return undefined;
	}
};

const directiveDefinition = (
	raw: unknown
): DirectiveDefinitionNode | undefined => {
	const record = asRecord(raw);
	if (record === undefined || typeof record.name !== 'string') return undefined;

	const args = asArray(record.args)
		.map(inputValue)
		.filter((value): value is InputValueDefinitionNode => value !== undefined);
	const described = description(record.description);
	const locations = asArray(record.locations)
		.filter((value): value is string => typeof value === 'string')
		.map(name);

	return {
		kind: Kind.DIRECTIVE_DEFINITION,
		...(described === undefined ? {} : { description: described }),
		name: name(record.name),
		...(args.length === 0 ? {} : { arguments: args }),
		repeatable: record.isRepeatable === true,
		locations,
	};
};

/**
 * Turn what a server said about itself back into a document.
 *
 * Accepts either the whole response or the `__schema` value inside it, since
 * a client may have unwrapped it already.
 */
export const documentFromIntrospection = (result: unknown): DocumentNode => {
	const outer = asRecord(result);
	const schema =
		asRecord(outer?.__schema) ??
		asRecord(asRecord(outer?.data)?.__schema) ??
		(outer?.types === undefined ? undefined : outer);

	if (schema === undefined || !Array.isArray(schema.types)) {
		throw new NexCatalogError({
			message:
				'This is not an introspection result: no "__schema" with a list of types was found',
		});
	}

	const definitions: DefinitionNode[] = [];
	const operationTypes: OperationTypeDefinitionNode[] = [];

	for (const [operation, key] of [
		[OperationType.QUERY, 'queryType'],
		[OperationType.MUTATION, 'mutationType'],
		[OperationType.LIVE, 'liveType'],
	] as const) {
		const root = asRecord(schema[key])?.name;
		if (typeof root !== 'string') continue;

		operationTypes.push({
			kind: Kind.OPERATION_TYPE_DEFINITION,
			operation,
			type: { kind: Kind.NAMED_TYPE, name: name(root) },
		});
	}

	if (operationTypes.length > 0) {
		definitions.push({ kind: Kind.SCHEMA_DEFINITION, operationTypes });
	}

	for (const type of schema.types) {
		const definition = typeDefinition(type);
		if (definition !== undefined) definitions.push(definition);
	}

	for (const entry of asArray(schema.directives)) {
		const definition = directiveDefinition(entry);
		if (definition !== undefined) definitions.push(definition);
	}

	return { kind: Kind.DOCUMENT, definitions };
};
