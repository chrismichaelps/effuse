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

import { Schema } from 'effect';

export const SourcePositionSchema = Schema.Struct({
	line: Schema.Number,
	column: Schema.Number,
	offset: Schema.Number,
});

export const SourceRangeSchema = Schema.Struct({
	start: SourcePositionSchema,
	end: SourcePositionSchema,
});

export const TextNodeSchema = Schema.Struct({
	type: Schema.Literal('text'),
	value: Schema.String,
	position: Schema.optional(SourceRangeSchema),
});

export const InlineCodeNodeSchema = Schema.Struct({
	type: Schema.Literal('inlineCode'),
	value: Schema.String,
	position: Schema.optional(SourceRangeSchema),
});

export const LineBreakNodeSchema = Schema.Struct({
	type: Schema.Literal('lineBreak'),
	position: Schema.optional(SourceRangeSchema),
});

export const ImageNodeSchema = Schema.Struct({
	type: Schema.Literal('image'),
	url: Schema.String,
	alt: Schema.String,
	title: Schema.optional(Schema.String),
	position: Schema.optional(SourceRangeSchema),
});

export const EmphasisNodeSchema = Schema.Struct({
	type: Schema.Literal('emphasis'),
	style: Schema.Union(
		Schema.Literal('italic'),
		Schema.Literal('bold'),
		Schema.Literal('strikethrough')
	),
	children: Schema.Array(Schema.Unknown),
	position: Schema.optional(SourceRangeSchema),
});

export const LinkNodeSchema = Schema.Struct({
	type: Schema.Literal('link'),
	url: Schema.String,
	title: Schema.optional(Schema.String),
	children: Schema.Array(Schema.Unknown),
	position: Schema.optional(SourceRangeSchema),
});

export const ComponentPropsSchema = Schema.Record({
	key: Schema.String,
	value: Schema.Unknown,
});

export const ComponentNodeSchema = Schema.Struct({
	type: Schema.Literal('component'),
	name: Schema.String,
	props: ComponentPropsSchema,
	children: Schema.Array(Schema.Unknown),
	slots: Schema.Record({
		key: Schema.String,
		value: Schema.Array(Schema.Unknown),
	}),
	selfClosing: Schema.Boolean,
	position: Schema.optional(SourceRangeSchema),
});

export const HeadingNodeSchema = Schema.Struct({
	type: Schema.Literal('heading'),
	level: Schema.Union(
		Schema.Literal(1),
		Schema.Literal(2),
		Schema.Literal(3),
		Schema.Literal(4),
		Schema.Literal(5),
		Schema.Literal(6)
	),
	children: Schema.Array(Schema.Unknown),
	position: Schema.optional(SourceRangeSchema),
});

export const ParagraphNodeSchema = Schema.Struct({
	type: Schema.Literal('paragraph'),
	children: Schema.Array(Schema.Unknown),
	position: Schema.optional(SourceRangeSchema),
});

export const CodeBlockNodeSchema = Schema.Struct({
	type: Schema.Literal('codeBlock'),
	language: Schema.optional(Schema.String),
	code: Schema.String,
	position: Schema.optional(SourceRangeSchema),
});

export const BlockquoteNodeSchema = Schema.Struct({
	type: Schema.Literal('blockquote'),
	children: Schema.Array(Schema.Unknown),
	position: Schema.optional(SourceRangeSchema),
});

export const ListItemNodeSchema = Schema.Struct({
	type: Schema.Literal('listItem'),
	checked: Schema.optional(Schema.Boolean),
	children: Schema.Array(Schema.Unknown),
	position: Schema.optional(SourceRangeSchema),
});

export const ListNodeSchema = Schema.Struct({
	type: Schema.Literal('list'),
	ordered: Schema.Boolean,
	start: Schema.optional(Schema.Number),
	children: Schema.Array(ListItemNodeSchema),
	position: Schema.optional(SourceRangeSchema),
});

export const HorizontalRuleNodeSchema = Schema.Struct({
	type: Schema.Literal('horizontalRule'),
	position: Schema.optional(SourceRangeSchema),
});

export const BlockNodeSchema = Schema.Union(
	HeadingNodeSchema,
	ParagraphNodeSchema,
	CodeBlockNodeSchema,
	BlockquoteNodeSchema,
	ListNodeSchema,
	HorizontalRuleNodeSchema,
	ComponentNodeSchema
);

export const DocumentNodeSchema = Schema.Struct({
	type: Schema.Literal('document'),
	children: Schema.Array(BlockNodeSchema),
});

export const InlineNodeSchema = Schema.Union(
	TextNodeSchema,
	InlineCodeNodeSchema,
	EmphasisNodeSchema,
	LinkNodeSchema,
	ImageNodeSchema,
	LineBreakNodeSchema,
	ComponentNodeSchema
);
