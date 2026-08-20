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
	DirectiveNode,
	DocumentNode,
	EnumTypeDefinitionNode,
	InputObjectTypeDefinitionNode,
	InterfaceTypeDefinitionNode,
	NamedTypeNode,
	ObjectTypeDefinitionNode,
	SchemaDefinitionNode,
	TypeDefinitionNode,
	TypeExtensionNode,
	TypeSystemExtensionNode,
	UnionTypeDefinitionNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';

const EXTENSION_KINDS: ReadonlySet<string> = new Set([
	Kind.SCALAR_TYPE_EXTENSION,
	Kind.OBJECT_TYPE_EXTENSION,
	Kind.INTERFACE_TYPE_EXTENSION,
	Kind.UNION_TYPE_EXTENSION,
	Kind.ENUM_TYPE_EXTENSION,
	Kind.INPUT_OBJECT_TYPE_EXTENSION,
]);

/** What a type is called in an error message. */
const KIND_LABELS: Readonly<Record<string, string>> = {
	[Kind.SCALAR_TYPE_DEFINITION]: 'a scalar',
	[Kind.OBJECT_TYPE_DEFINITION]: 'an object type',
	[Kind.INTERFACE_TYPE_DEFINITION]: 'an interface',
	[Kind.UNION_TYPE_DEFINITION]: 'a union',
	[Kind.ENUM_TYPE_DEFINITION]: 'an enum',
	[Kind.INPUT_OBJECT_TYPE_DEFINITION]: 'an input type',
};

/** The definition kind each extension kind belongs to. */
const EXTENDS: Readonly<Record<string, string>> = {
	[Kind.SCALAR_TYPE_EXTENSION]: Kind.SCALAR_TYPE_DEFINITION,
	[Kind.OBJECT_TYPE_EXTENSION]: Kind.OBJECT_TYPE_DEFINITION,
	[Kind.INTERFACE_TYPE_EXTENSION]: Kind.INTERFACE_TYPE_DEFINITION,
	[Kind.UNION_TYPE_EXTENSION]: Kind.UNION_TYPE_DEFINITION,
	[Kind.ENUM_TYPE_EXTENSION]: Kind.ENUM_TYPE_DEFINITION,
	[Kind.INPUT_OBJECT_TYPE_EXTENSION]: Kind.INPUT_OBJECT_TYPE_DEFINITION,
};

const mergeDirectives = (
	existing: readonly DirectiveNode[] | undefined,
	added: readonly DirectiveNode[] | undefined
): readonly DirectiveNode[] | undefined =>
	existing === undefined && added === undefined
		? undefined
		: [...(existing ?? []), ...(added ?? [])];

const mergeInterfaces = (
	existing: readonly NamedTypeNode[] | undefined,
	added: readonly NamedTypeNode[] | undefined
): readonly NamedTypeNode[] | undefined => {
	if (existing === undefined && added === undefined) return undefined;

	const seen = new Set((existing ?? []).map((type) => type.name.value));
	const extra = (added ?? []).filter((type) => !seen.has(type.name.value));
	return [...(existing ?? []), ...extra];
};

/**
 * Fold every `extend ...` in the document into the definition it extends.
 *
 * Extensions are applied after all definitions are indexed, so one may appear
 * before the definition it adds to.
 */
export const applyExtensions = (
	document: DocumentNode,
	types: Map<string, TypeDefinitionNode>,
	schemaDefinition: SchemaDefinitionNode | undefined
): {
	readonly schemaDefinition: SchemaDefinitionNode | undefined;
	readonly errors: readonly NexCatalogError[];
} => {
	const errors: NexCatalogError[] = [];
	let schema = schemaDefinition;

	const fail = (message: string, node: TypeSystemExtensionNode): void => {
		errors.push(new NexCatalogError({ message, location: node.loc }));
	};

	for (const definition of document.definitions) {
		if (definition.kind === Kind.SCHEMA_EXTENSION) {
			const operationTypes = definition.operationTypes ?? [];
			const existing = schema?.operationTypes ?? [];
			const taken = new Set(existing.map((entry) => entry.operation));
			const added = [];

			for (const entry of operationTypes) {
				if (taken.has(entry.operation)) {
					fail(
						`The ${entry.operation} root type is already named by the schema block`,
						definition
					);
					continue;
				}
				taken.add(entry.operation);
				added.push(entry);
			}

			schema = {
				kind: Kind.SCHEMA_DEFINITION,
				...(schema?.description === undefined
					? {}
					: { description: schema.description }),
				...(mergeDirectives(schema?.directives, definition.directives) ===
				undefined
					? {}
					: {
							directives: mergeDirectives(
								schema?.directives,
								definition.directives
							) as readonly DirectiveNode[],
						}),
				operationTypes: [...existing, ...added],
			};
			continue;
		}

		if (!EXTENSION_KINDS.has(definition.kind)) continue;

		const extension = definition as TypeExtensionNode;
		const name = extension.name.value;
		const target = types.get(name);

		if (target === undefined) {
			fail(
				`Cannot extend type "${name}": the catalog does not define it`,
				extension
			);
			continue;
		}

		if (target.kind !== EXTENDS[extension.kind]) {
			fail(
				`Cannot extend type "${name}" this way: "${name}" is ${KIND_LABELS[target.kind] ?? 'another kind of type'}`,
				extension
			);
			continue;
		}

		types.set(name, extendType(target, extension, fail));
	}

	return { schemaDefinition: schema, errors };
};

