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
	EnumValueDefinitionNode,
	FieldDefinitionNode,
	InputValueDefinitionNode,
	TypeDefinitionNode,
} from '../language/ast/index.js';
import type { CoordinateNode } from '../language/coordinates/index.js';
import { parseCoordinate } from '../language/coordinates/index.js';
import { Kind } from '../language/kinds/index.js';
import type { Catalog } from './catalog.js';

/** Whatever a coordinate can name. */
export type CoordinateTarget =
	| TypeDefinitionNode
	| FieldDefinitionNode
	| InputValueDefinitionNode
	| EnumValueDefinitionNode
	| DirectiveDefinitionNode;

const memberOfType = (
	definition: TypeDefinitionNode,
	member: string
): CoordinateTarget | undefined => {
	switch (definition.kind) {
		case Kind.OBJECT_TYPE_DEFINITION:
		case Kind.INTERFACE_TYPE_DEFINITION:
			return definition.fields?.find((field) => field.name.value === member);
		case Kind.INPUT_OBJECT_TYPE_DEFINITION:
			return definition.fields?.find((field) => field.name.value === member);
		case Kind.ENUM_TYPE_DEFINITION:
			return definition.values?.find((value) => value.name.value === member);
		default:
			return undefined;
	}
};

/**
 * Follow a coordinate into a catalog.
 *
 * Takes the coordinate written out - `Query.posts(first:)` - or one already
 * read, and hands back the definition it names, or nothing when the catalog
 * does not hold it.
 */
export const resolveCoordinate = (
	catalog: Catalog,
	coordinate: string | CoordinateNode
): CoordinateTarget | undefined => {
	const node =
		typeof coordinate === 'string' ? parseCoordinate(coordinate) : coordinate;

	switch (node.kind) {
		case Kind.TYPE_COORDINATE:
			return catalog.getType(node.name.value);

		case Kind.MEMBER_COORDINATE: {
			const definition = catalog.getType(node.name.value);
			return definition === undefined
				? undefined
				: memberOfType(definition, node.member.value);
		}

		case Kind.ARGUMENT_COORDINATE: {
			const field = catalog.getField(node.name.value, node.member.value);
			return field?.arguments?.find(
				(argument) => argument.name.value === node.argument.value
			);
		}

		case Kind.DIRECTIVE_COORDINATE:
			return catalog.getDirective(node.name.value);

		case Kind.DIRECTIVE_ARGUMENT_COORDINATE: {
			const directive = catalog.getDirective(node.name.value);
			return directive?.arguments?.find(
				(argument) => argument.name.value === node.argument.value
			);
		}
	}
};
