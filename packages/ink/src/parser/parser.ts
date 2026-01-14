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
import type { Token, TokenType } from './tokenizer.js';
import type { ParseError } from '../types/errors.js';
import {
	type BlockNode,
	type InlineNode,
	type DocumentNode,
	type HeadingNode,
	type ParagraphNode,
	type CodeBlockNode,
	type BlockquoteNode,
	type ListNode,
	type ListItemNode,
	type HorizontalRuleNode,
	type TableNode,
	type TableRowNode,
	HeadingNode as CreateHeadingNode,
	ParagraphNode as CreateParagraphNode,
	CodeBlockNode as CreateCodeBlockNode,
	BlockquoteNode as CreateBlockquoteNode,
	ListNode as CreateListNode,
	HorizontalRuleNode as CreateHorizontalRuleNode,
	TableNode as CreateTableNode,
	ComponentNode as CreateComponentNode,
	TextNode as CreateTextNode,
	InlineCodeNode as CreateInlineCodeNode,
	EmphasisNode as CreateEmphasisNode,
	LinkNode as CreateLinkNode,
	ImageNode as CreateImageNode,
	InlineComponentNode as CreateInlineComponentNode,
	ListItemNode as CreateListItemNode,
	TableRowNode as CreateTableRowNode,
	TableCellNode as CreateTableCellNode,
	DocumentNode as CreateDocumentNode,
} from '../types/ast.js';

interface ParserState {
	readonly tokens: Token[];
	current: number;
}

const createParserState = (tokens: Token[]): ParserState => ({
	tokens,
	current: 0,
});

const isAtEnd = (state: ParserState): boolean => {
	const token = state.tokens[state.current];
	return !token || token.type === 'eof';
};

const peek = (state: ParserState): Token | undefined =>
	state.tokens[state.current];

const peekType = (state: ParserState): TokenType | undefined =>
	peek(state)?.type;

const advance = (state: ParserState): Token | undefined => {
	if (!isAtEnd(state)) {
		state.current++;
	}
	return state.tokens[state.current - 1];
};

const check = (state: ParserState, type: TokenType): boolean =>
	peekType(state) === type;

const match = (state: ParserState, ...types: TokenType[]): boolean => {
	for (const type of types) {
		if (check(state, type)) {
			advance(state);
			return true;
		}
	}
	return false;
};

const parsePropsString = (propsStr: string): Record<string, unknown> => {
	if (!propsStr || propsStr === '{}') return {};

	try {
		let normalized = propsStr;

		if (normalized.startsWith('{') && normalized.endsWith('}')) {
			normalized = normalized.slice(1, -1);
		}

		const result: Record<string, unknown> = {};
		const pairs = normalized
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

		for (const pair of pairs) {
			const colonIdx = pair.indexOf(':');
			if (colonIdx === -1) continue;

			const key = pair.slice(0, colonIdx).trim();
			const value = pair.slice(colonIdx + 1).trim();

			if (value.startsWith('"') && value.endsWith('"')) {
				result[key] = value.slice(1, -1);
			} else if (value.startsWith("'") && value.endsWith("'")) {
				result[key] = value.slice(1, -1);
			} else if (value === 'true') {
				result[key] = true;
			} else if (value === 'false') {
				result[key] = false;
			} else if (value === 'null') {
				result[key] = null;
			} else if (!isNaN(Number(value))) {
				result[key] = Number(value);
			} else {
				result[key] = value;
			}
		}

		return result;
	} catch {
		return {};
	}
};

const parseAttributeProps = (propsStr: string): Record<string, unknown> => {
	if (!propsStr) return {};

	const result: Record<string, unknown> = {};
	const attrRegex = /(\w+)=(?:"([^"]*)"|{([^}]*)})/g;
	let matchResult;

	while ((matchResult = attrRegex.exec(propsStr)) !== null) {
		const [, key, stringVal, exprVal] = matchResult;
		if (key) {
			if (stringVal !== undefined) {
				result[key] = stringVal;
			} else if (exprVal !== undefined) {
				if (exprVal === 'true') result[key] = true;
				else if (exprVal === 'false') result[key] = false;
				else if (!isNaN(Number(exprVal))) result[key] = Number(exprVal);
				else result[key] = exprVal;
			}
		}
	}

	return result;
};

