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
	CreateElementNode,
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

const transformInlineCode = (node: InlineCodeNode): ElementNode =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
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

	return CreateElementNode({
		[EFFUSE_NODE]: true,
		tag,
		props: {},
		children: node.children.map((child) => transformInline(child, components)),
	});
};

const transformLink = (node: LinkNode, components: ComponentMap): ElementNode =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'a',
		props: {
			href: node.url,
			title: node.title,
			class: 'ink-link',
		},
		children: node.children.map((child) => transformInline(child, components)),
	});

const transformImage = (node: ImageNode): ElementNode =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
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
	switch (node._tag) {
		case 'Text':
			return transformText(node);
		case 'InlineCode':
			return transformInlineCode(node);
		case 'Emphasis':
			return transformEmphasis(node, components);
		case 'Link':
			return transformLink(node, components);
		case 'Image':
			return transformImage(node);
		case 'LineBreak':
			return CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'br',
				props: {},
				children: [],
			});
		case 'InlineComponent':
			return transformComponent(node as unknown as ComponentNode, components);
		default:
			return '';
	}
};

const usedHeadingIds = new Map<string, number>();

const generateHeadingId = (text: string): string => {
	let id = text
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^\p{L}\p{N}-]/gu, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');

	if (!id) {
		id = 'section';
	}

	const count = usedHeadingIds.get(id) ?? 0;
	usedHeadingIds.set(id, count + 1);

	return count === 0 ? id : `${id}-${String(count)}`;
};

export const resetHeadingIds = (): void => {
	usedHeadingIds.clear();
};

const getHeadingText = (children: InlineNode[]): string => {
	return children
		.map((child) => {
			if (child._tag === 'Text') return child.value;
			if (child._tag === 'InlineCode') return child.value;
			if ('children' in child)
				return getHeadingText(child.children as InlineNode[]);
			return '';
		})
		.join('');
};

const transformHeading = (
	node: HeadingNode,
	components: ComponentMap
): ElementNode => {
	const text = getHeadingText(node.children);
	const id = generateHeadingId(text);

	return CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: `h${String(node.level)}`,
		props: { class: `ink-h${String(node.level)}`, id },
		children: node.children.map((child) => transformInline(child, components)),
	});
};

const transformParagraph = (
	node: ParagraphNode,
	components: ComponentMap
): ElementNode =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'p',
		props: { class: 'ink-p' },
		children: node.children.map((child) => transformInline(child, components)),
	});

const transformCodeBlock = (node: CodeBlockNode): ElementNode =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'pre',
		props: {
			class: `ink-code-block${node.language ? ` language-${node.language}` : ''}`,
		},
		children: [
			CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'code',
				props: node.language ? { 'data-language': node.language } : {},
				children: highlight(node.code, node.language),
			}),
		],
	});

const transformBlockquote = (
	node: BlockquoteNode,
	components: ComponentMap
): ElementNode =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
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
			if (child._tag === 'Paragraph') {
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
		const checkbox: ElementNode = CreateElementNode({
			[EFFUSE_NODE]: true,
			tag: 'input',
			props: {
				type: 'checkbox',
				checked: node.checked,
				disabled: true,
				class: 'ink-task-checkbox',
			},
			children: [],
		});

		const textSpan: ElementNode = CreateElementNode({
			[EFFUSE_NODE]: true,
			tag: 'span',
			props: { class: 'ink-task-text' },
			children,
		});
		children = [checkbox, textSpan];
	}

	return CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'li',
		props: {
			class: isTaskItem ? 'ink-task-item' : 'ink-list-item',
		},
		children,
	});
};

const transformList = (node: ListNode, components: ComponentMap): ElementNode =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: node.ordered ? 'ol' : 'ul',
		props: {
			class: node.ordered ? 'ink-ol' : 'ink-ul',
			start: node.ordered && node.start !== 1 ? node.start : undefined,
		},
		children: node.children.map((item) => transformListItem(item, components)),
	});

const transformHorizontalRule = (_node: HorizontalRuleNode): ElementNode =>
	CreateElementNode({
		[EFFUSE_NODE]: true,
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
		return CreateElementNode({
			[EFFUSE_NODE]: true,
			tag: 'div',
			props: {
				class: 'ink-unknown-component',
				'data-component': node.name,
			},
			children: [`Unknown component: ${node.name}`],
		});
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
		return CreateElementNode({
			[EFFUSE_NODE]: true,
			tag: 'th',
			props: {
				class: 'ink-th',
				style: align ? { textAlign: align } : undefined,
			},
			children: cell.children.map((child) =>
				transformInline(child, components)
			),
		});
	});

	const headerRow: ElementNode = CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'tr',
		props: { class: 'ink-tr' },
		children: headerCells,
	});

	const bodyRows = node.rows.map((row) => {
		const cells = row.cells.map((cell, i) => {
			const align = node.alignments[i];
			return CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'td',
				props: {
					class: 'ink-td',
					style: align ? { textAlign: align } : undefined,
				},
				children: cell.children.map((child) =>
					transformInline(child, components)
				),
			});
		});
		return CreateElementNode({
			[EFFUSE_NODE]: true,
			tag: 'tr',
			props: { class: 'ink-tr' },
			children: cells,
		});
	});

	return CreateElementNode({
		[EFFUSE_NODE]: true,
		tag: 'table',
		props: { class: 'ink-table' },
		children: [
			CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'thead',
				props: { class: 'ink-thead' },
				children: [headerRow],
			}),
			CreateElementNode({
				[EFFUSE_NODE]: true,
				tag: 'tbody',
				props: { class: 'ink-tbody' },
				children: bodyRows,
			}),
		],
	});
};

const transformBlock = (
	node: BlockNode,
	components: ComponentMap
): EffuseChild => {
	switch (node._tag) {
		case 'Heading':
			return transformHeading(node, components);
		case 'Paragraph':
			return transformParagraph(node, components);
		case 'CodeBlock':
			return transformCodeBlock(node);
		case 'Blockquote':
			return transformBlockquote(node, components);
		case 'List':
			return transformList(node, components);
		case 'HorizontalRule':
			return transformHorizontalRule(node);
		case 'Table':
			return transformTable(node, components);
		case 'Component':
			return transformComponent(node, components);
		default:
			return '';
	}
};

// Build reactive nodes from document AST
export const transformDocument = (
	doc: DocumentNode,
	components: ComponentMap = {}
): EffuseChild[] => {
	resetHeadingIds();
	return doc.children.map((node) => transformBlock(node, components));
};
