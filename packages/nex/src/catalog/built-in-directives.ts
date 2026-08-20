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

import type { DirectiveDefinitionNode } from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { DirectiveLocation } from './directive-locations.js';

const name = (value: string) => ({ kind: Kind.NAME, value }) as const;

const namedType = (value: string) =>
	({ kind: Kind.NAMED_TYPE, name: name(value) }) as const;

const nonNull = (value: string) =>
	({ kind: Kind.NON_NULL_TYPE, type: namedType(value) }) as const;

const input = (
	argumentName: string,
	type: ReturnType<typeof namedType> | ReturnType<typeof nonNull>
) =>
	({
		kind: Kind.INPUT_VALUE_DEFINITION,
		name: name(argumentName),
		type,
	}) as const;

const directive = (
	directiveName: string,
	options: {
		readonly arguments?: readonly ReturnType<typeof input>[];
		readonly repeatable?: boolean;
		readonly locations: readonly string[];
	}
): DirectiveDefinitionNode => ({
	kind: Kind.DIRECTIVE_DEFINITION,
	name: name(directiveName),
	...(options.arguments === undefined ? {} : { arguments: options.arguments }),
	repeatable: options.repeatable ?? false,
	locations: options.locations.map(name),
});

const CONDITIONAL_LOCATIONS = [
	DirectiveLocation.FIELD,
	DirectiveLocation.FRAGMENT_SPREAD,
	DirectiveLocation.INLINE_FRAGMENT,
];

const OPERATION_LOCATIONS = [
	DirectiveLocation.QUERY,
	DirectiveLocation.MUTATION,
	DirectiveLocation.LIVE,
];

/**
 * The directives every catalog understands, from specification section 2.9.
 *
 * A catalog may redeclare any of them; its own definition wins.
 */
export const BUILT_IN_DIRECTIVES: readonly DirectiveDefinitionNode[] = [
	directive('include', {
		arguments: [input('if', nonNull('Boolean'))],
		locations: CONDITIONAL_LOCATIONS,
	}),
	directive('skip', {
		arguments: [input('if', nonNull('Boolean'))],
		locations: CONDITIONAL_LOCATIONS,
	}),
	directive('deprecated', {
		arguments: [input('reason', namedType('String'))],
		locations: [
			DirectiveLocation.FIELD_DEFINITION,
			DirectiveLocation.ARGUMENT_DEFINITION,
			DirectiveLocation.INPUT_FIELD_DEFINITION,
			DirectiveLocation.ENUM_VALUE,
		],
	}),
	directive('connection', {
		locations: [DirectiveLocation.FIELD_DEFINITION],
	}),
	directive('cost', {
		arguments: [input('value', nonNull('Int'))],
		locations: [
			DirectiveLocation.FIELD,
			DirectiveLocation.FIELD_DEFINITION,
			DirectiveLocation.OBJECT,
			...OPERATION_LOCATIONS,
		],
	}),
	directive('identity', {
		arguments: [input('field', namedType('String'))],
		locations: [DirectiveLocation.OBJECT],
	}),
	directive('auth', {
		arguments: [input('requires', namedType('String'))],
		locations: [
			DirectiveLocation.FIELD,
			DirectiveLocation.FIELD_DEFINITION,
			DirectiveLocation.OBJECT,
			...OPERATION_LOCATIONS,
		],
	}),
];
