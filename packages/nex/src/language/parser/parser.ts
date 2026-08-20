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

import type { DefinitionNode, DocumentNode } from '../ast/index.js';
import { Kind } from '../kinds/index.js';
import { TokenKind } from '../token/index.js';
import { createCursor, type ParserCursor } from './context.js';
import {
	parseFragmentDefinition,
	parseOperationDefinition,
} from './executable.js';
import { KEYWORD } from './keywords.js';
import {
	atTypeSystemDefinition,
	parseTypeSystemDefinition,
	parseTypeSystemExtension,
} from './type-system.js';

const parseDefinition = (cursor: ParserCursor): DefinitionNode => {
	if (cursor.atKeyword(KEYWORD.EXTEND)) return parseTypeSystemExtension(cursor);
	if (atTypeSystemDefinition(cursor)) return parseTypeSystemDefinition(cursor);
	if (cursor.atKeyword(KEYWORD.FRAGMENT))
		return parseFragmentDefinition(cursor);
	return parseOperationDefinition(cursor);
};

/**
 * Parse `source` into a Nex document.
 *
 * Throws {@link NexSyntaxError}; callers should prefer the `ParserService`,
 * which surfaces the failure in the Effect error channel.
 */
export const parse = (source: string): DocumentNode => {
	const cursor = createCursor(source);
	const startToken = cursor.peek();
	const definitions: DefinitionNode[] = [];

	while (!cursor.at(TokenKind.EOF)) definitions.push(parseDefinition(cursor));

	if (definitions.length === 0) {
		cursor.fail('Expected an operation, fragment, or type system definition');
	}

	return { kind: Kind.DOCUMENT, definitions, loc: cursor.locate(startToken) };
};
