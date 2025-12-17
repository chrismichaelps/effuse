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

import { Effect } from 'effect';
import type { EffuseChild } from '@effuse/core';
import { InkLive, renderMarkdown } from './services/index.js';
import type { ComponentMap } from './renderer/transformer.js';
import type { DocumentNode } from './types/ast.js';
import type { ParseError } from './types/errors.js';
import {
	parse as parseEffect,
	parseSync as parseSyncInternal,
} from './parser/index.js';
import { transformDocument } from './renderer/transformer.js';

export { Ink } from './renderer/index.js';
export { transformDocument, type ComponentMap } from './renderer/index.js';
export { InkProseLayer } from './styles/index.js';

export type { EffuseLayer } from '@effuse/core';

export type {
	MarkdownNode,
	BlockNode,
	InlineNode,
	DocumentNode,
	HeadingNode,
	ParagraphNode,
	CodeBlockNode,
	BlockquoteNode,
	ListNode,
	ListItemNode,
	HorizontalRuleNode,
	ComponentNode,
	TextNode,
	InlineCodeNode,
	EmphasisNode,
	LinkNode,
	ImageNode,
	InkProps,
} from './types/index.js';

export {
	ParseError,
	ComponentNotFoundError,
	InvalidPropsError,
	SanitizationError,
	TransformError,
	type InkError,
} from './types/index.js';

export {
	SourcePositionSchema,
	SourceRangeSchema,
	DocumentNodeSchema,
	BlockNodeSchema,
	InlineNodeSchema,
} from './schemas/ast.js';

export {
	InkConfig,
	type InkConfigType,
	defaultInkConfig,
} from './config/index.js';

export const parse = (input: string): DocumentNode => {
	return Effect.runSync(
		Effect.catchAll(parseEffect(input), () =>
			Effect.succeed({
				type: 'document' as const,
				children: [],
			})
		)
	);
};

export const parseSync = parseSyncInternal;

export const render = (
	input: string,
	components: ComponentMap = {}
): EffuseChild[] => {
	const program = renderMarkdown(input, components).pipe(
		Effect.provide(InkLive),
		Effect.catchAll(() => Effect.succeed([] as EffuseChild[]))
	);
	return Effect.runSync(program);
};

export const renderEffect = (
	input: string,
	components: ComponentMap = {}
): Effect.Effect<EffuseChild[], ParseError> => {
	return Effect.gen(function* () {
		const doc = yield* parseEffect(input);
		return transformDocument(doc, components);
	});
};
