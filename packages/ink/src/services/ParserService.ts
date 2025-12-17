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

import { Effect, Context, Layer, pipe } from 'effect';
import { loadInkConfig } from '../config/InkConfig.js';
import { tokenize, type Token } from '../parser/tokenizer.js';
import { parseTokens } from '../parser/parser.js';
import type { ParseError } from '../types/errors.js';
import type { DocumentNode, BlockNode, InlineNode } from '../types/ast.js';

export interface ParserServiceInterface {
	readonly tokenize: (input: string) => Effect.Effect<Token[], ParseError>;
	readonly parse: (tokens: Token[]) => Effect.Effect<DocumentNode, ParseError>;
	readonly parseMarkdown: (
		input: string
	) => Effect.Effect<DocumentNode, ParseError>;
}

export class ParserService extends Context.Tag('ink/ParserService')<
	ParserService,
	ParserServiceInterface
>() {}

const make: ParserServiceInterface = {
	tokenize: (input: string) => tokenize(input),

	parse: (tokens: Token[]) => parseTokens(tokens),

	parseMarkdown: (input: string) =>
		pipe(tokenize(input), Effect.flatMap(parseTokens)),
};

export const ParserServiceLive = Layer.succeed(ParserService, make);

const getMaxDepth = (node: DocumentNode | BlockNode | InlineNode): number => {
	if (!('children' in node) || !Array.isArray(node.children)) {
		return 1;
	}
	let max = 0;
	for (const child of node.children as (BlockNode | InlineNode)[]) {
		max = Math.max(max, getMaxDepth(child));
	}
	return 1 + max;
};

export const parseMarkdown = (
	input: string
): Effect.Effect<DocumentNode, ParseError, ParserService> =>
	Effect.gen(function* () {
		const parser = yield* ParserService;
		const config = yield* Effect.orDie(loadInkConfig);
		const doc = yield* parser.parseMarkdown(input);

		if (config.maxNestingDepth > 0) {
			const depth = getMaxDepth(doc);
			if (depth > config.maxNestingDepth) {
				return yield* Effect.fail({
					_tag: 'ParseError',
					message: `Maximum nesting depth of ${String(config.maxNestingDepth)} exceeded (actual: ${String(depth)})`,
					line: 0,
					column: 0,
				} as ParseError);
			}
		}

		return doc;
	});
