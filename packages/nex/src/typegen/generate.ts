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
	FragmentDefinitionNode,
	OperationDefinitionNode,
	SelectionSetNode,
	TypeNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import {
	isListType,
	listItemType,
	namedTypeOf,
} from '../validation/type-utils.js';
import { scalarTypeOf, type ScalarTypes } from './scalars.js';
import { objectType, propertyName, typeNameFor } from './write.js';

/** What a page looks like in TypeScript, whatever it holds. */
const pageType = (items: string, indent: number): string => {
	const pad = '\t'.repeat(indent + 1);
	const inner = '\t'.repeat(indent + 2);

	return objectType(
		[
			`items: ${items}[];`,
			`pageInfo: {\n${inner}hasNextPage: boolean;\n${inner}hasPreviousPage: boolean;\n${inner}startCursor: string | null;\n${inner}endCursor: string | null;\n${pad}};`,
			'totalCount: number;',
		],
		indent
	);
};

/**
 * What a value the client does not recognise is typed as.
 *
 * `string & {}` keeps the known members completing in an editor while still
 * accepting anything else, which a plain `string` would not.
 */
const UNKNOWN_VALUE = '(string & {})';

/** Build the TypeScript for one request against a catalog. */
export const generateOperationTypes = (
	catalog: Catalog,
	operation: OperationDefinitionNode,
	fragments: ReadonlyMap<string, FragmentDefinitionNode>,
	scalars: ScalarTypes = {}
): string => {
	/**
	 * Whatever a name stands for, as TypeScript.
	 *
	 * `open` says the value is being read rather than written. A catalog may
	 * gain an enum value at any time, and a client built before that still has
	 * to read what comes back: an open enum keeps the known values completing
	 * while leaving somewhere for the rest to land, and stops an exhaustive
	 * switch from typechecking as complete when it is not. Writing is the other
	 * way round - a caller must not be able to send a value the server never
	 * declared - so an argument stays closed.
	 */
	const named = (typeName: string, open: boolean): string => {
		const definition = catalog.getType(typeName);

		if (definition?.kind === Kind.ENUM_TYPE_DEFINITION) {
			const values = definition.values ?? [];
			if (values.length === 0) return 'never';

			const known = values.map((value) => `'${value.name.value}'`).join(' | ');

			return open ? `${known} | ${UNKNOWN_VALUE}` : known;
		}

		return scalarTypeOf(typeName, scalars);
	};

	/** An input type, as a caller has to write it. */
	const inputType = (type: TypeNode, indent: number): string => {
		if (type.kind === Kind.NON_NULL_TYPE) {
			return inputType(type.type, indent).replace(/ \| null$/u, '');
		}
		if (type.kind === Kind.OPTIONAL_TYPE) return inputType(type.type, indent);
		if (type.kind === Kind.LIST_TYPE) {
			return `${inputType(type.type, indent)}[] | null`;
		}

		const typeName = type.name.value;
		const definition = catalog.getType(typeName);

		if (definition?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
			// A choice is one shape per way of making it, so a caller passing
			// two of them is wrong where it is written.
			if (catalog.isChoiceInput(typeName)) {
				const ways = (definition.fields ?? []).map(
					(field) =>
						`{ ${field.name.value}: ${inputType(field.type, indent).replace(/ \| null$/u, '')} }`
				);

				return `(${ways.join(' | ')}) | null`;
			}

			const fields = (definition.fields ?? []).map((field) => {
				const optional =
					field.type.kind !== Kind.NON_NULL_TYPE ||
					field.defaultValue !== undefined;
				const written = inputType(field.type, indent + 1);

				return `${propertyName(field.name.value)}${optional ? '?' : ''}: ${written};`;
			});

			return `${objectType(fields, indent)} | null`;
		}

		return `${named(typeName, false)} | null`;
	};

	/** Everything one selection set will produce, as one or more variants. */
	const selectionType = (
		parentTypeName: string,
		selectionSet: SelectionSetNode,
		indent: number
	): string => {
		const shared: string[] = [];
		const branches = new Map<string, string[]>();

		const collect = (
			typeName: string,
			set: SelectionSetNode,
			into: string[],
			visited: ReadonlySet<string>
		): void => {
			for (const selection of set.selections) {
				switch (selection.kind) {
					case Kind.FIELD: {
						const key = selection.alias?.value ?? selection.name.value;

						if (selection.name.value === '__typename') {
							into.push(`${propertyName(key)}: '${typeName}';`);
							break;
						}

						const definition = catalog.getField(typeName, selection.name.value);
						if (definition === undefined) break;

						into.push(
							`${propertyName(key)}: ${fieldType(definition.type, selection, indent + 1)};`
						);
						break;
					}

					case Kind.INLINE_FRAGMENT: {
						const condition = selection.typeCondition?.name.value ?? typeName;

						if (condition === typeName) {
							collect(condition, selection.selectionSet, into, visited);
							break;
						}

						const branch = branches.get(condition) ?? [];
						branches.set(condition, branch);
						collect(condition, selection.selectionSet, branch, visited);
						break;
					}

					case Kind.FRAGMENT_SPREAD: {
						const name = selection.name.value;
						if (visited.has(name)) break;

						const fragment = fragments.get(name);
						if (fragment === undefined) break;

						const condition = fragment.typeCondition.name.value;
						const target =
							condition === typeName ? into : (branches.get(condition) ?? []);
						if (condition !== typeName) branches.set(condition, target);

						collect(
							condition,
							fragment.selectionSet,
							target,
							new Set([...visited, name])
						);
						break;
					}
				}
			}
		};

		collect(parentTypeName, selectionSet, shared, new Set());

		if (branches.size === 0) return objectType(shared, indent);

		const common = shared.filter((field) => !field.startsWith('__typename'));

		// Only what the request asked for is in the answer, so a discriminant
		// is only written where one was asked for: a type naming a key the
		// response will not carry is a type that lies about it.
		const discriminated = shared.some((field) =>
			field.startsWith('__typename')
		);

		const variant = (fields: readonly string[], written: string): string =>
			objectType(
				discriminated
					? [...common, written, ...fields]
					: [...common, ...fields],
				indent
			);

		// A union or an interface may gain a member, and code matching only the
		// ones it knows still has to have somewhere for the rest to land. The
		// catch-all carries what was selected on the type itself, which any
		// member added later declares too.
		return [
			...[...branches].map(([typeName, fields]) =>
				variant(fields, `__typename: '${typeName}';`)
			),
			variant([], `__typename: ${UNKNOWN_VALUE};`),
		].join(' | ');
	};

	/** What one field produces, wrappers, pipeline, and all. */
	const fieldType = (
		type: TypeNode,
		selection: {
			readonly selectionSet?: SelectionSetNode | undefined;
			readonly pipeline?: unknown;
		},
		indent: number
	): string => {
		const nullable = type.kind !== Kind.NON_NULL_TYPE;
		const bare =
			type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.OPTIONAL_TYPE
				? type.type
				: type;

		const paged = (
			(selection as { readonly pipeline?: readonly { kind: string }[] })
				.pipeline ?? []
		).some((stage) => stage.kind === Kind.PAGE_STAGE);

		const write = (): string => {
			if (isListType(bare) || bare.kind === Kind.LIST_TYPE) {
				const item = listItemType(bare) ?? bare;
				// `items:` sits one level inside the page object, so that is the
				// indent its own contents close at.
				const itemType = fieldType(
					item,
					selection,
					paged ? indent + 1 : indent
				);

				return paged ? pageType(itemType, indent) : `${itemType}[]`;
			}

			const typeName = namedTypeOf(bare);

			return selection.selectionSet === undefined
				? named(typeName, true)
				: selectionType(typeName, selection.selectionSet, indent);
		};

		const written = write();
		return nullable ? `${written} | null` : written;
	};

	const rootType = catalog.getRootType(operation.operation);
	if (rootType === undefined) return '';

	const name = operation.name?.value;
	const blocks: string[] = [];

	const variables = operation.variableDefinitions ?? [];
	if (variables.length > 0) {
		const fields = variables.map((definition) => {
			const optional =
				definition.type.kind !== Kind.NON_NULL_TYPE ||
				definition.defaultValue !== undefined;
			const written = inputType(definition.type, 1);

			return `${propertyName(definition.variable.name.value)}${optional ? '?' : ''}: ${written};`;
		});

		blocks.push(
			`export type ${typeNameFor(name, 'Variables')} = ${objectType(fields, 0)};`
		);
	}

	// Written as an interface extending the index signature `execute<TData>`
	// asks for, so the generated type drops straight into a call.
	blocks.push(
		`export type ${typeNameFor(name, 'Data')} = ${selectionType(
			rootType.name.value,
			operation.selectionSet,
			0
		)};`
	);

	return blocks.join('\n\n');
};
