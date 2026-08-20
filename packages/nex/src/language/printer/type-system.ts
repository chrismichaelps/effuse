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
	NamedTypeNode,
	StringValueNode,
	TypeSystemDefinitionNode,
	TypeSystemExtensionNode,
} from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import {
	INDENT_STEP,
	pad,
	printBlockString,
	printString,
} from '../../utils/index.js';
import { printDirectives } from './arguments.js';
import { printType } from './type.js';
import { printValue } from './value.js';

/** Render a description, if there is one, as the line above its definition. */
const printDescription = (
	description: StringValueNode | undefined,
	indent: number
): string =>
	description === undefined
		? ''
		: `${(description.block === true
				? printBlockString(description.value)
				: printString(description.value)
			)
				.split('\n')
				.map((line) => `${pad(indent)}${line}`)
				.join('\n')}\n`;

const printDefault = (value: { readonly defaultValue?: unknown }): string =>
	value.defaultValue === undefined
		? ''
		: ` = ${printValue(value.defaultValue as Parameters<typeof printValue>[0])}`;

const printInputValueDefinition = (node: InputValueDefinitionNode): string =>
	`${node.name.value}: ${printType(node.type)}${printDefault(node)}${printDirectives(
		node.directives
	)}`;

const printArgumentDefinitions = (
	args: readonly InputValueDefinitionNode[] | undefined
): string =>
	args === undefined || args.length === 0
		? ''
		: `(${args.map(printInputValueDefinition).join(', ')})`;

const printFieldDefinition = (node: FieldDefinitionNode): string =>
	`${printDescription(node.description, INDENT_STEP)}${pad(INDENT_STEP)}${
		node.name.value
	}${printArgumentDefinitions(node.arguments)}: ${printType(node.type)}${printDefault(
		node
	)}${printDirectives(node.directives)}`;

const printEnumValueDefinition = (node: EnumValueDefinitionNode): string =>
	`${printDescription(node.description, INDENT_STEP)}${pad(INDENT_STEP)}${
		node.name.value
	}${printDirectives(node.directives)}`;

/** Render a `{ ... }` block, or nothing when the block is absent. */
const printBlock = (lines: readonly string[] | undefined): string =>
	lines === undefined ? '' : ` {\n${lines.join('\n')}\n}`;

const printInterfaces = (
	interfaces: readonly NamedTypeNode[] | undefined
): string =>
	interfaces === undefined || interfaces.length === 0
		? ''
		: ` implements ${interfaces.map((node) => node.name.value).join(' & ')}`;

const printDirectiveDefinition = (node: DirectiveDefinitionNode): string =>
	`${printDescription(node.description, 0)}directive @${
		node.name.value
	}${printArgumentDefinitions(node.arguments)}${
		node.repeatable ? ' repeatable' : ''
	} on ${node.locations.map((location) => location.value).join(' | ')}`;

/** Render a definition that describes the catalog. */
export const printTypeSystemDefinition = (
	node: TypeSystemDefinitionNode
): string => {
	switch (node.kind) {
		case Kind.SCHEMA_DEFINITION:
			return `${printDescription(node.description, 0)}schema${printDirectives(
				node.directives
			)}${printBlock(
				node.operationTypes.map(
					(operationType) =>
						`${pad(INDENT_STEP)}${operationType.operation}: ${operationType.type.name.value}`
				)
			)}`;
		case Kind.SCALAR_TYPE_DEFINITION:
			return `${printDescription(node.description, 0)}scalar ${
				node.name.value
			}${printDirectives(node.directives)}`;
		case Kind.OBJECT_TYPE_DEFINITION:
		case Kind.INTERFACE_TYPE_DEFINITION: {
			const keyword =
				node.kind === Kind.OBJECT_TYPE_DEFINITION ? 'type' : 'interface';
			return `${printDescription(node.description, 0)}${keyword} ${
				node.name.value
			}${printInterfaces(node.interfaces)}${printDirectives(
				node.directives
			)}${printBlock(node.fields?.map(printFieldDefinition))}`;
		}
		case Kind.UNION_TYPE_DEFINITION:
			return `${printDescription(node.description, 0)}union ${
				node.name.value
			}${printDirectives(node.directives)}${
				node.types === undefined
					? ''
					: ` = ${node.types.map((type) => type.name.value).join(' | ')}`
			}`;
		case Kind.ENUM_TYPE_DEFINITION:
			return `${printDescription(node.description, 0)}enum ${
				node.name.value
			}${printDirectives(node.directives)}${printBlock(
				node.values?.map(printEnumValueDefinition)
			)}`;
		case Kind.INPUT_OBJECT_TYPE_DEFINITION:
			return `${printDescription(node.description, 0)}input ${
				node.name.value
			}${printDirectives(node.directives)}${printBlock(
				node.fields?.map(
					(field) =>
						`${printDescription(field.description, INDENT_STEP)}${pad(
							INDENT_STEP
						)}${printInputValueDefinition(field)}`
				)
			)}`;
		case Kind.DIRECTIVE_DEFINITION:
			return printDirectiveDefinition(node);
	}
};

/** Render an extension: the same shapes, behind `extend`. */
export const printTypeSystemExtension = (
	node: TypeSystemExtensionNode
): string => {
	switch (node.kind) {
		case Kind.SCHEMA_EXTENSION:
			return `extend schema${printDirectives(node.directives)}${printBlock(
				node.operationTypes?.map(
					(operationType) =>
						`${pad(INDENT_STEP)}${operationType.operation}: ${operationType.type.name.value}`
				)
			)}`;
		case Kind.SCALAR_TYPE_EXTENSION:
			return `extend scalar ${node.name.value}${printDirectives(node.directives)}`;
		case Kind.OBJECT_TYPE_EXTENSION:
		case Kind.INTERFACE_TYPE_EXTENSION: {
			const keyword =
				node.kind === Kind.OBJECT_TYPE_EXTENSION ? 'type' : 'interface';
			return `extend ${keyword} ${node.name.value}${printInterfaces(
				node.interfaces
			)}${printDirectives(node.directives)}${printBlock(
				node.fields?.map(printFieldDefinition)
			)}`;
		}
		case Kind.UNION_TYPE_EXTENSION:
			return `extend union ${node.name.value}${printDirectives(node.directives)}${
				node.types === undefined || node.types.length === 0
					? ''
					: ` = ${node.types.map((type) => type.name.value).join(' | ')}`
			}`;
		case Kind.ENUM_TYPE_EXTENSION:
			return `extend enum ${node.name.value}${printDirectives(
				node.directives
			)}${printBlock(node.values?.map(printEnumValueDefinition))}`;
		case Kind.INPUT_OBJECT_TYPE_EXTENSION:
			return `extend input ${node.name.value}${printDirectives(
				node.directives
			)}${printBlock(
				node.fields?.map(
					(field) =>
						`${printDescription(field.description, INDENT_STEP)}${pad(
							INDENT_STEP
						)}${printInputValueDefinition(field)}`
				)
			)}`;
	}
};
