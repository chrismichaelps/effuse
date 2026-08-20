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

/** Every AST node kind produced by the Nex parser. */
export const Kind = {
	NAME: 'Name',
	DOCUMENT: 'Document',
	OPERATION_DEFINITION: 'OperationDefinition',
	VARIABLE_DEFINITION: 'VariableDefinition',
	SELECTION_SET: 'SelectionSet',
	FIELD: 'Field',
	ARGUMENT: 'Argument',
	FRAGMENT_SPREAD: 'FragmentSpread',
	INLINE_FRAGMENT: 'InlineFragment',
	FRAGMENT_DEFINITION: 'FragmentDefinition',
	SCHEMA_DEFINITION: 'SchemaDefinition',
	OPERATION_TYPE_DEFINITION: 'OperationTypeDefinition',
	SCALAR_TYPE_DEFINITION: 'ScalarTypeDefinition',
	OBJECT_TYPE_DEFINITION: 'ObjectTypeDefinition',
	INTERFACE_TYPE_DEFINITION: 'InterfaceTypeDefinition',
	UNION_TYPE_DEFINITION: 'UnionTypeDefinition',
	ENUM_TYPE_DEFINITION: 'EnumTypeDefinition',
	ENUM_VALUE_DEFINITION: 'EnumValueDefinition',
	INPUT_OBJECT_TYPE_DEFINITION: 'InputObjectTypeDefinition',
	INPUT_VALUE_DEFINITION: 'InputValueDefinition',
	FIELD_DEFINITION: 'FieldDefinition',
	DIRECTIVE_DEFINITION: 'DirectiveDefinition',
	SCHEMA_EXTENSION: 'SchemaExtension',
	SCALAR_TYPE_EXTENSION: 'ScalarTypeExtension',
	OBJECT_TYPE_EXTENSION: 'ObjectTypeExtension',
	INTERFACE_TYPE_EXTENSION: 'InterfaceTypeExtension',
	UNION_TYPE_EXTENSION: 'UnionTypeExtension',
	ENUM_TYPE_EXTENSION: 'EnumTypeExtension',
	INPUT_OBJECT_TYPE_EXTENSION: 'InputObjectTypeExtension',
	TYPE_COORDINATE: 'TypeCoordinate',
	MEMBER_COORDINATE: 'MemberCoordinate',
	ARGUMENT_COORDINATE: 'ArgumentCoordinate',
	DIRECTIVE_COORDINATE: 'DirectiveCoordinate',
	DIRECTIVE_ARGUMENT_COORDINATE: 'DirectiveArgumentCoordinate',
	DIRECTIVE: 'Directive',
	VARIABLE: 'Variable',
	INT: 'IntValue',
	FLOAT: 'FloatValue',
	STRING: 'StringValue',
	BOOLEAN: 'BooleanValue',
	NULL: 'NullValue',
	ENUM: 'EnumValue',
	LIST: 'ListValue',
	OBJECT: 'ObjectValue',
	OBJECT_FIELD: 'ObjectField',
	NAMED_TYPE: 'NamedType',
	LIST_TYPE: 'ListType',
	NON_NULL_TYPE: 'NonNullType',
	OPTIONAL_TYPE: 'OptionalType',
	FILTER_STAGE: 'FilterStage',
	SORT_STAGE: 'SortStage',
	TAKE_STAGE: 'TakeStage',
	SKIP_STAGE: 'SkipStage',
	PAGE_STAGE: 'PageStage',
	UNIQUE_STAGE: 'UniqueStage',
	CUSTOM_STAGE: 'CustomStage',
	FIELD_PATH: 'FieldPath',
	BINARY_EXPRESSION: 'BinaryExpression',
	UNARY_EXPRESSION: 'UnaryExpression',
} as const;

export type Kind = (typeof Kind)[keyof typeof Kind];
