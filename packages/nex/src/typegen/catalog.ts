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

import type { Catalog } from '../catalog/index.js';
import type {
	InputValueDefinitionNode,
	InterfaceTypeDefinitionNode,
	ObjectTypeDefinitionNode,
	TypeDefinitionNode,
	TypeNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { scalarTypeOf, type ScalarTypes } from './scalars.js';
import { objectType, propertyName } from './write.js';

const HEADER_COMMENT = `/**
 * Types for a Nex catalog.
 *
 * Written by @effuse/nex. Edits are lost the next time it is written.
 */`;

const RESOLVER_IMPORT = "import type { ResolverInfo } from '@effuse/nex';";

/** Whether a type holds fields a resolver could produce. */
const holdsFields = (
	definition: TypeDefinitionNode
): definition is ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode =>
	definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
	definition.kind === Kind.INTERFACE_TYPE_DEFINITION;

const describe = (definition: {
	readonly description?: { readonly value: string } | undefined;
}): string =>
	definition.description === undefined
		? ''
		: `/** ${definition.description.value} */\n`;

/** Write the TypeScript for everything a catalog holds. */
/**
 * A choice written as one shape per way of making it.
 *
 * Every field optional would say a caller may pass all of them or none, which
 * is the thing a choice exists to rule out - so what comes out is a union,
 * and passing two is wrong where it is written rather than where it is read.
 */
const choiceType = (
	fields: readonly InputValueDefinitionNode[],
	writeType: (type: TypeNode) => string
): string =>
	fields
		.map(
			(field) =>
				// The field is optional so that the others may be chosen
				// instead; choosing this one means giving it a value.
				`\n\t| { ${field.name.value}: ${writeType(field.type).replace(/ \| null$/u, '')} }`
		)
		.join('');

export const generateCatalogTypes = (
	catalog: Catalog,
	options: { readonly scalars?: ScalarTypes | undefined } = {}
): string => {
	const scalars = options.scalars ?? {};

	const named = (typeName: string): string => {
		if (catalog.getType(typeName) !== undefined) return typeName;
		return scalarTypeOf(typeName, scalars);
	};

	/** A type reference, as a value of it reads in TypeScript. */
	const write = (type: TypeNode): string => {
		if (type.kind === Kind.NON_NULL_TYPE) {
			return write(type.type).replace(/ \| null$/u, '');
		}
		if (type.kind === Kind.OPTIONAL_TYPE) return write(type.type);
		if (type.kind === Kind.LIST_TYPE) return `${write(type.type)}[] | null`;

		return `${named(type.name.value)} | null`;
	};

	const inputField = (field: InputValueDefinitionNode): string => {
		const optional =
			field.type.kind !== Kind.NON_NULL_TYPE ||
			field.defaultValue !== undefined;

		return `${propertyName(field.name.value)}${optional ? '?' : ''}: ${write(field.type)};`;
	};

	const blocks: string[] = [HEADER_COMMENT, RESOLVER_IMPORT];
	const resolverEntries: string[] = [];

	for (const [name, definition] of catalog.types) {
		switch (definition.kind) {
			case Kind.ENUM_TYPE_DEFINITION: {
				const values = definition.values ?? [];
				blocks.push(
					`${describe(definition)}export type ${name} = ${
						values.length === 0
							? 'never'
							: values.map((value) => `'${value.name.value}'`).join(' | ')
					};`
				);
				break;
			}

			case Kind.SCALAR_TYPE_DEFINITION:
				blocks.push(
					`${describe(definition)}export type ${name} = ${scalarTypeOf(name, scalars)};`
				);
				break;

			case Kind.UNION_TYPE_DEFINITION: {
				const members = definition.types ?? [];
				blocks.push(
					`${describe(definition)}export type ${name} = ${
						members.length === 0
							? 'never'
							: members.map((member) => member.name.value).join(' | ')
					};`
				);
				break;
			}

			case Kind.INPUT_OBJECT_TYPE_DEFINITION:
				blocks.push(
					catalog.isChoiceInput(name)
						? `${describe(definition)}export type ${name} =${choiceType(
								definition.fields ?? [],
								write
							)};`
						: `${describe(definition)}export type ${name} = ${objectType(
								(definition.fields ?? []).map(inputField),
								0
							)};`
				);
				break;

			case Kind.OBJECT_TYPE_DEFINITION:
			case Kind.INTERFACE_TYPE_DEFINITION: {
				const fields = (definition.fields ?? []).map(
					(field) => `${propertyName(field.name.value)}: ${write(field.type)};`
				);
				blocks.push(
					`${describe(definition)}export type ${name} = ${objectType(fields, 0)};`
				);
				break;
			}
		}

		if (!holdsFields(definition)) continue;

		const isAbstract = definition.kind === Kind.INTERFACE_TYPE_DEFINITION;
		const entries: string[] = [];

		if (isAbstract) {
			entries.push(
				'__resolveType?: (value: unknown, context: TContext) => string | undefined;'
			);
		}

		for (const field of definition.fields ?? []) {
			const args = (field.arguments ?? [])
				.map((argument) => inputField(argument).replace(/;$/u, ''))
				.join('; ');
			const result = write(field.type);

			entries.push(
				`${propertyName(field.name.value)}?: (\n\t\t\tsource: ${name},\n\t\t\targs: ${
					args === '' ? 'Record<string, never>' : `{ ${args} }`
				},\n\t\t\tcontext: TContext,\n\t\t\tinfo: ResolverInfo\n\t\t) => ${result} | Promise<${result}>;`
			);
		}

		resolverEntries.push(`${name}?: ${objectType(entries, 1)};`);
	}

	blocks.push(
		`/** The resolvers this catalog needs, all of them optional. */\nexport type CatalogResolvers<TContext = unknown> = ${objectType(
			resolverEntries,
			0
		)};`
	);

	return `${blocks.join('\n\n')}\n`;
};
