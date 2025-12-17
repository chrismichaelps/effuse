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
import type { ParseError } from '../types/errors.js';
import type { SourcePosition } from '../types/ast.js';

export type TokenType =
	| 'heading'
	| 'codeBlockStart'
	| 'codeBlockEnd'
	| 'blockquote'
	| 'listItem'
	| 'horizontalRule'
	| 'componentBlockStart'
	| 'componentBlockEnd'
	| 'componentInline'
	| 'slotMarker'
	| 'tableRow'
	| 'tableSeparator'
	| 'blankLine'
	| 'text'
	| 'inlineCode'
	| 'bold'
	| 'italic'
	| 'strikethrough'
	| 'link'
	| 'image'
	| 'lineBreak'
	| 'eof';

export interface Token {
	readonly type: TokenType;
	readonly value: string;
	readonly position: SourcePosition;
	readonly end: number;
	readonly meta?: Record<string, unknown>;
}

interface TokenizerState {
	readonly input: string;
	readonly pos: number;
	readonly line: number;
	readonly column: number;
}

const createState = (input: string): TokenizerState => ({
	input,
	pos: 0,
	line: 1,
	column: 1,
});

const isAtEnd = (state: TokenizerState): boolean =>
	state.pos >= state.input.length;

const peek = (state: TokenizerState, offset = 0): string =>
	state.input[state.pos + offset] ?? '';

const peekSlice = (state: TokenizerState, length: number): string =>
	state.input.slice(state.pos, state.pos + length);

const advance = (state: TokenizerState, count = 1): TokenizerState => {
	let { pos, line, column } = state;
	for (let i = 0; i < count && pos < state.input.length; i++) {
		if (state.input[pos] === '\n') {
			line++;
			column = 1;
		} else {
			column++;
		}
		pos++;
	}
	return { ...state, pos, line, column };
};

const currentPosition = (state: TokenizerState): SourcePosition => ({
	line: state.line,
	column: state.column,
	offset: state.pos,
});

const isLineStart = (state: TokenizerState): boolean =>
	state.column === 1 || state.pos === 0;

const matchHeading = (state: TokenizerState): Token | null => {
	if (!isLineStart(state)) return null;

	let level = 0;
	while (peek(state, level) === '#' && level < 7) level++;

	if (level === 0 || level > 6) return null;
	if (peek(state, level) !== ' ') return null;

	let endPos = state.pos + level + 1;
	while (endPos < state.input.length && state.input[endPos] !== '\n') {
		endPos++;
	}

	const value = state.input.slice(state.pos + level + 1, endPos).trim();

	return {
		type: 'heading',
		value,
		position: currentPosition(state),
		end: endPos,
		meta: { level },
	};
};

const matchCodeBlockStart = (state: TokenizerState): Token | null => {
	if (!isLineStart(state)) return null;
	if (peekSlice(state, 3) !== '```') return null;

	let endPos = state.pos + 3;
	while (endPos < state.input.length && state.input[endPos] !== '\n') {
		endPos++;
	}

	const language = state.input.slice(state.pos + 3, endPos).trim();

	return {
		type: 'codeBlockStart',
		value: language,
		position: currentPosition(state),
		end: endPos + 1,
		meta: { language: language || undefined },
	};
};

const matchHorizontalRule = (state: TokenizerState): Token | null => {
	if (!isLineStart(state)) return null;

	const chars = ['---', '***', '___'];
	for (const pattern of chars) {
		if (peekSlice(state, 3) === pattern) {
			let endPos = state.pos + 3;
			while (endPos < state.input.length && state.input[endPos] !== '\n') {
				const ch = state.input[endPos];
				if (ch !== ' ' && ch !== pattern[0]) return null;
				endPos++;
			}
			return {
				type: 'horizontalRule',
				value: pattern,
				position: currentPosition(state),
				end: endPos + 1,
			};
		}
	}
	return null;
};

const matchBlockquote = (state: TokenizerState): Token | null => {
	if (!isLineStart(state)) return null;
	if (peek(state) !== '>') return null;

	let endPos = state.pos + 1;
	if (peek(state, 1) === ' ') endPos++;

	while (endPos < state.input.length && state.input[endPos] !== '\n') {
		endPos++;
	}

	const value = state.input.slice(
		state.pos + (peek(state, 1) === ' ' ? 2 : 1),
		endPos
	);

	return {
		type: 'blockquote',
		value,
		position: currentPosition(state),
		end: endPos + 1,
	};
};