const parseHeading = (state: ParserState): HeadingNode | null => {
	const token = peek(state);
	if (!token || token.type !== 'heading') return null;

	advance(state);

	const level = (token.meta?.level as 1 | 2 | 3 | 4 | 5 | 6 | undefined) ?? 1;
	const inlineNodes = parseInlineContent(token.value);

	return CreateHeadingNode({
		level,
		children: inlineNodes,
		position: {
			start: token.position,
			end: { ...token.position, offset: token.end },
		},
	});
};

const parseCodeBlock = (state: ParserState): CodeBlockNode | null => {
	const startToken = peek(state);
	if (!startToken || startToken.type !== 'codeBlockStart') return null;

	advance(state);

	const codeLines: string[] = [];

	while (!isAtEnd(state) && peekType(state) !== 'codeBlockEnd') {
		const token = advance(state);
		if (token) {
			codeLines.push(token.value);
		}
	}

	if (check(state, 'codeBlockEnd')) {
		advance(state);
	}

	const language = startToken.meta?.language as string | undefined;

	return CreateCodeBlockNode({
		...(language && { language }),
		code: codeLines.join(''),
		position: {
			start: startToken.position,
			end: peek(state)?.position ?? startToken.position,
		},
	});
};

const parseBlockquote = (state: ParserState): BlockquoteNode | null => {
	const token = peek(state);
	if (!token || token.type !== 'blockquote') return null;

	const lines: string[] = [];

	while (check(state, 'blockquote')) {
		const t = advance(state);
		if (t) lines.push(t.value);
	}

	const content = lines.join('\n');
	const children: BlockNode[] = [
		CreateParagraphNode({
			children: parseInlineContent(content),
		}),
	];

	return CreateBlockquoteNode({
		children,
		position: {
			start: token.position,
			end: peek(state)?.position ?? token.position,
		},
	});
};

const parseList = (state: ParserState): ListNode | null => {
	const firstToken = peek(state);
	if (!firstToken || firstToken.type !== 'listItem') return null;

	const parseListAtDepth = (targetDepth: number): ListNode | null => {
		const startToken = peek(state);
		if (!startToken || startToken.type !== 'listItem') return null;

		const tokenDepth = (startToken.meta?.depth as number | undefined) ?? 0;
		if (tokenDepth !== targetDepth) return null;

		const ordered = (startToken.meta?.ordered as boolean | undefined) ?? false;
		const start = startToken.meta?.start as number | undefined;
		const items: ListItemNode[] = [];

		while (check(state, 'listItem')) {
			const token = peek(state);
			if (!token) break;

			const currentDepth = (token.meta?.depth as number | undefined) ?? 0;
			const itemOrdered = (token.meta?.ordered as boolean | undefined) ?? false;

			if (currentDepth < targetDepth) {
				break;
			}

			if (currentDepth > targetDepth) {
				const nestedList = parseListAtDepth(currentDepth);
				if (nestedList && items.length > 0) {
					const lastItem = items[items.length - 1];
					if (lastItem) {
						lastItem.children.push(nestedList);
					}
				}
				continue;
			}

			if (itemOrdered !== ordered) {
				break;
			}

			advance(state);

			const checked = token.meta?.checked as boolean | undefined;
			const itemNode = CreateListItemNode({
				...(checked !== undefined && { checked }),
				children: [
					CreateParagraphNode({
						children: parseInlineContent(token.value),
					}),
				],
			});

			items.push(itemNode);
		}

		if (items.length === 0) return null;

		return CreateListNode({
			ordered,
			...(ordered && start !== undefined && start !== 1 && { start }),
			children: items,
			position: {
				start: startToken.position,
				end: peek(state)?.position ?? startToken.position,
			},
		});
	};

	const firstDepth = (firstToken.meta?.depth as number | undefined) ?? 0;
	return parseListAtDepth(firstDepth);
};

const parseHorizontalRule = (state: ParserState): HorizontalRuleNode | null => {
	const token = peek(state);
	if (!token || token.type !== 'horizontalRule') return null;

	advance(state);

	return CreateHorizontalRuleNode({
		position: {
			start: token.position,
			end: { ...token.position, offset: token.end },
		},
	});
};

