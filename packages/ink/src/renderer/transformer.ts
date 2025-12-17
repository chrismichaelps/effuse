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
	jsx,
	EFFUSE_NODE,
	NodeType,
	type EffuseChild,
	type ElementNode,
} from '@effuse/core';
import type {
	BlockNode,
	InlineNode,
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
	DocumentNode,
	TableNode,
} from '../types/ast.js';
import { highlight } from '../highlighter/index.js';

export type ComponentMap = Record<string, unknown>;

const transformText = (node: TextNode): string => node.value;

const transformInlineCode = (node: InlineCodeNode): ElementNode => ({
	[EFFUSE_NODE]: true,
	type: NodeType.ELEMENT,
	tag: 'code',
	props: { class: 'ink-inline-code' },
	children: [node.value],
});

const transformEmphasis = (
	node: EmphasisNode,
	components: ComponentMap
): ElementNode => {
	const tag =
		node.style === 'bold'
			? 'strong'
			: node.style === 'strikethrough'
				? 'del'
				: 'em';

	return {
		[EFFUSE_NODE]: true,
		type: NodeType.ELEMENT,
		tag,
		props: {},
		children: node.children.map((child) => transformInline(child, components)),
	};
};

const transformLink = (
	node: LinkNode,
	components: ComponentMap
): ElementNode => ({
	[EFFUSE_NODE]: true,
	type: NodeType.ELEMENT,
	tag: 'a',
	props: {
		href: node.url,
		title: node.title,
		class: 'ink-link',
	},
	children: node.children.map((child) => transformInline(child, components)),
});

const transformImage = (node: ImageNode): ElementNode => ({
	[EFFUSE_NODE]: true,
	type: NodeType.ELEMENT,
	tag: 'img',
	props: {
		src: node.url,
		alt: node.alt,
		title: node.title,
		class: 'ink-image',
	},
	children: [],
});

const transformInline = (
	node: InlineNode,
	components: ComponentMap
): EffuseChild => {
	switch (node.type) {
		case 'text':
			return transformText(node);
		case 'inlineCode':
			return transformInlineCode(node);
		case 'emphasis':
			return transformEmphasis(node, components);
		case 'link':
			return transformLink(node, components);
		case 'image':
			return transformImage(node);
		case 'lineBreak':
			return {
				[EFFUSE_NODE]: true,
				type: NodeType.ELEMENT,
				tag: 'br',
				props: {},
				children: [],
			};
		case 'component':
			return transformComponent(node, components);
		default:
			return '';
	}
};

const transformHeading = (
	node: HeadingNode,
	components: ComponentMap
): ElementNode => ({
	[EFFUSE_NODE]: true,
	type: NodeType.ELEMENT,
	tag: `h${String(node.level)}`,
	props: { class: `ink-h${String(node.level)}` },
	children: node.children.map((child) => transformInline(child, components)),
});

const transformParagraph = (
	node: ParagraphNode,
	components: ComponentMap
): ElementNode => ({
	[EFFUSE_NODE]: true,
	type: NodeType.ELEMENT,
	tag: 'p',
	props: { class: 'ink-p' },
	children: node.children.map((child) => transformInline(child, components)),
});

const transformCodeBlock = (node: CodeBlockNode): ElementNode => ({
	[EFFUSE_NODE]: true,
	type: NodeType.ELEMENT,
	tag: 'pre',
	props: {
		class: `ink-code-block${node.language ? ` language-${node.language}` : ''}`,
	},
	children: [
		{
			[EFFUSE_NODE]: true,
			type: NodeType.ELEMENT,
			tag: 'code',
			props: node.language ? { 'data-language': node.language } : {},
			children: highlight(node.code, node.language),
		},
	],
});

const transformBlockquote = (
	node: BlockquoteNode,
	components: ComponentMap
): ElementNode => ({
	[EFFUSE_NODE]: true,
	type: NodeType.ELEMENT,
	tag: 'blockquote',
	props: { class: 'ink-blockquote' },
	children: node.children.map((child) => transformBlock(child, components)),
});

const transformListItem = (
	node: ListItemNode,
	components: ComponentMap
): ElementNode => {
	const isTaskItem = node.checked !== undefined;

	let children: EffuseChild[];
	if (isTaskItem && node.children.length > 0) {
		children = node.children.flatMap((child) => {
			if (child.type === 'paragraph') {
				return child.children.map((inline) =>
					transformInline(inline, components)
				);
			}
			return [transformBlock(child, components)];
		});
	} else {
		children = node.children.map((child) => transformBlock(child, components));
	}

	if (isTaskItem) {
		const checkbox: ElementNode = {
			[EFFUSE_NODE]: true,
			type: NodeType.ELEMENT,
			tag: 'input',
			props: {
				type: 'checkbox',
				checked: node.checked,
				disabled: true,
				class: 'ink-task-checkbox',
			},
			children: [],
		};

		const textSpan: ElementNode = {
			[EFFUSE_NODE]: true,
			type: NodeType.ELEMENT,
			tag: 'span',
			props: { class: 'ink-task-text' },
			children,
		};
		children = [checkbox, textSpan];
	}

	return {
		[EFFUSE_NODE]: true,
		type: NodeType.ELEMENT,
		tag: 'li',
		props: {
			class: isTaskItem ? 'ink-task-item' : 'ink-list-item',
		},
		children,
	};
};