const matchListItem = (state: TokenizerState): Token | null => {
	if (!isLineStart(state)) return null;

	let indent = 0;
	let pos = state.pos;
	while (
		pos < state.input.length &&
		(state.input[pos] === ' ' || state.input[pos] === '\t')
	) {
		if (state.input[pos] === '\t') {
			indent += 2;
		} else {
			indent++;
		}
		pos++;
	}

	const depth = Math.floor(indent / 2);

	const unorderedChars = ['-', '*', '+'];
	if (
		unorderedChars.includes(state.input[pos] ?? '') &&
		state.input[pos + 1] === ' '
	) {
		let endPos = pos + 2;
		while (endPos < state.input.length && state.input[endPos] !== '\n') {
			endPos++;
		}
		const value = state.input.slice(pos + 2, endPos);

		let checked: boolean | undefined;
		let actualValue = value;
		if (value.startsWith('[ ] ')) {
			checked = false;
			actualValue = value.slice(4);
		} else if (value.startsWith('[x] ') || value.startsWith('[X] ')) {
			checked = true;
			actualValue = value.slice(4);
		}

		return {
			type: 'listItem',
			value: actualValue,
			position: currentPosition(state),
			end: endPos + 1,
			meta: { ordered: false, checked, depth },
		};
	}

	let numEnd = pos;
	while (/\d/.test(state.input[numEnd] ?? '')) {
		numEnd++;
	}
	if (
		numEnd > pos &&
		state.input[numEnd] === '.' &&
		state.input[numEnd + 1] === ' '
	) {
		const start = parseInt(state.input.slice(pos, numEnd), 10);
		let endPos = numEnd + 2;
		while (endPos < state.input.length && state.input[endPos] !== '\n') {
			endPos++;
		}
		const value = state.input.slice(numEnd + 2, endPos);
		return {
			type: 'listItem',
			value,
			position: currentPosition(state),
			end: endPos + 1,
			meta: { ordered: true, start, depth },
		};
	}

	return null;
};

const matchComponentBlockStart = (state: TokenizerState): Token | null => {
	if (!isLineStart(state)) return null;
	if (peekSlice(state, 2) !== '::') return null;

	let pos = state.pos + 2;

	const nameStart = pos;
	while (
		pos < state.input.length &&
		/[a-zA-Z0-9_]/.test(state.input[pos] ?? '')
	) {
		pos++;
	}
	const name = state.input.slice(nameStart, pos);
	if (!name) return null;

	let props = '{}';
	if (state.input[pos] === '{') {
		const propsStart = pos;
		let braceCount = 1;
		pos++;
		while (pos < state.input.length && braceCount > 0) {
			if (state.input[pos] === '{') braceCount++;
			else if (state.input[pos] === '}') braceCount--;
			pos++;
		}
		props = state.input.slice(propsStart, pos);
	}

	let selfClosing = false;
	let endPos = pos;
	while (endPos < state.input.length && state.input[endPos] !== '\n') {
		if (peekSlice({ ...state, pos: endPos } as TokenizerState, 2) === '::') {
			selfClosing = true;
			endPos += 2;
			break;
		}
		if (state.input[endPos] !== ' ') break;
		endPos++;
	}

	while (endPos < state.input.length && state.input[endPos] !== '\n') {
		endPos++;
	}

	return {
		type: selfClosing ? 'componentInline' : 'componentBlockStart',
		value: name,
		position: currentPosition(state),
		end: endPos + 1,
		meta: { name, props, selfClosing },
	};
};

const matchComponentBlockEnd = (state: TokenizerState): Token | null => {
	if (!isLineStart(state)) return null;
	if (peekSlice(state, 2) !== '::') return null;

	let pos = state.pos + 2;
	while (pos < state.input.length && state.input[pos] === ' ') {
		pos++;
	}
	if (pos < state.input.length && state.input[pos] !== '\n') {
		return null;
	}

	return {
		type: 'componentBlockEnd',
		value: '',
		position: currentPosition(state),
		end: pos + 1,
	};
};

const matchSlotMarker = (state: TokenizerState): Token | null => {
	if (!isLineStart(state)) return null;
	if (peek(state) !== '#') return null;

	let pos = state.pos + 1;
	const nameStart = pos;
	while (
		pos < state.input.length &&
		/[a-zA-Z0-9_]/.test(state.input[pos] ?? '')
	) {
		pos++;
	}
	const name = state.input.slice(nameStart, pos);
	if (!name) return null;

	while (pos < state.input.length && state.input[pos] !== '\n') {
		pos++;
	}

	return {
		type: 'slotMarker',
		value: name,
		position: currentPosition(state),
		end: pos + 1,
	};
};