const parseComponent = (state: ParserState): BlockNode | null => {
	const token = peek(state);
	if (!token) return null;

	if (token.type === 'componentInline') {
		advance(state);

		const name = (token.meta?.name as string | undefined) ?? token.value;
		const propsStr =
			(token.meta?.props as string | undefined) ??
			(token.meta?.propsString as string | undefined) ??
			'{}';
		const props = propsStr.includes('=')
			? parseAttributeProps(propsStr)
			: parsePropsString(propsStr);

		return CreateComponentNode({
			name,
			props,
			children: [],
			slots: {},
			selfClosing: true,
			position: {
				start: token.position,
				end: { ...token.position, offset: token.end },
			},
		});
	}

	if (token.type === 'componentBlockStart') {
		advance(state);

		const name = (token.meta?.name as string | undefined) ?? token.value;
		const propsStr = (token.meta?.props as string | undefined) ?? '{}';
		const props = parsePropsString(propsStr);

		const children: BlockNode[] = [];
		const slots: Record<string, BlockNode[]> = {};
		let currentSlot: string | null = null;

		while (!isAtEnd(state) && !check(state, 'componentBlockEnd')) {
			if (check(state, 'slotMarker')) {
				const slotToken = advance(state);
				if (slotToken) {
					currentSlot = slotToken.value;
					slots[currentSlot] = [];
				}
				continue;
			}

			const block = parseBlock(state);
			if (block) {
				if (currentSlot) {
					const slotArr = slots[currentSlot];
					if (slotArr) slotArr.push(block);
				} else {
					children.push(block);
				}
			} else {
				advance(state);
			}
		}

		if (check(state, 'componentBlockEnd')) {
			advance(state);
		}

		return CreateComponentNode({
			name,
			props,
			children,
			slots,
			selfClosing: false,
			position: {
				start: token.position,
				end: peek(state)?.position ?? token.position,
			},
		});
	}

	return null;
};

const parseParagraph = (state: ParserState): ParagraphNode | null => {
	const firstToken = peek(state);
	if (!firstToken) return null;

	const textParts: string[] = [];

	while (!isAtEnd(state)) {
		const tokenType = peekType(state);
		if (
			tokenType === 'heading' ||
			tokenType === 'codeBlockStart' ||
			tokenType === 'blockquote' ||
			tokenType === 'listItem' ||
			tokenType === 'horizontalRule' ||
			tokenType === 'componentBlockStart' ||
			tokenType === 'componentBlockEnd' ||
			tokenType === 'slotMarker' ||
			tokenType === 'blankLine'
		) {
			break;
		}

		const token = advance(state);
		if (token) {
			textParts.push(token.value);
		}
	}

	if (textParts.length === 0) return null;

	const content = textParts.join('');
	const children = parseInlineContent(content);

	return CreateParagraphNode({
		children,
		position: {
			start: firstToken.position,
			end: peek(state)?.position ?? firstToken.position,
		},
	});
};

