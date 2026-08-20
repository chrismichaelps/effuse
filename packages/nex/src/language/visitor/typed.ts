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

import type { Catalog } from '../../catalog/index.js';
import type {
	ASTNode,
	DocumentNode,
	FieldDefinitionNode,
	FragmentDefinitionNode,
	InputValueDefinitionNode,
	SelectionSetNode,
	ValueNode,
} from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import { namedTypeOf } from '../../validation/type-utils.js';
import type { NodeOfKind } from './visit.js';

/** What the catalog says about where a walk currently stands. */
export interface TypedVisitorInfo {
	/** The type the node was written on. */
	readonly parentTypeName: string | undefined;
	/** The type the node itself carries. */
	readonly typeName: string | undefined;
	/** The field a selection is asking for. */
	readonly fieldDefinition: FieldDefinitionNode | undefined;
	/** The argument or input field a value belongs to. */
	readonly argumentDefinition: InputValueDefinitionNode | undefined;
	/** The type that argument or input field expects. */
	readonly inputTypeName: string | undefined;
}

/** A handler for one node kind, told what the catalog knows about it. */
export type TypedVisitFn<TNode extends ASTNode = ASTNode> = (
	node: TNode,
	types: TypedVisitorInfo
) => void;

/** Handlers by node kind, plus one for every node. */
export type TypedVisitor = {
	readonly [TKind in ASTNode['kind']]?: TypedVisitFn<NodeOfKind<TKind>>;
} & {
	readonly enter?: TypedVisitFn;
	readonly leave?: TypedVisitFn;
};

const EMPTY: TypedVisitorInfo = {
	parentTypeName: undefined,
	typeName: undefined,
	fieldDefinition: undefined,
	argumentDefinition: undefined,
	inputTypeName: undefined,
};

/**
 * Walk a request while the catalog says what everything is.
 *
 * A plain walk sees names; this one sees types, which is what a lint rule, a
 * cost model, or a code generator actually needs. It reads rather than
 * rewrites: a walk that both tracks types and edits them underneath itself
 * would be describing a tree that no longer exists.
 */
export const visitWithTypes = (
	document: DocumentNode,
	catalog: Catalog,
	visitor: TypedVisitor
): void => {
	const fragments = new Map<string, FragmentDefinitionNode>();
	for (const definition of document.definitions) {
		if (definition.kind !== Kind.FRAGMENT_DEFINITION) continue;
		if (!fragments.has(definition.name.value)) {
			fragments.set(definition.name.value, definition);
		}
	}

	/**
	 * The visitor a caller writes says which node each handler takes; walking
	 * happens over the union, and this is the one place those two meet.
	 */
	const handlers = visitor as Readonly<
		Record<string, TypedVisitFn | undefined>
	>;

	const call = (node: ASTNode, types: TypedVisitorInfo): void => {
		visitor.enter?.(node, types);
		handlers[node.kind]?.(node, types);
		visitor.leave?.(node, types);
	};

	const walkValue = (
		value: ValueNode,
		argument: InputValueDefinitionNode | undefined,
		inputTypeName: string | undefined
	): void => {
		call(value, {
			...EMPTY,
			argumentDefinition: argument,
			inputTypeName,
		});

		if (value.kind === Kind.LIST) {
			for (const item of value.values) walkValue(item, argument, inputTypeName);
			return;
		}

		if (value.kind !== Kind.OBJECT) return;

		const definition =
			inputTypeName === undefined ? undefined : catalog.getType(inputTypeName);

		for (const field of value.fields) {
			const declared =
				definition?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
					? definition.fields?.find(
							(candidate) => candidate.name.value === field.name.value
						)
					: undefined;
			const fieldTypeName =
				declared === undefined ? undefined : namedTypeOf(declared.type);

			call(field, {
				...EMPTY,
				parentTypeName: inputTypeName,
				argumentDefinition: declared,
				inputTypeName: fieldTypeName,
			});
			walkValue(field.value, declared, fieldTypeName);
		}
	};

	const walkSelectionSet = (
		parentTypeName: string | undefined,
		selectionSet: SelectionSetNode,
		visited: ReadonlySet<string>
	): void => {
		for (const selection of selectionSet.selections) {
			switch (selection.kind) {
				case Kind.FIELD: {
					const definition =
						parentTypeName === undefined
							? undefined
							: catalog.getField(parentTypeName, selection.name.value);
					const typeName =
						definition === undefined ? undefined : namedTypeOf(definition.type);

					call(selection, {
						...EMPTY,
						parentTypeName,
						typeName,
						fieldDefinition: definition,
					});

					for (const argument of selection.arguments ?? []) {
						const declared = definition?.arguments?.find(
							(candidate) => candidate.name.value === argument.name.value
						);
						const inputTypeName =
							declared === undefined ? undefined : namedTypeOf(declared.type);

						call(argument, {
							...EMPTY,
							parentTypeName,
							argumentDefinition: declared,
							inputTypeName,
						});
						walkValue(argument.value, declared, inputTypeName);
					}

					if (selection.selectionSet !== undefined) {
						walkSelectionSet(typeName, selection.selectionSet, visited);
					}
					break;
				}

				case Kind.INLINE_FRAGMENT: {
					const condition =
						selection.typeCondition?.name.value ?? parentTypeName;
					call(selection, { ...EMPTY, parentTypeName, typeName: condition });
					walkSelectionSet(condition, selection.selectionSet, visited);
					break;
				}

				case Kind.FRAGMENT_SPREAD: {
					const name = selection.name.value;
					call(selection, { ...EMPTY, parentTypeName });
					if (visited.has(name)) break;

					const fragment = fragments.get(name);
					if (fragment === undefined) break;

					walkSelectionSet(
						fragment.typeCondition.name.value,
						fragment.selectionSet,
						new Set([...visited, name])
					);
					break;
				}
			}
		}
	};

	for (const definition of document.definitions) {
		if (definition.kind !== Kind.OPERATION_DEFINITION) continue;

		const rootType = catalog.getRootType(definition.operation);
		call(definition, { ...EMPTY, typeName: rootType?.name.value });
		walkSelectionSet(rootType?.name.value, definition.selectionSet, new Set());
	}
};