const extendType = (
	target: TypeDefinitionNode,
	extension: TypeExtensionNode,
	fail: (message: string, node: TypeSystemExtensionNode) => void
): TypeDefinitionNode => {
	const name = target.name.value;

	if (
		extension.kind === Kind.OBJECT_TYPE_EXTENSION ||
		extension.kind === Kind.INTERFACE_TYPE_EXTENSION
	) {
		const owner = target as
			| ObjectTypeDefinitionNode
			| InterfaceTypeDefinitionNode;
		const existing = owner.fields ?? [];
		const taken = new Set(existing.map((field) => field.name.value));
		const added = [];

		for (const field of extension.fields ?? []) {
			if (taken.has(field.name.value)) {
				fail(
					`Field "${field.name.value}" already exists on type "${name}"`,
					extension
				);
				continue;
			}
			taken.add(field.name.value);
			added.push(field);
		}

		const interfaces = mergeInterfaces(owner.interfaces, extension.interfaces);
		const directives = mergeDirectives(owner.directives, extension.directives);

		return {
			...owner,
			...(interfaces === undefined ? {} : { interfaces }),
			...(directives === undefined ? {} : { directives }),
			fields: [...existing, ...added],
		};
	}

	if (extension.kind === Kind.UNION_TYPE_EXTENSION) {
		const owner = target as UnionTypeDefinitionNode;
		const existing = owner.types ?? [];
		const taken = new Set(existing.map((type) => type.name.value));
		const added = [];

		for (const type of extension.types ?? []) {
			if (taken.has(type.name.value)) {
				fail(
					`"${type.name.value}" is already a member of union "${name}"`,
					extension
				);
				continue;
			}
			taken.add(type.name.value);
			added.push(type);
		}

		const directives = mergeDirectives(owner.directives, extension.directives);

		return {
			...owner,
			...(directives === undefined ? {} : { directives }),
			types: [...existing, ...added],
		};
	}

	if (extension.kind === Kind.ENUM_TYPE_EXTENSION) {
		const owner = target as EnumTypeDefinitionNode;
		const existing = owner.values ?? [];
		const taken = new Set(existing.map((value) => value.name.value));
		const added = [];

		for (const value of extension.values ?? []) {
			if (taken.has(value.name.value)) {
				fail(
					`Value "${value.name.value}" already exists on enum "${name}"`,
					extension
				);
				continue;
			}
			taken.add(value.name.value);
			added.push(value);
		}

		const directives = mergeDirectives(owner.directives, extension.directives);

		return {
			...owner,
			...(directives === undefined ? {} : { directives }),
			values: [...existing, ...added],
		};
	}

	if (extension.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION) {
		const owner = target as InputObjectTypeDefinitionNode;
		const existing = owner.fields ?? [];
		const taken = new Set(existing.map((field) => field.name.value));
		const added = [];

		for (const field of extension.fields ?? []) {
			if (taken.has(field.name.value)) {
				fail(
					`Field "${field.name.value}" already exists on input type "${name}"`,
					extension
				);
				continue;
			}
			taken.add(field.name.value);
			added.push(field);
		}

		const directives = mergeDirectives(owner.directives, extension.directives);

		return {
			...owner,
			...(directives === undefined ? {} : { directives }),
			fields: [...existing, ...added],
		};
	}

	const directives = mergeDirectives(target.directives, extension.directives);
	return {
		...target,
		...(directives === undefined ? {} : { directives }),
	};
};
