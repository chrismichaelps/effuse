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
	FragmentDefinitionNode,
	FragmentSpreadNode,
} from '../../language/ast/index.js';
import { Kind } from '../../language/kinds/index.js';
import type { ValidationContext } from '../context.js';
import { checkValue } from './values.js';

/**
 * Whether a spread gives a fragment what it says it takes.
 *
 * A fragment that says what it needs is the same fragment wherever it is
 * used; one that reads whatever variables happen to be around is only usable
 * where those happen to exist. So what it declares is what it gets, and
 * anything else at the spread is a mistake worth naming.
 */
export const checkFragmentArguments = (
	context: ValidationContext,
	fragment: FragmentDefinitionNode,
	spread: FragmentSpreadNode
): void => {
	const declared = fragment.variableDefinitions ?? [];
	const written = new Map(
		(spread.arguments ?? []).map((argument) => [argument.name.value, argument])
	);
	const name = fragment.name.value;

	for (const definition of declared) {
		const variable = definition.variable.name.value;
		const given = written.get(variable);

		if (given === undefined) {
			// A default is the fragment answering for itself, so only what has
			// no answer at all is missing.
			if (
				definition.defaultValue === undefined &&
				definition.type.kind === Kind.NON_NULL_TYPE
			) {
				context.report(
					`Fragment "${name}" needs "${variable}", which this spread does not give it`,
					spread
				);
			}
			continue;
		}

		checkValue(
			context,
			given.value,
			definition.type,
			`Argument "${variable}" of fragment "${name}"`
		);
	}

	for (const [variable, argument] of written) {
		const known = declared.some(
			(definition) => definition.variable.name.value === variable
		);
		if (known) continue;

		context.report(
			`Fragment "${name}" does not take "${variable}"`,
			argument.value
		);
	}
};