const transformList = (
	node: ListNode,
	components: ComponentMap
): ElementNode => ({
	[EFFUSE_NODE]: true,
	type: NodeType.ELEMENT,
	tag: node.ordered ? 'ol' : 'ul',
	props: {
		class: node.ordered ? 'ink-ol' : 'ink-ul',
		start: node.ordered && node.start !== 1 ? node.start : undefined,
	},
	children: node.children.map((item) => transformListItem(item, components)),
});

const transformHorizontalRule = (_node: HorizontalRuleNode): ElementNode => ({
	[EFFUSE_NODE]: true,
	type: NodeType.ELEMENT,
	tag: 'hr',
	props: { class: 'ink-hr' },
	children: [],
});

const transformComponent = (
	node: ComponentNode,
	components: ComponentMap
): EffuseChild => {
	const Component = components[node.name];

	if (!Component) {
		return {
			[EFFUSE_NODE]: true,
			type: NodeType.ELEMENT,
			tag: 'div',
			props: {
				class: 'ink-unknown-component',
				'data-component': node.name,
			},
			children: [`Unknown component: ${node.name}`],
		};
	}

	const defaultSlotChildren = node.children.map((child) =>
		transformBlock(child as BlockNode, components)
	);

	const slots: Record<string, EffuseChild[]> = {};
	for (const [slotName, slotNodes] of Object.entries(node.slots)) {
		slots[slotName] = slotNodes.map((child) =>
			transformBlock(child as BlockNode, components)
		);
	}

	const props = {
		...node.props,
		children: defaultSlotChildren.length > 0 ? defaultSlotChildren : undefined,
		slots: Object.keys(slots).length > 0 ? slots : undefined,
	};

	return jsx(Component as unknown as string, props);
};

const transformTable = (
	node: TableNode,
	components: ComponentMap
): ElementNode => {
	const headerCells = node.header.cells.map((cell, i) => {
		const align = node.alignments[i];
		return {
			[EFFUSE_NODE]: true,
			type: NodeType.ELEMENT,
			tag: 'th',
			props: {
				class: 'ink-th',
				style: align ? { textAlign: align } : undefined,
			},
			children: cell.children.map((child) =>
				transformInline(child, components)
			),
		} as ElementNode;
	});

	const headerRow: ElementNode = {
		[EFFUSE_NODE]: true,
		type: NodeType.ELEMENT,
		tag: 'tr',
		props: { class: 'ink-tr' },
		children: headerCells,
	};

	const bodyRows = node.rows.map((row) => {
		const cells = row.cells.map((cell, i) => {
			const align = node.alignments[i];
			return {
				[EFFUSE_NODE]: true,
				type: NodeType.ELEMENT,
				tag: 'td',
				props: {
					class: 'ink-td',
					style: align ? { textAlign: align } : undefined,
				},
				children: cell.children.map((child) =>
					transformInline(child, components)
				),
			} as ElementNode;
		});
		return {
			[EFFUSE_NODE]: true,
			type: NodeType.ELEMENT,
			tag: 'tr',
			props: { class: 'ink-tr' },
			children: cells,
		} as ElementNode;
	});

	return {
		[EFFUSE_NODE]: true,
		type: NodeType.ELEMENT,
		tag: 'table',
		props: { class: 'ink-table' },
		children: [
			{
				[EFFUSE_NODE]: true,
				type: NodeType.ELEMENT,
				tag: 'thead',
				props: { class: 'ink-thead' },
				children: [headerRow],
			},
			{
				[EFFUSE_NODE]: true,
				type: NodeType.ELEMENT,
				tag: 'tbody',
				props: { class: 'ink-tbody' },
				children: bodyRows,
			},
		],
	};
};

const transformBlock = (
	node: BlockNode,
	components: ComponentMap
): EffuseChild => {
	switch (node.type) {
		case 'heading':
			return transformHeading(node, components);
		case 'paragraph':
			return transformParagraph(node, components);
		case 'codeBlock':
			return transformCodeBlock(node);
		case 'blockquote':
			return transformBlockquote(node, components);
		case 'list':
			return transformList(node, components);
		case 'horizontalRule':
			return transformHorizontalRule(node);
		case 'table':
			return transformTable(node, components);
		case 'component':
			return transformComponent(node, components);
		default:
			return '';
	}
};

export const transformDocument = (
	doc: DocumentNode,
	components: ComponentMap = {}
): EffuseChild[] =>
	doc.children.map((node) => transformBlock(node, components));
