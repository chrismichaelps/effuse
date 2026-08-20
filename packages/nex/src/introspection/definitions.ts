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
	FieldDefinitionNode,
	TypeDefinitionNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { parse } from '../language/parser/index.js';
import { INTROSPECTION_SOURCE } from './schema-source.js';

/** The meta field that names the catalog. */
export const SCHEMA_FIELD = '__schema';
/** The meta field that looks one type up. */
export const TYPE_FIELD = '__type';
/** The meta field every selection may ask for. */
export const TYPENAME_FIELD = '__typename';

let cached: ReadonlyMap<string, TypeDefinitionNode> | undefined;

/** The introspection types, parsed once and shared by every catalog. */
export const introspectionTypes = (): ReadonlyMap<
	string,
	TypeDefinitionNode
> => {
	if (cached !== undefined) return cached;

	const types = new Map<string, TypeDefinitionNode>();

	for (const definition of parse(INTROSPECTION_SOURCE).definitions) {
		switch (definition.kind) {
			case Kind.OBJECT_TYPE_DEFINITION:
			case Kind.INTERFACE_TYPE_DEFINITION:
			case Kind.UNION_TYPE_DEFINITION:
			case Kind.ENUM_TYPE_DEFINITION:
			case Kind.INPUT_OBJECT_TYPE_DEFINITION:
			case Kind.SCALAR_TYPE_DEFINITION:
				types.set(definition.name.value, definition);
				break;
			default:
				break;
		}
	}

	cached = types;
	return types;
};

const name = (value: string) => ({ kind: Kind.NAME, value }) as const;

const namedType = (value: string) =>
	({ kind: Kind.NAMED_TYPE, name: name(value) }) as const;

/** The meta fields a query root answers on top of its own. */
export const rootMetaField = (
	fieldName: string
): FieldDefinitionNode | undefined => {
	if (fieldName === SCHEMA_FIELD) {
		return {
			kind: Kind.FIELD_DEFINITION,
			name: name(SCHEMA_FIELD),
			type: { kind: Kind.NON_NULL_TYPE, type: namedType('__Schema') },
		};
	}

	if (fieldName === TYPE_FIELD) {
		return {
			kind: Kind.FIELD_DEFINITION,
			name: name(TYPE_FIELD),
			arguments: [
				{
					kind: Kind.INPUT_VALUE_DEFINITION,
					name: name('name'),
					type: { kind: Kind.NON_NULL_TYPE, type: namedType('String') },
				},
			],
			type: namedType('__Type'),
		};
	}

	return undefined;
};
