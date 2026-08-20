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
import type { TypeNode } from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';

/** The named type at the centre of a type reference, ignoring wrappers. */
export const namedTypeOf = (type: TypeNode): string =>
	type.kind === Kind.NAMED_TYPE ? type.name.value : namedTypeOf(type.type);

/** Strip the nullability wrappers a type reference carries. */
export const withoutNullability = (type: TypeNode): TypeNode =>
	type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.OPTIONAL_TYPE
		? withoutNullability(type.type)
		: type;

/** Whether a value written for this type may be null. */
export const isNullable = (type: TypeNode): boolean =>
	type.kind !== Kind.NON_NULL_TYPE;

/** Whether the type is a list once its nullability wrappers are removed. */
export const isListType = (type: TypeNode): boolean =>
	withoutNullability(type).kind === Kind.LIST_TYPE;

/** The element type of a list, or `undefined` when the type is not a list. */
export const listItemType = (type: TypeNode): TypeNode | undefined => {
	const bare = withoutNullability(type);
	return bare.kind === Kind.LIST_TYPE ? bare.type : undefined;
};

/** Render a type reference the way it was written, for error messages. */
export const displayType = (type: TypeNode): string => {
	switch (type.kind) {
		case Kind.NAMED_TYPE:
			return type.name.value;
		case Kind.LIST_TYPE:
			return `[${displayType(type.type)}]`;
		case Kind.NON_NULL_TYPE:
			return `${displayType(type.type)}!`;
		case Kind.OPTIONAL_TYPE:
			return `${displayType(type.type)}?`;
	}
};

/** Whether a name refers to a scalar, including the ones built in. */
export const isScalarName = (catalog: Catalog, name: string): boolean =>
	BUILT_IN_SCALARS.has(name) ||
	catalog.getType(name)?.kind === Kind.SCALAR_TYPE_DEFINITION;

/** Whether a name refers to a type a selection set can be written against. */
export const isCompositeName = (catalog: Catalog, name: string): boolean => {
	const kind = catalog.getType(name)?.kind;
	return (
		kind === Kind.OBJECT_TYPE_DEFINITION ||
		kind === Kind.INTERFACE_TYPE_DEFINITION ||
		kind === Kind.UNION_TYPE_DEFINITION
	);
};

/** Whether a name refers to a type that ends a selection path. */
export const isLeafName = (catalog: Catalog, name: string): boolean =>
	isScalarName(catalog, name) ||
	catalog.getType(name)?.kind === Kind.ENUM_TYPE_DEFINITION;

/** Whether a name refers to a type a variable or argument may carry. */
export const isInputName = (catalog: Catalog, name: string): boolean =>
	isScalarName(catalog, name) ||
	catalog.getType(name)?.kind === Kind.ENUM_TYPE_DEFINITION ||
	catalog.getType(name)?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION;

/**
 * Whether a value of `source` may be written where `target` is expected.
 *
 * A non-null value fits a nullable position, never the other way round, and
 * `Type?` is read as the nullable form of `Type`.
 */
export const isAssignable = (source: TypeNode, target: TypeNode): boolean => {
	if (target.kind === Kind.NON_NULL_TYPE) {
		return source.kind === Kind.NON_NULL_TYPE
			? isAssignable(source.type, target.type)
			: false;
	}
	if (source.kind === Kind.NON_NULL_TYPE)
		return isAssignable(source.type, target);
	if (target.kind === Kind.OPTIONAL_TYPE)
		return isAssignable(source, target.type);
	if (source.kind === Kind.OPTIONAL_TYPE)
		return isAssignable(source.type, target);

	if (target.kind === Kind.LIST_TYPE) {
		return source.kind === Kind.LIST_TYPE
			? isAssignable(source.type, target.type)
			: false;
	}
	if (source.kind === Kind.LIST_TYPE) return false;

	return source.name.value === target.name.value;
};

/**
 * Whether two composite types can ever describe the same runtime object, which
 * is what decides if a fragment spread is worth applying.
 */
export const typesOverlap = (
	catalog: Catalog,
	left: string,
	right: string
): boolean => {
	if (left === right) return true;

	const leftPossible = new Set(
		catalog.getPossibleTypes(left).map((type) => type.name.value)
	);
	return catalog
		.getPossibleTypes(right)
		.some((type) => leftPossible.has(type.name.value));
};
