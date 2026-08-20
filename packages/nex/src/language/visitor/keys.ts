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

import { Kind } from '../kinds/index.js';

/**
 * The child fields of every node kind, in the order they are written.
 *
 * A walk reads this rather than the node itself, so a node carrying an extra
 * field - a cache, a marker a tool hung on it - is never mistaken for a child.
 */
export const visitorKeys: Readonly<Record<string, readonly string[]>> = {
	[Kind.NAME]: [],
	[Kind.DOCUMENT]: ['definitions'],
	[Kind.OPERATION_DEFINITION]: [
		'name',
		'variableDefinitions',
		'directives',
		'selectionSet',
	],
	[Kind.VARIABLE_DEFINITION]: [
		'variable',
		'type',
		'defaultValue',
		'directives',
	],
	[Kind.SELECTION_SET]: ['selections'],
	[Kind.FIELD]: [
		'alias',
		'name',
		'arguments',
		'directives',
		'pipeline',
		'selectionSet',
	],
	[Kind.ARGUMENT]: ['name', 'value'],
	[Kind.FRAGMENT_SPREAD]: ['name', 'directives'],
	[Kind.INLINE_FRAGMENT]: ['typeCondition', 'directives', 'selectionSet'],
	[Kind.FRAGMENT_DEFINITION]: [
		'name',
		'typeCondition',
		'directives',
		'selectionSet',
	],
	[Kind.DIRECTIVE]: ['name', 'arguments'],
	[Kind.VARIABLE]: ['name'],
	[Kind.INT]: [],
	[Kind.FLOAT]: [],
	[Kind.STRING]: [],
	[Kind.BOOLEAN]: [],
	[Kind.NULL]: [],
	[Kind.ENUM]: [],
	[Kind.LIST]: ['values'],
	[Kind.OBJECT]: ['fields'],
	[Kind.OBJECT_FIELD]: ['name', 'value'],
	[Kind.NAMED_TYPE]: ['name'],
	[Kind.LIST_TYPE]: ['type'],
	[Kind.NON_NULL_TYPE]: ['type'],
	[Kind.OPTIONAL_TYPE]: ['type'],
	[Kind.FILTER_STAGE]: ['condition'],
	[Kind.SORT_STAGE]: ['field'],
	[Kind.TAKE_STAGE]: ['count'],
	[Kind.SKIP_STAGE]: ['count'],
	[Kind.PAGE_STAGE]: ['arguments'],
	[Kind.UNIQUE_STAGE]: [],
	[Kind.CUSTOM_STAGE]: ['name', 'arguments'],
	[Kind.FIELD_PATH]: ['segments'],
	[Kind.BINARY_EXPRESSION]: ['left', 'right'],
	[Kind.UNARY_EXPRESSION]: ['expression'],
	[Kind.SCHEMA_DEFINITION]: ['description', 'directives', 'operationTypes'],
	[Kind.OPERATION_TYPE_DEFINITION]: ['type'],
	[Kind.SCALAR_TYPE_DEFINITION]: ['description', 'name', 'directives'],
	[Kind.OBJECT_TYPE_DEFINITION]: [
		'description',
		'name',
		'interfaces',
		'directives',
		'fields',
	],
	[Kind.INTERFACE_TYPE_DEFINITION]: [
		'description',
		'name',
		'interfaces',
		'directives',
		'fields',
	],
	[Kind.UNION_TYPE_DEFINITION]: ['description', 'name', 'directives', 'types'],
	[Kind.ENUM_TYPE_DEFINITION]: ['description', 'name', 'directives', 'values'],
	[Kind.ENUM_VALUE_DEFINITION]: ['description', 'name', 'directives'],
	[Kind.INPUT_OBJECT_TYPE_DEFINITION]: [
		'description',
		'name',
		'directives',
		'fields',
	],
	[Kind.INPUT_VALUE_DEFINITION]: [
		'description',
		'name',
		'type',
		'defaultValue',
		'directives',
	],
	[Kind.FIELD_DEFINITION]: [
		'description',
		'name',
		'arguments',
		'type',
		'defaultValue',
		'directives',
	],
	[Kind.DIRECTIVE_DEFINITION]: [
		'description',
		'name',
		'arguments',
		'locations',
	],
	[Kind.SCHEMA_EXTENSION]: ['directives', 'operationTypes'],
	[Kind.SCALAR_TYPE_EXTENSION]: ['name', 'directives'],
	[Kind.OBJECT_TYPE_EXTENSION]: ['name', 'interfaces', 'directives', 'fields'],
	[Kind.INTERFACE_TYPE_EXTENSION]: [
		'name',
		'interfaces',
		'directives',
		'fields',
	],
	[Kind.UNION_TYPE_EXTENSION]: ['name', 'directives', 'types'],
	[Kind.ENUM_TYPE_EXTENSION]: ['name', 'directives', 'values'],
	[Kind.INPUT_OBJECT_TYPE_EXTENSION]: ['name', 'directives', 'fields'],

	// Coordinates are not part of a document, but they are nodes, and a tool
	// walking one should reach the names inside it.
	[Kind.TYPE_COORDINATE]: ['name'],
	[Kind.MEMBER_COORDINATE]: ['name', 'member'],
	[Kind.ARGUMENT_COORDINATE]: ['name', 'member', 'argument'],
	[Kind.DIRECTIVE_COORDINATE]: ['name'],
	[Kind.DIRECTIVE_ARGUMENT_COORDINATE]: ['name', 'argument'],
};
