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

export type InkComponents = {
	readonly h1?: unknown;
	readonly h2?: unknown;
	readonly h3?: unknown;
	readonly h4?: unknown;
	readonly h5?: unknown;
	readonly h6?: unknown;
	readonly p?: unknown;
	readonly a?: unknown;
	readonly img?: unknown;
	readonly pre?: unknown;
	readonly code?: unknown;
	readonly blockquote?: unknown;
	readonly ul?: unknown;
	readonly ol?: unknown;
	readonly li?: unknown;
	readonly hr?: unknown;
	readonly table?: unknown;
	readonly thead?: unknown;
	readonly tbody?: unknown;
	readonly tr?: unknown;
	readonly th?: unknown;
	readonly td?: unknown;
	readonly strong?: unknown;
	readonly em?: unknown;
	readonly del?: unknown;
	readonly br?: unknown;
	readonly [key: string]: unknown;
};

/** @deprecated Use `InkComponents` */
export type ComponentMap = InkComponents;

const resolveElement = (
	tag: string,
	props: Record<string, unknown>,
	children: EffuseChild[],
	components: InkComponents
): EffuseChild => {
	const override = components[tag];
	if (override) {
		return jsx(override as string, { ...props, children });
	}
	return CreateElementNode({
		[EFFUSE_NODE]: true,
		tag,
		props,
		children,
	});
};

const transformText = (node: TextNode): string => node.value;

const transformInlineCode = (
	node: InlineCodeNode,
	components: InkComponents
): EffuseChild =>
	resolveElement(
		'code',
		{ class: 'ink-inline-code' },
		[node.value],
		components
	);

const transformEmphasis = (
	node: EmphasisNode,
	components: InkComponents
): EffuseChild => {
	const tag =
		node.style === 'bold'
			? 'strong'
			: node.style === 'strikethrough'
				? 'del'
				: 'em';

	return resolveElement(
		tag,
		{},
		node.children.map((child) => transformInline(child, components)),
		components
	);
};

const transformLink = (
	node: LinkNode,
	components: InkComponents
): EffuseChild =>
	resolveElement(
		'a',
		{
			href: node.url,
			title: node.title,
			class: 'ink-link',
		},
		node.children.map((child) => transformInline(child, components)),
		components
	);

const transformImage = (
	node: ImageNode,
	components: InkComponents
): EffuseChild =>
	resolveElement(
		'img',
		{
			src: node.url,
			alt: node.alt,
			title: node.title,
			class: 'ink-image',
		},
		[],
		components
	);

const transformInline = (
	node: InlineNode,
	components: InkComponents
): EffuseChild => {
	switch (node._tag) {
		case 'Text':
			return transformText(node);
		case 'InlineCode':
			return transformInlineCode(node, components);
		case 'Emphasis':
			return transformEmphasis(node, components);
		case 'Link':
			return transformLink(node, components);
		case 'Image':
			return transformImage(node, components);
		case 'LineBreak':
			return resolveElement('br', {}, [], components);
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
	components: InkComponents
): EffuseChild => {
	const text = getHeadingText(node.children);
	const id = generateHeadingId(text);
	const tag = `h${String(node.level)}` as
		| 'h1'
		| 'h2'
		| 'h3'
		| 'h4'
		| 'h5'
		| 'h6';

	return resolveElement(
		tag,
		{ class: `ink-${tag}`, id },
		node.children.map((child) => transformInline(child, components)),
		components
	);
};

const transformParagraph = (
	node: ParagraphNode,
	components: InkComponents
): EffuseChild =>
	resolveElement(
		'p',
		{ class: 'ink-p' },
		node.children.map((child) => transformInline(child, components)),
		components
	);

const transformCodeBlock = (
	node: CodeBlockNode,
	components: InkComponents
): EffuseChild => {
	const codeChild = resolveElement(
		'code',
		node.language ? { 'data-language': node.language } : {},
		highlight(node.code, node.language),
		components
	);

	return resolveElement(
		'pre',
		{
			class: `ink-code-block${node.language ? ` language-${node.language}` : ''}`,
		},
		[codeChild],
		components
	);
};

const transformBlockquote = (
	node: BlockquoteNode,
	components: InkComponents
): EffuseChild =>
	resolveElement(
		'blockquote',
		{ class: 'ink-blockquote' },
		node.children.map((child) => transformBlock(child, components)),
		components
	);

const transformListItem = (
	node: ListItemNode,
	components: InkComponents
): EffuseChild => {
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
		const checkbox = resolveElement(
			'input',
			{
				type: 'checkbox',
				checked: node.checked,
				disabled: true,
				class: 'ink-task-checkbox',
			},
			[],
			components
		);

		const textSpan = resolveElement(
			'span',
			{ class: 'ink-task-text' },
			children,
			components
		);
		children = [checkbox, textSpan];
	}

	return resolveElement(
		'li',
		{ class: isTaskItem ? 'ink-task-item' : 'ink-list-item' },
		children,
		components
	);
};

const transformList = (
	node: ListNode,
	components: InkComponents
): EffuseChild =>
	resolveElement(
		node.ordered ? 'ol' : 'ul',
		{
			class: node.ordered ? 'ink-ol' : 'ink-ul',
			start: node.ordered && node.start !== 1 ? node.start : undefined,
		},
		node.children.map((item) => transformListItem(item, components)),
		components
	);

const transformHorizontalRule = (
	_node: HorizontalRuleNode,
	components: InkComponents
): EffuseChild => resolveElement('hr', { class: 'ink-hr' }, [], components);

const transformComponent = (
	node: ComponentNode,
	components: InkComponents
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
	components: InkComponents
): EffuseChild => {
	const headerCells = node.header.cells.map((cell, i) => {
		const align = node.alignments[i];
		return resolveElement(
			'th',
			{
				class: 'ink-th',
				style: align ? { textAlign: align } : undefined,
			},
			cell.children.map((child) => transformInline(child, components)),
			components
		);
	});

	const headerRow = resolveElement(
		'tr',
		{ class: 'ink-tr' },
		headerCells,
		components
	);

	const bodyRows = node.rows.map((row) => {
		const cells = row.cells.map((cell, i) => {
			const align = node.alignments[i];
			return resolveElement(
				'td',
				{
					class: 'ink-td',
					style: align ? { textAlign: align } : undefined,
				},
				cell.children.map((child) => transformInline(child, components)),
				components
			);
		});
		return resolveElement('tr', { class: 'ink-tr' }, cells, components);
	});

	return resolveElement(
		'table',
		{ class: 'ink-table' },
		[
			resolveElement('thead', { class: 'ink-thead' }, [headerRow], components),
			resolveElement('tbody', { class: 'ink-tbody' }, bodyRows, components),
		],
		components
	);
};

const transformBlock = (
	node: BlockNode,
	components: InkComponents
): EffuseChild => {
	switch (node._tag) {
		case 'Heading':
			return transformHeading(node, components);
		case 'Paragraph':
			return transformParagraph(node, components);
		case 'CodeBlock':
			return transformCodeBlock(node, components);
		case 'Blockquote':
			return transformBlockquote(node, components);
		case 'List':
			return transformList(node, components);
		case 'HorizontalRule':
			return transformHorizontalRule(node, components);
		case 'Table':
			return transformTable(node, components);
		case 'Component':
			return transformComponent(node, components);
		default:
			return '';
	}
};

export const transformDocument = (
	doc: DocumentNode,
	components: InkComponents = {}
): EffuseChild[] => {
	resetHeadingIds();
	return doc.children.map((node) => transformBlock(node, components));
};
