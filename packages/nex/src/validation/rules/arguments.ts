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
	ArgumentNode,
	InputValueDefinitionNode,
	Location,
} from '../../language/ast/index.js';
import { Kind } from '../../language/kinds/index.js';
import type { ValidationContext } from '../context.js';
import { displayType } from '../type-utils.js';
import { checkValue } from './values.js';

/**
 * Check the arguments written at a call site against the ones declared for it.
 *
 * `subject` names the call site, for example `field "user"`.
 */
export const checkArguments = (
	context: ValidationContext,
	provided: readonly ArgumentNode[] | undefined,
	declared: readonly InputValueDefinitionNode[] | undefined,
	subject: string,
	node: { readonly loc?: Location | undefined }
): void => {
	const definitions = new Map<string, InputValueDefinitionNode>(
		(declared ?? []).map((definition) => [definition.name.value, definition])
	);
	const seen = new Set<string>();

	for (const argument of provided ?? []) {
		const name = argument.name.value;
		const definition = definitions.get(name);

		if (definition === undefined) {
			context.report(`Unknown argument "${name}" on ${subject}`, argument);
			continue;
		}
		if (seen.has(name)) {
			context.report(`Argument "${name}" is provided more than once`, argument);
			continue;
		}

		seen.add(name);
		checkValue(context, argument.value, definition.type, `Argument "${name}"`);
	}

	for (const definition of declared ?? []) {
		const name = definition.name.value;
		const isRequired =
			definition.type.kind === Kind.NON_NULL_TYPE &&
			definition.defaultValue === undefined;

		if (isRequired && !seen.has(name)) {
			context.report(
				`Argument "${name}" of type "${displayType(definition.type)}" is required by ${subject}`,
				node
			);
		}
	}
};
