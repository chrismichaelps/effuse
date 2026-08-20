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

import {
	DIRECTIVE_LOCATION_LABELS,
	type DirectiveLocation,
} from '../../catalog/directive-locations.js';
import type { DirectiveNode, Location } from '../../language/ast/index.js';
import type { ValidationContext } from '../context.js';
import { checkArguments } from './arguments.js';

/** Check the directives written at one place in a request. */
export const checkDirectives = (
	context: ValidationContext,
	directives: readonly DirectiveNode[] | undefined,
	location: DirectiveLocation
): void => {
	const seen = new Set<string>();

	for (const directive of directives ?? []) {
		const name = directive.name.value;
		const definition = context.catalog.getDirective(name);

		if (definition === undefined) {
			context.report(`Unknown directive "@${name}"`, directive);
			continue;
		}

		const allowed = definition.locations.some(
			(candidate) => candidate.value === location
		);
		if (!allowed) {
			const label =
				DIRECTIVE_LOCATION_LABELS[location] ?? location.toLowerCase();
			context.report(
				`Directive "@${name}" cannot be used on ${label}`,
				directive
			);
			continue;
		}

		if (seen.has(name) && !definition.repeatable) {
			context.report(
				`Directive "@${name}" can only be used once per location`,
				directive
			);
			continue;
		}

		seen.add(name);
		checkArguments(
			context,
			directive.arguments,
			definition.arguments,
			`directive "@${name}"`,
			directive as { readonly loc?: Location | undefined }
		);
	}
};
