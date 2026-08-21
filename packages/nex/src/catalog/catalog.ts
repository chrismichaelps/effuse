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
	DirectiveDefinitionNode,
	FieldDefinitionNode,
	ObjectTypeDefinitionNode,
	TypeDefinitionNode,
} from '../language/ast/index.js';
import { Kind, type OperationType } from '../language/kinds/index.js';
import {
	introspectionTypes,
	rootMetaField,
} from '../introspection/definitions.js';
import type { CatalogIndex } from './index-definitions.js';

const CONVENTIONAL_ROOT_NAMES: Readonly<Record<OperationType, string>> = {
	query: 'Query',
	mutation: 'Mutation',
	live: 'Live',
};

const CONNECTION_DIRECTIVE = 'connection';
const IDENTITY_DIRECTIVE = 'identity';
const CHOICE_DIRECTIVE = 'choice';

/** The field a type identifies itself by when it does not name one. */
export const DEFAULT_IDENTITY_FIELD = 'id';

/** The field on an object that stands for the whole object. */
export const REFERENCE_FIELD = '__ref';

/** A resolved catalog: every type, directive, and root operation of a schema. */
export interface Catalog {
	/**
	 * Every named type the catalog was written with, keyed by name.
	 *
	 * Introspection types are not listed here - they are the same for every
	 * catalog - but `getType` resolves them, and `__schema { types }` lists
	 * them alongside these.
	 */
	readonly types: ReadonlyMap<string, TypeDefinitionNode>;
	/** Every directive definition, keyed by name without the `@`. */
	readonly directives: ReadonlyMap<string, DirectiveDefinitionNode>;
	/** The named type, or `undefined` when the catalog does not define it. */
	readonly getType: (name: string) => TypeDefinitionNode | undefined;
	/** The object type serving an operation, by the schema block or convention. */
	readonly getRootType: (
		operation: OperationType
	) => ObjectTypeDefinitionNode | undefined;
	/** A field declared on an object or interface type. */
	readonly getField: (
		typeName: string,
		fieldName: string
	) => FieldDefinitionNode | undefined;
	/** Whether a field is marked `@connection`, so `| page` applies to it. */
	readonly isConnectionField: (typeName: string, fieldName: string) => boolean;
	/**
	 * The field a type says identifies it, or `undefined` when it says nothing.
	 *
	 * A type marked `@identity` answers `__ref`, the reference a client caches
	 * it under. `@identity(field:)` names the field when it is not `id`.
	 */
	readonly identityField: (typeName: string) => string | undefined;
	/** The object types a name can resolve to at runtime. */
	readonly getPossibleTypes: (
		name: string
	) => readonly ObjectTypeDefinitionNode[];
	/**
	 * Whether an input type takes exactly one of the fields it offers.
	 *
	 * A type marked `@choice` is a way of saying one thing among several -
	 * look someone up by id, or by email, or by handle - rather than a bag
	 * where every combination has to mean something.
	 */
	readonly isChoiceInput: (typeName: string) => boolean;
	/** A directive definition, by name without the `@`. */
	readonly getDirective: (name: string) => DirectiveDefinitionNode | undefined;
}

/** Build the lookup surface over an already validated index. */
export const createCatalog = (index: CatalogIndex): Catalog => {
	const resolvable = new Map<string, TypeDefinitionNode>([
		...index.types,
		...introspectionTypes(),
	]);

	const getType = (name: string): TypeDefinitionNode | undefined =>
		resolvable.get(name);

	const getObjectType = (
		name: string
	): ObjectTypeDefinitionNode | undefined => {
		const definition = getType(name);
		return definition?.kind === Kind.OBJECT_TYPE_DEFINITION
			? definition
			: undefined;
	};

	const getRootType = (
		operation: OperationType
	): ObjectTypeDefinitionNode | undefined => {
		const named = index.schemaDefinition?.operationTypes.find(
			(operationType) => operationType.operation === operation
		);
		return getObjectType(
			named?.type.name.value ?? CONVENTIONAL_ROOT_NAMES[operation]
		);
	};

	const identityField = (typeName: string): string | undefined => {
		const definition = getType(typeName);
		if (definition?.kind !== Kind.OBJECT_TYPE_DEFINITION) return undefined;

		const marked = (definition.directives ?? []).find(
			(directive) => directive.name.value === IDENTITY_DIRECTIVE
		);
		if (marked === undefined) return undefined;

		const named = (marked.arguments ?? []).find(
			(argument) => argument.name.value === 'field'
		);

		return named?.value.kind === Kind.STRING
			? named.value.value
			: DEFAULT_IDENTITY_FIELD;
	};

	const getField = (
		typeName: string,
		fieldName: string
	): FieldDefinitionNode | undefined => {
		// A reference stands for the object rather than being written on it, so
		// it answers wherever a type says what identifies it.
		if (
			fieldName === REFERENCE_FIELD &&
			identityField(typeName) !== undefined
		) {
			return {
				kind: Kind.FIELD_DEFINITION,
				name: { kind: Kind.NAME, value: REFERENCE_FIELD },
				type: {
					kind: Kind.NON_NULL_TYPE,
					type: {
						kind: Kind.NAMED_TYPE,
						name: { kind: Kind.NAME, value: 'String' },
					},
				},
			};
		}

		const definition = getType(typeName);
		if (
			definition?.kind !== Kind.OBJECT_TYPE_DEFINITION &&
			definition?.kind !== Kind.INTERFACE_TYPE_DEFINITION
		) {
			return undefined;
		}

		const declared = definition.fields?.find(
			(field) => field.name.value === fieldName
		);
		if (declared !== undefined) return declared;

		// `__schema` and `__type` answer on the query root and nowhere else.
		return typeName === getRootType('query')?.name.value
			? rootMetaField(fieldName)
			: undefined;
	};

	const getPossibleTypes = (
		name: string
	): readonly ObjectTypeDefinitionNode[] => {
		const definition = getType(name);
		if (definition === undefined) return [];

		if (definition.kind === Kind.OBJECT_TYPE_DEFINITION) return [definition];

		if (definition.kind === Kind.UNION_TYPE_DEFINITION) {
			return (definition.types ?? []).flatMap((member) => {
				const object = getObjectType(member.name.value);
				return object === undefined ? [] : [object];
			});
		}

		if (definition.kind === Kind.INTERFACE_TYPE_DEFINITION) {
			return [...index.types.values()].flatMap((candidate) =>
				candidate.kind === Kind.OBJECT_TYPE_DEFINITION &&
				(candidate.interfaces ?? []).some(
					(implemented) => implemented.name.value === name
				)
					? [candidate]
					: []
			);
		}

		return [];
	};

	return {
		types: index.types,
		directives: index.directives,
		getType,
		getRootType,
		getField,
		isConnectionField: (typeName, fieldName) =>
			(getField(typeName, fieldName)?.directives ?? []).some(
				(directive) => directive.name.value === CONNECTION_DIRECTIVE
			),
		identityField,
		isChoiceInput: (typeName) => {
			const definition = getType(typeName);
			return (
				definition?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION &&
				(definition.directives ?? []).some(
					(one) => one.name.value === CHOICE_DIRECTIVE
				)
			);
		},
		getPossibleTypes,
		getDirective: (name) => index.directives.get(name),
	};
};
