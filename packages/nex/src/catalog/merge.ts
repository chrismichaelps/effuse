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

import { NexCatalogError } from '../errors/index.js';
import type {
	DefinitionNode,
	DirectiveDefinitionNode,
	FieldDefinitionNode,
	InterfaceTypeDefinitionNode,
	NamedTypeNode,
	ObjectTypeDefinitionNode,
	TypeDefinitionNode,
	UnionTypeDefinitionNode,
} from '../language/ast/index.js';
import { Kind, type OperationType } from '../language/kinds/index.js';
import { printTypeSystemDefinition } from '../language/printer/index.js';
import { BUILT_IN_DIRECTIVES } from './built-in-directives.js';
import { buildCatalogFromDocument, type CatalogBuild } from './build.js';
import type { Catalog } from './catalog.js';

const BUILT_IN_DIRECTIVE_NAMES: ReadonlySet<string> = new Set(
	BUILT_IN_DIRECTIVES.map((directive) => directive.name.value)
);

const OPERATIONS: readonly OperationType[] = ['query', 'mutation', 'live'];

/** A name for the kind of thing a definition is, for saying what disagrees. */
const KIND_NAMES: Readonly<Record<string, string>> = {
	[Kind.OBJECT_TYPE_DEFINITION]: 'an object type',
	[Kind.INTERFACE_TYPE_DEFINITION]: 'an interface',
	[Kind.UNION_TYPE_DEFINITION]: 'a union',
	[Kind.ENUM_TYPE_DEFINITION]: 'an enum',
	[Kind.INPUT_OBJECT_TYPE_DEFINITION]: 'an input type',
	[Kind.SCALAR_TYPE_DEFINITION]: 'a scalar',
};

const kindName = (definition: TypeDefinitionNode): string =>
	KIND_NAMES[definition.kind] ?? 'a type';

/**
 * Two definitions are the same when they read the same.
 *
 * Comparing rendered source rather than nodes means two sources that wrote
 * the same thing agree however each of them was parsed, and that a difference
 * anywhere - a type, an argument, a directive, a description - counts.
 */
const sameSource = (
	left: TypeDefinitionNode | DirectiveDefinitionNode,
	right: TypeDefinitionNode | DirectiveDefinitionNode
): boolean =>
	printTypeSystemDefinition(left) === printTypeSystemDefinition(right);

/** Render one field on its own, so two declarations of it can be compared. */
const printField = (field: FieldDefinitionNode): string =>
	printTypeSystemDefinition({
		kind: Kind.OBJECT_TYPE_DEFINITION,
		name: { kind: Kind.NAME, value: '_' },
		fields: [field],
	});

const byName = <TNode extends { readonly name: { readonly value: string } }>(
	nodes: readonly TNode[] | undefined
): readonly string[] => (nodes ?? []).map((node) => node.name.value);

/**
 * Join the fields of two declarations of one output type.
 *
 * A field only one source declares is added; a field both declare has to read
 * the same, since the two would otherwise disagree about what a client gets.
 */
const mergeFields = (
	typeName: string,
	left: readonly FieldDefinitionNode[] | undefined,
	right: readonly FieldDefinitionNode[] | undefined,
	errors: NexCatalogError[]
): readonly FieldDefinitionNode[] => {
	const fields = new Map<string, FieldDefinitionNode>(
		(left ?? []).map((field) => [field.name.value, field])
	);

	for (const field of right ?? []) {
		const already = fields.get(field.name.value);

		if (already === undefined) {
			fields.set(field.name.value, field);
			continue;
		}

		if (printField(already) !== printField(field)) {
			errors.push(
				new NexCatalogError({
					message: `"${typeName}.${field.name.value}" is declared differently by two sources`,
				})
			);
		}
	}

	return [...fields.values()];
};

/** Join two lists of names, keeping the order they were first seen in. */
const mergeNamed = (
	left: readonly NamedTypeNode[] | undefined,
	right: readonly NamedTypeNode[] | undefined
): readonly NamedTypeNode[] => {
	const seen = new Set(byName(left));
	return [
		...(left ?? []),
		...(right ?? []).filter((named) => !seen.has(named.name.value)),
	];
};

/**
 * Combine two declarations of one name.
 *
 * Output types compose: an object, an interface, or a union may be described
 * in pieces, and the pieces join. Input types and enums do not, because a
 * source would then be handed a field or a value it never declared and has no
 * idea what to do with - so those have to be written the same way everywhere.
 */
