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

import type {
	DefinitionNode,
	DirectiveDefinitionNode,
	DocumentNode,
	EnumTypeDefinitionNode,
	InputObjectTypeDefinitionNode,
	InterfaceTypeDefinitionNode,
	NamedTypeNode,
	ObjectTypeDefinitionNode,
	TypeDefinitionNode,
	UnionTypeDefinitionNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { buildCatalogFromDocument } from './build.js';
import type { Catalog } from './catalog.js';
import { BUILT_IN_DIRECTIVES } from './built-in-directives.js';

const BUILT_IN_DIRECTIVE_NAMES: ReadonlySet<string> = new Set(
	BUILT_IN_DIRECTIVES.map((directive) => directive.name.value)
);

const byName = <T extends { readonly name: { readonly value: string } }>(
	entries: readonly T[] | undefined
): readonly T[] =>
	[...(entries ?? [])].sort((left, right) =>
		left.name.value.localeCompare(right.name.value)
	);

const sortType = (definition: TypeDefinitionNode): TypeDefinitionNode => {
	switch (definition.kind) {
		case Kind.OBJECT_TYPE_DEFINITION:
		case Kind.INTERFACE_TYPE_DEFINITION: {
			const holder = definition as
				| ObjectTypeDefinitionNode
				| InterfaceTypeDefinitionNode;

			return {
				...holder,
				...(holder.interfaces === undefined
					? {}
					: { interfaces: byName(holder.interfaces) as NamedTypeNode[] }),
				...(holder.fields === undefined
					? {}
					: {
							fields: byName(holder.fields).map((field) => ({
								...field,
								...(field.arguments === undefined
									? {}
									: { arguments: byName(field.arguments) }),
							})),
						}),
			};
		}

		case Kind.UNION_TYPE_DEFINITION: {
			const union = definition as UnionTypeDefinitionNode;
			return {
				...union,
				...(union.types === undefined ? {} : { types: byName(union.types) }),
			};
		}

		case Kind.ENUM_TYPE_DEFINITION: {
			const enumeration = definition as EnumTypeDefinitionNode;
			return {
				...enumeration,
				...(enumeration.values === undefined
					? {}
					: { values: byName(enumeration.values) }),
			};
		}

		case Kind.INPUT_OBJECT_TYPE_DEFINITION: {
			const input = definition as InputObjectTypeDefinitionNode;
			return {
				...input,
				...(input.fields === undefined ? {} : { fields: byName(input.fields) }),
			};
		}

		default:
			return definition;
	}
};

/**
 * Put a catalog in a settled order: types, fields, arguments, enum values, and
 * union members by name.
 *
 * Two catalogs that say the same thing print the same once sorted, which is
 * what makes a diff between releases about what changed rather than about how
 * it was typed. Sorting a sorted catalog changes nothing.
 */
export const sortCatalog = (catalog: Catalog): Catalog => {
	const definitions: DefinitionNode[] = [];

	const roots = (['query', 'mutation', 'live'] as const)
		.map((operation) => ({ operation, type: catalog.getRootType(operation) }))
		.filter(
			(
				entry
			): entry is {
				operation: (typeof entry)['operation'];
				type: NonNullable<(typeof entry)['type']>;
			} => entry.type !== undefined
		);

	if (roots.length > 0) {
		definitions.push({
			kind: Kind.SCHEMA_DEFINITION,
			operationTypes: roots.map((root) => ({
				kind: Kind.OPERATION_TYPE_DEFINITION,
				operation: root.operation,
				type: { kind: Kind.NAMED_TYPE, name: root.type.name },
			})),
		});
	}

	for (const definition of byName([...catalog.types.values()])) {
		definitions.push(sortType(definition));
	}

	const declared: DirectiveDefinitionNode[] = [];
	for (const [name, directive] of catalog.directives) {
		if (BUILT_IN_DIRECTIVE_NAMES.has(name)) continue;
		declared.push(directive);
	}

	for (const directive of byName(declared)) {
		definitions.push({
			...directive,
			...(directive.arguments === undefined
				? {}
				: { arguments: byName(directive.arguments) }),
		});
	}

	const document: DocumentNode = { kind: Kind.DOCUMENT, definitions };
	const built = buildCatalogFromDocument(document);

	// A catalog that was valid stays valid when its parts are put in order, so
	// a failure here means the sort dropped something rather than the catalog
	// being wrong.
	if (!built.success) {
		throw built.errors[0] ?? new Error('A sorted catalog could not be rebuilt');
	}

	return built.catalog;
};
