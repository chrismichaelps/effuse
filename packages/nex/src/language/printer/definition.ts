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
	DefinitionNode,
	ExecutableDefinitionNode,
	TypeSystemDefinitionNode,
	TypeSystemExtensionNode,
	VariableDefinitionNode,
} from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import { printDirectives } from './arguments.js';
import { printSelectionSet } from './selection.js';
import {
	printTypeSystemDefinition,
	printTypeSystemExtension,
} from './type-system.js';
import { printType } from './type.js';
import { printValue } from './value.js';

/** Render an operation's variable definitions. */
export const printVariableDefinitions = (
	definitions: readonly VariableDefinitionNode[] | undefined
): string =>
	definitions === undefined || definitions.length === 0
		? ''
		: `(${definitions
				.map(
					(definition) =>
						`$${definition.variable.name.value}: ${printType(definition.type)}${
							definition.defaultValue === undefined
								? ''
								: ` = ${printValue(definition.defaultValue)}`
						}${printDirectives(definition.directives)}`
				)
				.join(', ')})`;

const EXECUTABLE_KINDS: ReadonlySet<string> = new Set([
	Kind.OPERATION_DEFINITION,
	Kind.FRAGMENT_DEFINITION,
]);

const EXTENSION_KINDS: ReadonlySet<string> = new Set([
	Kind.SCHEMA_EXTENSION,
	Kind.SCALAR_TYPE_EXTENSION,
	Kind.OBJECT_TYPE_EXTENSION,
	Kind.INTERFACE_TYPE_EXTENSION,
	Kind.UNION_TYPE_EXTENSION,
	Kind.ENUM_TYPE_EXTENSION,
	Kind.INPUT_OBJECT_TYPE_EXTENSION,
]);

export const printDefinition = (definition: DefinitionNode): string => {
	if (EXTENSION_KINDS.has(definition.kind)) {
		return printTypeSystemExtension(definition as TypeSystemExtensionNode);
	}

	if (!EXECUTABLE_KINDS.has(definition.kind)) {
		return printTypeSystemDefinition(definition as TypeSystemDefinitionNode);
	}

	const executable = definition as ExecutableDefinitionNode;

	if (executable.kind === Kind.FRAGMENT_DEFINITION) {
		return `fragment ${executable.name.value} on ${
			executable.typeCondition.name.value
		}${printDirectives(executable.directives)} ${printSelectionSet(
			executable.selectionSet,
			0
		)}`;
	}

	const isShorthand =
		executable.operation === 'query' &&
		executable.name === undefined &&
		executable.variableDefinitions === undefined &&
		executable.directives === undefined;

	if (isShorthand) return printSelectionSet(executable.selectionSet, 0);

	return `${executable.operation}${
		executable.name === undefined ? '' : ` ${executable.name.value}`
	}${printVariableDefinitions(executable.variableDefinitions)}${printDirectives(
		executable.directives
	)} ${printSelectionSet(executable.selectionSet, 0)}`;
};
