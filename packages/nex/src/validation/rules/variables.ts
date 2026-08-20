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

import { DirectiveLocation } from '../../catalog/directive-locations.js';
import type { OperationDefinitionNode } from '../../language/ast/index.js';
import { Kind } from '../../language/kinds/index.js';
import type { ValidationContext, VariableUsage } from '../context.js';
import { displayType, isInputName, namedTypeOf } from '../type-utils.js';
import { checkDirectives } from './directives.js';
import { isVariableUsable } from './values.js';

/**
 * Declare an operation's variables in the context, checking each declaration
 * as it goes: names are unique, types are input types, defaults fit.
 */
export const declareVariables = (
	context: ValidationContext,
	operation: OperationDefinitionNode
): void => {
	context.variables.clear();

	for (const definition of operation.variableDefinitions ?? []) {
		const name = definition.variable.name.value;

		if (context.variables.has(name)) {
			context.report(
				`There can be only one variable named "$${name}"`,
				definition
			);
			continue;
		}

		const typeName = namedTypeOf(definition.type);
		if (!isInputName(context.catalog, typeName)) {
			context.report(
				`Type "${typeName}" cannot be used as a variable type for "$${name}"`,
				definition
			);
			continue;
		}

		context.variables.set(name, definition);
		checkDirectives(
			context,
			definition.directives,
			DirectiveLocation.VARIABLE_DEFINITION
		);
	}
};

/** Every variable used must be declared, with a type that fits its place. */
export const checkVariableUsages = (
	context: ValidationContext,
	operation: OperationDefinitionNode,
	usages: readonly VariableUsage[]
): void => {
	const operationName =
		operation.name === undefined
			? ''
			: ` by operation "${operation.name.value}"`;
	const used = new Set<string>();

	for (const usage of usages) {
		const name = usage.variable.name.value;
		const declared = context.variables.get(name);

		if (declared === undefined) {
			context.report(
				`Variable "$${name}" is not defined${operationName}`,
				usage.variable
			);
			continue;
		}

		used.add(name);

		const fits = isVariableUsable(
			declared.type,
			declared.defaultValue !== undefined,
			usage.type
		);
		if (!fits) {
			context.report(
				`Variable "$${name}" of type "${displayType(declared.type)}" cannot be used for ${usage.subject.toLowerCase()} of type "${displayType(usage.type)}"`,
				usage.variable
			);
		}
	}

	for (const [name, definition] of context.variables) {
		if (used.has(name)) continue;
		context.report(`Variable "$${name}" is never used`, definition);
	}
};

/** The kind of operation, spelled as a directive location. */
export const operationLocation = (
	operation: OperationDefinitionNode
): DirectiveLocation =>
	operation.operation === 'mutation'
		? DirectiveLocation.MUTATION
		: operation.operation === 'live'
			? DirectiveLocation.LIVE
			: DirectiveLocation.QUERY;

/** Guard against a document kind that cannot appear here. */
export const isOperation = (kind: string): boolean =>
	kind === Kind.OPERATION_DEFINITION;
