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
	FieldNode,
	SelectionNode,
	SelectionSetNode,
} from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import { INDENT_STEP as INDENT_WIDTH, pad } from '../../utils/index.js';
import { printArguments, printDirectives } from './arguments.js';
import { printStage } from './pipeline.js';

/** Render a selection set, including its braces. */
export const printSelectionSet = (
	set: SelectionSetNode,
	indent: number
): string => {
	const inner = set.selections
		.map((selection) => printSelection(selection, indent + INDENT_WIDTH))
		.join('\n');
	return `{\n${inner}\n${pad(indent)}}`;
};

const printField = (field: FieldNode, indent: number): string => {
	const head = `${pad(indent)}${field.alias === undefined ? '' : `${field.alias.value}: `}${
		field.name.value
	}${printArguments(field.arguments)}${printDirectives(field.directives)}`;

	const lines =
		field.pipeline === undefined
			? [head]
			: [
					head,
					...field.pipeline.map(
						(stage) => `${pad(indent + INDENT_WIDTH)}| ${printStage(stage)}`
					),
				];

	if (field.selectionSet !== undefined) {
		const last = lines.length - 1;
		lines[last] =
			`${lines[last] ?? ''} ${printSelectionSet(field.selectionSet, indent)}`;
	}

	return lines.join('\n');
};

const printSelection = (selection: SelectionNode, indent: number): string => {
	switch (selection.kind) {
		case Kind.FIELD:
			return printField(selection, indent);
		case Kind.FRAGMENT_SPREAD:
			return `${pad(indent)}...${selection.name.value}${printDirectives(selection.directives)}`;
		case Kind.INLINE_FRAGMENT: {
			const condition =
				selection.typeCondition === undefined
					? ''
					: ` on ${selection.typeCondition.name.value}`;
			return `${pad(indent)}...${condition}${printDirectives(
				selection.directives
			)} ${printSelectionSet(selection.selectionSet, indent)}`;
		}
	}
};