const matchComponentInline = (state: TokenizerState): Token | null => {
	if (peek(state) !== '<') return null;

	let pos = state.pos + 1;

	const nameStart = pos;
	if (!/[A-Z]/.test(state.input[pos] ?? '')) return null;
	while (
		pos < state.input.length &&
		/[a-zA-Z0-9_]/.test(state.input[pos] ?? '')
	) {
		pos++;
	}
	const name = state.input.slice(nameStart, pos);
	if (!name) return null;

	while (pos < state.input.length && state.input[pos] === ' ') {
		pos++;
	}

	const propsStart = pos;
	while (pos < state.input.length) {
		if (peekSlice({ ...state, pos } as TokenizerState, 2) === '/>') {
			const propsStr = state.input.slice(propsStart, pos).trim();
			return {
				type: 'componentInline',
				value: name,
				position: currentPosition(state),
				end: pos + 2,
				meta: { name, propsString: propsStr, selfClosing: true },
			};
		}
		if (state.input[pos] === '>') {
			return null;
		}
		if (state.input[pos] === '\n') return null;
		pos++;
	}

	return null;
};

const matchBlankLine = (state: TokenizerState): Token | null => {
	if (!isLineStart(state)) return null;
	if (peek(state) !== '\n') return null;

	return {
		type: 'blankLine',
		value: '',
		position: currentPosition(state),
		end: state.pos + 1,
	};
};

const matchTableRow = (state: TokenizerState): Token | null => {
	if (!isLineStart(state)) return null;
	if (peek(state) !== '|') return null;

	let endPos = state.pos;
	while (endPos < state.input.length && state.input[endPos] !== '\n') {
		endPos++;
	}

	const line = state.input.slice(state.pos, endPos);

	const isSeparator = /^\|?[\s:|-]+\|?$/.test(line) && line.includes('-');

	if (isSeparator) {
		const cells = line.split('|').filter((c) => c.trim());
		const alignments = cells.map((cell) => {
			const trimmed = cell.trim();
			const left = trimmed.startsWith(':');
			const right = trimmed.endsWith(':');
			if (left && right) return 'center';
			if (right) return 'right';
			if (left) return 'left';
			return null;
		});

		return {
			type: 'tableSeparator',
			value: line,
			position: currentPosition(state),
			end: endPos + 1,
			meta: { alignments },
		};
	}

	const parts = line.split('|');

	let cells = parts.slice(1);
	if (cells.length > 0 && cells[cells.length - 1]?.trim() === '') {
		cells = cells.slice(0, -1);
	}
	cells = cells.map((c) => c.trim());

	return {
		type: 'tableRow',
		value: line,
		position: currentPosition(state),
		end: endPos + 1,
		meta: { cells },
	};
};

const matchInlineCode = (state: TokenizerState): Token | null => {
	if (peek(state) !== '`') return null;
	if (peek(state, 1) === '`') return null;

	let pos = state.pos + 1;
	while (
		pos < state.input.length &&
		state.input[pos] !== '`' &&
		state.input[pos] !== '\n'
	) {
		pos++;
	}

	if (state.input[pos] !== '`') return null;

	return {
		type: 'inlineCode',
		value: state.input.slice(state.pos + 1, pos),
		position: currentPosition(state),
		end: pos + 1,
	};
};

const matchEmphasis = (state: TokenizerState): Token | null => {
	const ch = peek(state);

	if ((ch === '*' || ch === '_') && peek(state, 1) === ch) {
		const marker = ch + ch;
		let pos = state.pos + 2;
		while (pos < state.input.length - 1) {
			if (state.input.slice(pos, pos + 2) === marker) {
				return {
					type: 'bold',
					value: state.input.slice(state.pos + 2, pos),
					position: currentPosition(state),
					end: pos + 2,
				};
			}
			if (state.input[pos] === '\n') break;
			pos++;
		}
	}

	if (ch === '*' || ch === '_') {
		let pos = state.pos + 1;
		while (pos < state.input.length) {
			if (state.input[pos] === ch && state.input[pos - 1] !== '\\') {
				return {
					type: 'italic',
					value: state.input.slice(state.pos + 1, pos),
					position: currentPosition(state),
					end: pos + 1,
				};
			}
			if (state.input[pos] === '\n') break;
			pos++;
		}
	}

	if (ch === '~' && peek(state, 1) === '~') {
		let pos = state.pos + 2;
		while (pos < state.input.length - 1) {
			if (state.input.slice(pos, pos + 2) === '~~') {
				return {
					type: 'strikethrough',
					value: state.input.slice(state.pos + 2, pos),
					position: currentPosition(state),
					end: pos + 2,
				};
			}
			if (state.input[pos] === '\n') break;
			pos++;
		}
	}

	return null;
};