const combine = (
	name: string,
	left: TypeDefinitionNode,
	right: TypeDefinitionNode,
	errors: NexCatalogError[]
): TypeDefinitionNode => {
	if (left.kind !== right.kind) {
		errors.push(
			new NexCatalogError({
				message: `"${name}" is ${kindName(left)} in one source and ${kindName(right)} in another`,
			})
		);
		return left;
	}

	if (left.kind === Kind.OBJECT_TYPE_DEFINITION) {
		const other = right as ObjectTypeDefinitionNode;
		return {
			...left,
			interfaces: mergeNamed(left.interfaces, other.interfaces),
			fields: mergeFields(name, left.fields, other.fields, errors),
		};
	}

	if (left.kind === Kind.INTERFACE_TYPE_DEFINITION) {
		const other = right as InterfaceTypeDefinitionNode;
		return {
			...left,
			interfaces: mergeNamed(left.interfaces, other.interfaces),
			fields: mergeFields(name, left.fields, other.fields, errors),
		};
	}

	if (left.kind === Kind.UNION_TYPE_DEFINITION) {
		const other = right as UnionTypeDefinitionNode;
		return { ...left, types: mergeNamed(left.types, other.types) };
	}

	if (!sameSource(left, right)) {
		errors.push(
			new NexCatalogError({
				message: `"${name}" is declared differently by two sources`,
			})
		);
	}

	return left;
};

/**
 * Build one catalog out of several, reporting everything that disagrees.
 *
 * Each source describes the part of the graph it serves, and what they share -
 * the roots, an interface, a union - joins rather than collides. The first
 * catalog leads: where two sources name their roots differently, the fields of
 * the rest are joined onto the first one's, so a client sees a single graph
 * however it was assembled.
 *
 * The result is built and checked the same way a catalog written by hand is,
 * so a merge that produces something incoherent says so rather than handing
 * back a catalog that fails later.
 */
export const mergeCatalogsSafe = (
	...catalogs: readonly Catalog[]
): CatalogBuild => {
	if (catalogs.length === 0) {
		return {
			success: false,
			errors: [
				new NexCatalogError({
					message: 'Merging needs at least one catalog',
				}),
			],
		};
	}

	const errors: NexCatalogError[] = [];
	const types = new Map<string, TypeDefinitionNode>();
	const directives = new Map<string, DirectiveDefinitionNode>();

	for (const catalog of catalogs) {
		for (const [name, definition] of catalog.types) {
			const already = types.get(name);
			types.set(
				name,
				already === undefined
					? definition
					: combine(name, already, definition, errors)
			);
		}

		for (const [name, definition] of catalog.directives) {
			if (BUILT_IN_DIRECTIVE_NAMES.has(name)) continue;

			const already = directives.get(name);
			if (already === undefined) {
				directives.set(name, definition);
				continue;
			}

			if (!sameSource(already, definition)) {
				errors.push(
					new NexCatalogError({
						message: `"@${name}" is defined differently by two sources`,
					})
				);
			}
		}
	}

	// Every source's roots answer from one root each, so a client asking the
	// merged catalog reaches all of them without knowing how it was put together.
	const roots = new Map<OperationType, string>();
	for (const operation of OPERATIONS) {
		for (const catalog of catalogs) {
			const root = catalog.getRootType(operation);
			if (root === undefined) continue;

			const lead = roots.get(operation);
			if (lead === undefined) {
				roots.set(operation, root.name.value);
				continue;
			}

			if (lead === root.name.value) continue;

			const leading = types.get(lead);
			if (leading?.kind !== Kind.OBJECT_TYPE_DEFINITION) continue;

			types.set(lead, {
				...leading,
				fields: mergeFields(lead, leading.fields, root.fields, errors),
			});
		}
	}

	if (errors.length > 0) return { success: false, errors };

	const definitions: DefinitionNode[] = [
		...types.values(),
		...directives.values(),
	];
	const named = [...roots.entries()];

	if (named.length > 0) {
		definitions.push({
			kind: Kind.SCHEMA_DEFINITION,
			operationTypes: named.map(([operation, name]) => ({
				kind: Kind.OPERATION_TYPE_DEFINITION,
				operation,
				type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: name } },
			})),
		});
	}

	return buildCatalogFromDocument({ kind: Kind.DOCUMENT, definitions });
};

/**
 * Build one catalog out of several, throwing on the first thing that
 * disagrees. Use `mergeCatalogsSafe` to see every problem at once.
 */
export const mergeCatalogs = (...catalogs: readonly Catalog[]): Catalog => {
	const merged = mergeCatalogsSafe(...catalogs);
	if (merged.success) return merged.catalog;

	throw (
		merged.errors[0] ??
		new NexCatalogError({ message: 'The catalogs could not be merged' })
	);
};
