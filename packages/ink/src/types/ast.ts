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

import { Data } from 'effect';
import type { InkComponents } from '../renderer/transformer.js';

export interface SourcePosition {
	readonly line: number;
	readonly column: number;
	readonly offset: number;
}

export interface SourceRange {
	readonly start: SourcePosition;
	readonly end: SourcePosition;
}

interface BaseNodeFields {
	readonly position?: SourceRange;
}

export type InlineNode = Data.TaggedEnum<{
	Text: BaseNodeFields & { readonly value: string };
	InlineCode: BaseNodeFields & { readonly value: string };
	Emphasis: BaseNodeFields & {
		readonly style: 'italic' | 'bold' | 'strikethrough';
		readonly children: InlineNode[];
	};
	Link: BaseNodeFields & {
		readonly url: string;
		readonly title?: string;
		readonly children: InlineNode[];
	};
	Image: BaseNodeFields & {
		readonly url: string;
		readonly alt: string;
		readonly title?: string;
	};
	LineBreak: BaseNodeFields;
	InlineComponent: BaseNodeFields & {
		readonly name: string;
		readonly props: Record<string, unknown>;
		readonly children: MarkdownNode[];
		readonly slots: Record<string, MarkdownNode[]>;
		readonly selfClosing: boolean;
	};
}>;

const InlineNodeEnum = Data.taggedEnum<InlineNode>();

export const {
	Text: TextNode,
	InlineCode: InlineCodeNode,
	Emphasis: EmphasisNode,
	Link: LinkNode,
	Image: ImageNode,
	LineBreak: LineBreakNode,
	InlineComponent: InlineComponentNode,
	$is: InlineNode$is,
	$match: InlineNode$match,
} = InlineNodeEnum;

export type TextNode = Extract<InlineNode, { _tag: 'Text' }>;
export type InlineCodeNode = Extract<InlineNode, { _tag: 'InlineCode' }>;
export type EmphasisNode = Extract<InlineNode, { _tag: 'Emphasis' }>;
export type LinkNode = Extract<InlineNode, { _tag: 'Link' }>;
export type ImageNode = Extract<InlineNode, { _tag: 'Image' }>;
export type LineBreakNode = Extract<InlineNode, { _tag: 'LineBreak' }>;

export type ListItemNode = {
	readonly _tag: 'ListItem';
	readonly position?: SourceRange;
	readonly checked?: boolean;
	readonly children: BlockNode[];
};

export type TableRowNode = {
	readonly _tag: 'TableRow';
	readonly position?: SourceRange;
	readonly cells: TableCellNode[];
};

export type TableCellNode = {
	readonly _tag: 'TableCell';
	readonly position?: SourceRange;
	readonly children: InlineNode[];
};

export const ListItemNode = (
	args: Omit<ListItemNode, '_tag'>
): ListItemNode => ({
	_tag: 'ListItem',
	...args,
});

export const TableRowNode = (
	args: Omit<TableRowNode, '_tag'>
): TableRowNode => ({
	_tag: 'TableRow',
	...args,
});

export const TableCellNode = (
	args: Omit<TableCellNode, '_tag'>
): TableCellNode => ({
	_tag: 'TableCell',
	...args,
});

export type BlockNode = Data.TaggedEnum<{
	Heading: BaseNodeFields & {
		readonly level: 1 | 2 | 3 | 4 | 5 | 6;
		readonly children: InlineNode[];
	};
	Paragraph: BaseNodeFields & { readonly children: InlineNode[] };
	CodeBlock: BaseNodeFields & {
		readonly language?: string;
		readonly code: string;
	};
	Blockquote: BaseNodeFields & { readonly children: BlockNode[] };
	List: BaseNodeFields & {
		readonly ordered: boolean;
		readonly start?: number;
		readonly children: ListItemNode[];
	};
	HorizontalRule: BaseNodeFields;
	Table: BaseNodeFields & {
		readonly header: TableRowNode;
		readonly rows: TableRowNode[];
		readonly alignments: ('left' | 'center' | 'right' | null)[];
	};
	Component: BaseNodeFields & {
		readonly name: string;
		readonly props: Record<string, unknown>;
		readonly children: MarkdownNode[];
		readonly slots: Record<string, MarkdownNode[]>;
		readonly selfClosing: boolean;
	};
}>;

const BlockNodeEnum = Data.taggedEnum<BlockNode>();

export const {
	Heading: HeadingNode,
	Paragraph: ParagraphNode,
	CodeBlock: CodeBlockNode,
	Blockquote: BlockquoteNode,
	List: ListNode,
	HorizontalRule: HorizontalRuleNode,
	Table: TableNode,
	Component: ComponentNode,
	$is: BlockNode$is,
	$match: BlockNode$match,
} = BlockNodeEnum;

export type HeadingNode = Extract<BlockNode, { _tag: 'Heading' }>;
export type ParagraphNode = Extract<BlockNode, { _tag: 'Paragraph' }>;
export type CodeBlockNode = Extract<BlockNode, { _tag: 'CodeBlock' }>;
export type BlockquoteNode = Extract<BlockNode, { _tag: 'Blockquote' }>;
export type ListNode = Extract<BlockNode, { _tag: 'List' }>;
export type HorizontalRuleNode = Extract<BlockNode, { _tag: 'HorizontalRule' }>;
export type TableNode = Extract<BlockNode, { _tag: 'Table' }>;
export type ComponentNode = Extract<BlockNode, { _tag: 'Component' }>;

export type MarkdownNode =
	| BlockNode
	| InlineNode
	| ListItemNode
	| TableRowNode
	| TableCellNode;

export type DocumentNode = {
	readonly _tag: 'Document';
	readonly position?: SourceRange;
	readonly children: BlockNode[];
};

export const DocumentNode = (
	args: Omit<DocumentNode, '_tag'>
): DocumentNode => ({
	_tag: 'Document',
	...args,
});

export interface InkProps {
	readonly [key: string]: unknown;
	readonly content: string | { readonly value: string };
	readonly components?: InkComponents;
	readonly class?: string;
}