const matchLink = (state: TokenizerState): Token | null => {
	if (peek(state) !== '[') return null;

	let pos = state.pos + 1;

	const textStart = pos;
	while (
		pos < state.input.length &&
		state.input[pos] !== ']' &&
		state.input[pos] !== '\n'
	) {
		pos++;
	}
	if (state.input[pos] !== ']') return null;
	const text = state.input.slice(textStart, pos);
	pos++;

	if (state.input[pos] !== '(') return null;
	pos++;

	const urlStart = pos;
	while (
		pos < state.input.length &&
		state.input[pos] !== ')' &&
		state.input[pos] !== '\n'
	) {
		pos++;
	}
	if (state.input[pos] !== ')') return null;
	const url = state.input.slice(urlStart, pos);
	pos++;

	return {
		type: 'link',
		value: text,
		position: currentPosition(state),
		end: pos,
		meta: { url, text },
	};
};

const matchImage = (state: TokenizerState): Token | null => {
	if (peek(state) !== '!' || peek(state, 1) !== '[') return null;

	let pos = state.pos + 2;

	const altStart = pos;
	while (
		pos < state.input.length &&
		state.input[pos] !== ']' &&
		state.input[pos] !== '\n'
	) {
		pos++;
	}
	if (state.input[pos] !== ']') return null;
	const alt = state.input.slice(altStart, pos);
	pos++;

	if (state.input[pos] !== '(') return null;
	pos++;

	const urlStart = pos;
	while (
		pos < state.input.length &&
		state.input[pos] !== ')' &&
		state.input[pos] !== '\n'
	) {
		pos++;
	}
	if (state.input[pos] !== ')') return null;
	const url = state.input.slice(urlStart, pos);
	pos++;

	return {
		type: 'image',
		value: alt,
		position: currentPosition(state),
		end: pos,
		meta: { url, alt },
	};
};

const matchText = (state: TokenizerState): Token => {
	const specialChars = [
		'*',
		'_',
		'~',
		'`',
		'[',
		'!',
		'<',
		'\n',
		'#',
		'>',
		'-',
		':',
		'{',
	];
	let pos = state.pos;

	while (pos < state.input.length) {
		const ch = state.input[pos];
		if (ch === undefined || specialChars.includes(ch)) break;
		pos++;
	}

	if (pos === state.pos) {
		pos = state.pos + 1;
	}

	return {
		type: 'text',
		value: state.input.slice(state.pos, pos),
		position: currentPosition(state),
		end: pos,
	};
};

const scanToken = (state: TokenizerState): Token => {
	if (isLineStart(state)) {
		const blockMatchers = [
			matchBlankLine,
			matchHeading,
			matchCodeBlockStart,
			matchHorizontalRule,
			matchBlockquote,
			matchListItem,
			matchTableRow,
			matchComponentBlockEnd,
			matchComponentBlockStart,
			matchSlotMarker,
		];

		for (const matcher of blockMatchers) {
			const token = matcher(state);
			if (token) return token;
		}
	}

	const inlineMatchers = [
		matchInlineCode,
		matchEmphasis,
		matchImage,
		matchLink,
		matchComponentInline,
	];

	for (const matcher of inlineMatchers) {
		const token = matcher(state);
		if (token) return token;
	}

	return matchText(state);
};

export const tokenize = (input: string): Effect.Effect<Token[], ParseError> =>
	Effect.sync(() => {
		const tokens: Token[] = [];
		let state = createState(input);
		let inCodeBlock = false;

		while (!isAtEnd(state)) {
			if (inCodeBlock) {
				if (isLineStart(state) && peekSlice(state, 3) === '```') {
					let endPos = state.pos + 3;
					while (endPos < state.input.length && state.input[endPos] !== '\n') {
						endPos++;
					}

					tokens.push({
						type: 'codeBlockEnd',
						value: '```',
						position: currentPosition(state),
						end: endPos + 1,
					});
					state = advance(state, endPos + 1 - state.pos);
					inCodeBlock = false;
					continue;
				}

				let endPos = state.pos;
				while (endPos < state.input.length && state.input[endPos] !== '\n') {
					endPos++;
				}
				if (endPos < state.input.length) endPos++;

				tokens.push({
					type: 'text',
					value: state.input.slice(state.pos, endPos),
					position: currentPosition(state),
					end: endPos,
				});
				state = advance(state, endPos - state.pos);
				continue;
			}

			const token = scanToken(state);
			tokens.push(token);

			if (token.type === 'codeBlockStart') {
				inCodeBlock = true;
			}

			state = advance(state, token.end - state.pos);
		}

		tokens.push({
			type: 'eof',
			value: '',
			position: currentPosition(state),
			end: state.pos,
		});

		return tokens;
	});