const parseInlineContent = (text: string): InlineNode[] => {
	const nodes: InlineNode[] = [];
	let pos = 0;

	const pushText = (value: string) => {
		if (value) {
			const last = nodes[nodes.length - 1];
			if (last?._tag === 'Text') {
				nodes[nodes.length - 1] = CreateTextNode({
					value: (last as { value: string }).value + value,
				});
			} else {
				nodes.push(CreateTextNode({ value }));
			}
		}
	};

	while (pos < text.length) {
		const remaining = text.slice(pos);

		if (remaining.startsWith('`')) {
			const endIdx = remaining.indexOf('`', 1);
			if (endIdx !== -1) {
				nodes.push(
					CreateInlineCodeNode({
						value: remaining.slice(1, endIdx),
					})
				);
				pos += endIdx + 1;
				continue;
			}
		}

		const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
		if (boldMatch) {
			nodes.push(
				CreateEmphasisNode({
					style: 'bold',
					children: parseInlineContent(boldMatch[2] ?? ''),
				})
			);
			pos += boldMatch[0].length;
			continue;
		}

		const italicMatch = remaining.match(/^(\*|_)([^*_]+?)\1/);
		if (italicMatch) {
			nodes.push(
				CreateEmphasisNode({
					style: 'italic',
					children: parseInlineContent(italicMatch[2] ?? ''),
				})
			);
			pos += italicMatch[0].length;
			continue;
		}

		const strikeMatch = remaining.match(/^~~(.+?)~~/);
		if (strikeMatch) {
			nodes.push(
				CreateEmphasisNode({
					style: 'strikethrough',
					children: parseInlineContent(strikeMatch[1] ?? ''),
				})
			);
			pos += strikeMatch[0].length;
			continue;
		}

		const imageMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
		if (imageMatch) {
			nodes.push(
				CreateImageNode({
					alt: imageMatch[1] ?? '',
					url: imageMatch[2] ?? '',
				})
			);
			pos += imageMatch[0].length;
			continue;
		}

		const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
		if (linkMatch) {
			nodes.push(
				CreateLinkNode({
					url: linkMatch[2] ?? '',
					children: parseInlineContent(linkMatch[1] ?? ''),
				})
			);
			pos += linkMatch[0].length;
			continue;
		}

		const componentMatch = remaining.match(/^<([A-Z][a-zA-Z0-9_]*)([^>]*)\/>/);
		if (componentMatch) {
			const name = componentMatch[1] ?? '';
			const propsStr = (componentMatch[2] ?? '').trim();
			const props = parseAttributeProps(propsStr);

			nodes.push(
				CreateInlineComponentNode({
					name,
					props,
					children: [],
					slots: {},
					selfClosing: true,
				})
			);
			pos += componentMatch[0].length;
			continue;
		}

		const textMatch = remaining.match(/^[^*_`~[!<]+/);
		if (textMatch) {
			pushText(textMatch[0]);
			pos += textMatch[0].length;
			continue;
		}

		pushText(text[pos] ?? '');
		pos++;
	}

	return nodes;
};

const parseTable = (state: ParserState): TableNode | null => {
	const firstToken = peek(state);
	if (!firstToken || firstToken.type !== 'tableRow') return null;

	const headerToken = advance(state);
	if (!headerToken) return null;

	const headerCells = (headerToken.meta?.cells as string[] | undefined) ?? [];

	if (!check(state, 'tableSeparator')) {
		state.current--;
		return null;
	}

	const separatorToken = advance(state);
	const alignments =
		(separatorToken?.meta?.alignments as
			| ('left' | 'center' | 'right' | null)[]
			| undefined) ?? [];

	const rows: TableRowNode[] = [];
	while (check(state, 'tableRow')) {
		const rowToken = advance(state);
		if (!rowToken) break;

		const cells = (rowToken.meta?.cells as string[] | undefined) ?? [];
		rows.push(
			CreateTableRowNode({
				cells: cells.map((cellContent) =>
					CreateTableCellNode({
						children: parseInlineContent(cellContent),
					})
				),
			})
		);
	}

	const header = CreateTableRowNode({
		cells: headerCells.map((cellContent) =>
			CreateTableCellNode({
				children: parseInlineContent(cellContent),
			})
		),
	});

	return CreateTableNode({
		header,
		rows,
		alignments,
		position: {
			start: firstToken.position,
			end: peek(state)?.position ?? firstToken.position,
		},
	});
};

const parseBlock = (state: ParserState): BlockNode | null => {
	while (match(state, 'blankLine')) {
		continue;
	}

	if (isAtEnd(state)) return null;

	const parsers = [
		parseHeading,
		parseCodeBlock,
		parseHorizontalRule,
		parseBlockquote,
		parseList,
		parseTable,
		parseComponent,
		parseParagraph,
	];

	for (const parser of parsers) {
		const node = parser(state);
		if (node) return node;
	}

	advance(state);
	return null;
};

export const parseTokens = (
	tokens: Token[]
): Effect.Effect<DocumentNode, ParseError> =>
	Effect.sync(() => {
		const state = createParserState(tokens);
		const children: BlockNode[] = [];

		while (!isAtEnd(state)) {
			const block = parseBlock(state);
			if (block) {
				children.push(block);
			}
		}

		return CreateDocumentNode({ children });
	});
