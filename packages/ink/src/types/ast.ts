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

export interface SourcePosition {
	readonly line: number;
	readonly column: number;
	readonly offset: number;
}

export interface SourceRange {
	readonly start: SourcePosition;
	readonly end: SourcePosition;
}

interface BaseNode {
	readonly type: string;
	readonly position?: SourceRange;
}

export interface HeadingNode extends BaseNode {
	readonly type: 'heading';
	readonly level: 1 | 2 | 3 | 4 | 5 | 6;
	readonly children: InlineNode[];
}

export interface ParagraphNode extends BaseNode {
	readonly type: 'paragraph';
	readonly children: InlineNode[];
}

export interface CodeBlockNode extends BaseNode {
	readonly type: 'codeBlock';
	readonly language?: string;
	readonly code: string;
}

export interface BlockquoteNode extends BaseNode {
	readonly type: 'blockquote';
	readonly children: BlockNode[];
}

export interface ListNode extends BaseNode {
	readonly type: 'list';
	readonly ordered: boolean;
	readonly start?: number;
	readonly children: ListItemNode[];
}

export interface ListItemNode extends BaseNode {
	readonly type: 'listItem';
	readonly checked?: boolean;
	readonly children: BlockNode[];
}

export interface HorizontalRuleNode extends BaseNode {
	readonly type: 'horizontalRule';
}

export interface TableNode extends BaseNode {
	readonly type: 'table';
	readonly header: TableRowNode;
	readonly rows: TableRowNode[];
	readonly alignments: ('left' | 'center' | 'right' | null)[];
}

export interface TableRowNode extends BaseNode {
	readonly type: 'tableRow';
	readonly cells: TableCellNode[];
}

export interface TableCellNode extends BaseNode {
	readonly type: 'tableCell';
	readonly children: InlineNode[];
}

export interface ComponentNode extends BaseNode {
	readonly type: 'component';
	readonly name: string;
	readonly props: Record<string, unknown>;
	readonly children: MarkdownNode[];
	readonly slots: Record<string, MarkdownNode[]>;
	readonly selfClosing: boolean;
}

export interface TextNode extends BaseNode {
	readonly type: 'text';
	readonly value: string;
}

export interface InlineCodeNode extends BaseNode {
	readonly type: 'inlineCode';
	readonly value: string;
}

export interface EmphasisNode extends BaseNode {
	readonly type: 'emphasis';
	readonly style: 'italic' | 'bold' | 'strikethrough';
	readonly children: InlineNode[];
}

export interface LinkNode extends BaseNode {
	readonly type: 'link';
	readonly url: string;
	readonly title?: string;
	readonly children: InlineNode[];
}

export interface ImageNode extends BaseNode {
	readonly type: 'image';
	readonly url: string;
	readonly alt: string;
	readonly title?: string;
}

export interface LineBreakNode extends BaseNode {
	readonly type: 'lineBreak';
}

export type BlockNode =
	| HeadingNode
	| ParagraphNode
	| CodeBlockNode
	| BlockquoteNode
	| ListNode
	| HorizontalRuleNode
	| TableNode
	| ComponentNode;

export type InlineNode =
	| TextNode
	| InlineCodeNode
	| EmphasisNode
	| LinkNode
	| ImageNode
	| LineBreakNode
	| ComponentNode;

export type MarkdownNode =
	| BlockNode
	| InlineNode
	| ListItemNode
	| TableRowNode
	| TableCellNode;

export interface DocumentNode extends BaseNode {
	readonly type: 'document';
	readonly children: BlockNode[];
}

export interface InkProps {
	readonly [key: string]: unknown;
	readonly content: string;
	readonly components?: Record<string, unknown>;
	readonly class?: string;
}
