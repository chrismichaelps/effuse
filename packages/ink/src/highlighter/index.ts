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

import { EFFUSE_NODE, CreateElementNode, type EffuseChild } from '@effuse/core';

export type TokenType =
	| 'keyword'
	| 'string'
	| 'number'
	| 'comment'
	| 'function'
	| 'operator'
	| 'punctuation'
	| 'property'
	| 'class'
	| 'type'
	| 'variable'
	| 'tag'
	| 'attr-name'
	| 'attr-value'
	| 'selector'
	| 'text';

interface HighlightToken {
	type: TokenType;
	value: string;
}

const JS_KEYWORDS = new Set([
	'const',
	'let',
	'var',
	'function',
	'return',
	'if',
	'else',
	'for',
	'while',
	'do',
	'switch',
	'case',
	'break',
	'continue',
	'try',
	'catch',
	'finally',
	'throw',
	'new',
	'class',
	'extends',
	'import',
	'export',
	'from',
	'default',
	'async',
	'await',
	'yield',
	'typeof',
	'instanceof',
	'in',
	'of',
	'true',
	'false',
	'null',
	'undefined',
	'this',
	'super',
	'static',
	'public',
	'private',
	'protected',
	'readonly',
	'abstract',
	'interface',
	'type',
	'enum',
	'implements',
	'as',
	'is',
	'keyof',
	'infer',
	'never',
	'unknown',
	'any',
	'void',
	'string',
	'number',
	'boolean',
	'object',
	'symbol',
	'bigint',
]);

const CSS_KEYWORDS = new Set([
	'important',
	'inherit',
	'initial',
	'unset',
	'none',
	'auto',
	'block',
	'inline',
	'flex',
	'grid',
	'absolute',
	'relative',
	'fixed',
	'sticky',
	'static',
]);

const tokenizeJS = (code: string): HighlightToken[] => {
	const tokens: HighlightToken[] = [];
	let pos = 0;

	while (pos < code.length) {
		const remaining = code.slice(pos);

		if (remaining.startsWith('//')) {
			const end = remaining.indexOf('\n');
			const value = end === -1 ? remaining : remaining.slice(0, end);
			tokens.push({ type: 'comment', value });
			pos += value.length;
			continue;
		}

		if (remaining.startsWith('/*')) {
			const end = remaining.indexOf('*/');
			const value = end === -1 ? remaining : remaining.slice(0, end + 2);
			tokens.push({ type: 'comment', value });
			pos += value.length;
			continue;
		}

		const stringMatch = remaining.match(/^(['"`])(?:[^\\]|\\.)*?\1/);
		if (stringMatch) {
			tokens.push({ type: 'string', value: stringMatch[0] });
			pos += stringMatch[0].length;
			continue;
		}

		if (remaining.startsWith('`')) {
			let value = '`';
			let i = 1;
			while (i < remaining.length) {
				if (remaining[i] === '`' && remaining[i - 1] !== '\\') {
					value += '`';
					break;
				}
				value += remaining[i] ?? '';
				i++;
			}
			tokens.push({ type: 'string', value });
			pos += value.length;
			continue;
		}

		const numMatch = remaining.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/);
		if (numMatch) {
			tokens.push({ type: 'number', value: numMatch[0] });
			pos += numMatch[0].length;
			continue;
		}

		const identMatch = remaining.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
		if (identMatch) {
			const word = identMatch[0];
			if (JS_KEYWORDS.has(word)) {
				tokens.push({ type: 'keyword', value: word });
			} else if (/^[A-Z]/.test(word)) {
				tokens.push({ type: 'class', value: word });
			} else if (remaining.slice(word.length).trimStart().startsWith('(')) {
				tokens.push({ type: 'function', value: word });
			} else {
				tokens.push({ type: 'variable', value: word });
			}
			pos += word.length;
			continue;
		}

		const opMatch = remaining.match(
			/^(===|!==|==|!=|<=|>=|=>|&&|\|\||[+\-*/%<>=!&|^~?:])/
		);
		if (opMatch) {
			tokens.push({ type: 'operator', value: opMatch[0] });
			pos += opMatch[0].length;
			continue;
		}

		const punctMatch = remaining.match(/^[{}[\]();,.]/);
		if (punctMatch) {
			tokens.push({ type: 'punctuation', value: punctMatch[0] });
			pos += punctMatch[0].length;
			continue;
		}

		tokens.push({ type: 'text', value: remaining[0] ?? '' });
		pos++;
	}

	return tokens;
};

const tokenizeCSS = (code: string): HighlightToken[] => {
	const tokens: HighlightToken[] = [];
	let pos = 0;

	while (pos < code.length) {
		const remaining = code.slice(pos);

		if (remaining.startsWith('/*')) {
			const end = remaining.indexOf('*/');
			const value = end === -1 ? remaining : remaining.slice(0, end + 2);
			tokens.push({ type: 'comment', value });
			pos += value.length;
			continue;
		}

		const selectorMatch = remaining.match(/^[.#]?[a-zA-Z_-][a-zA-Z0-9_-]*/);
		if (selectorMatch && !remaining.startsWith(':')) {
			const word = selectorMatch[0];
			if (CSS_KEYWORDS.has(word)) {
				tokens.push({ type: 'keyword', value: word });
			} else if (word.startsWith('.') || word.startsWith('#')) {
				tokens.push({ type: 'selector', value: word });
			} else {
				tokens.push({ type: 'property', value: word });
			}
			pos += word.length;
			continue;
		}

		const valueMatch = remaining.match(
			/^#[0-9a-fA-F]{3,8}|-?\d+(\.\d+)?(px|em|rem|%|vh|vw|deg|s|ms)?/
		);
		if (valueMatch) {
			tokens.push({ type: 'number', value: valueMatch[0] });
			pos += valueMatch[0].length;
			continue;
		}

		const stringMatch = remaining.match(/^(['"])(?:[^\\]|\\.)*?\1/);
		if (stringMatch) {
			tokens.push({ type: 'string', value: stringMatch[0] });
			pos += stringMatch[0].length;
			continue;
		}

		const punctMatch = remaining.match(/^[{}();:,]/);
		if (punctMatch) {
			tokens.push({ type: 'punctuation', value: punctMatch[0] });
			pos += punctMatch[0].length;
			continue;
		}

		tokens.push({ type: 'text', value: remaining[0] ?? '' });
		pos++;
	}

	return tokens;
};

const tokenizeHTML = (code: string): HighlightToken[] => {
	const tokens: HighlightToken[] = [];
	let pos = 0;

	while (pos < code.length) {
		const remaining = code.slice(pos);

		if (remaining.startsWith('<!--')) {
			const end = remaining.indexOf('-->');
			const value = end === -1 ? remaining : remaining.slice(0, end + 3);
			tokens.push({ type: 'comment', value });
			pos += value.length;
			continue;
		}

		const tagMatch = remaining.match(/^<\/?[a-zA-Z][a-zA-Z0-9]*/);
		if (tagMatch) {
			tokens.push({ type: 'tag', value: tagMatch[0] });
			pos += tagMatch[0].length;
			continue;
		}

		const attrMatch = remaining.match(/^[a-zA-Z_-][a-zA-Z0-9_-]*(?==)/);
		if (attrMatch) {
			tokens.push({ type: 'attr-name', value: attrMatch[0] });
			pos += attrMatch[0].length;
			continue;
		}

		const valueMatch = remaining.match(/^=["'][^"']*["']/);
		if (valueMatch) {
			tokens.push({ type: 'attr-value', value: valueMatch[0] });
			pos += valueMatch[0].length;
			continue;
		}

		if (remaining.startsWith('>') || remaining.startsWith('/>')) {
			const value = remaining.startsWith('/>') ? '/>' : '>';
			tokens.push({ type: 'punctuation', value });
			pos += value.length;
			continue;
		}

		tokens.push({ type: 'text', value: remaining[0] ?? '' });
		pos++;
	}

	return tokens;
};

const getTokenizer = (
	language: string | undefined
): ((code: string) => HighlightToken[]) => {
	switch (language?.toLowerCase()) {
		case 'javascript':
		case 'js':
		case 'typescript':
		case 'ts':
		case 'tsx':
		case 'jsx':
			return tokenizeJS;
		case 'css':
		case 'scss':
		case 'less':
			return tokenizeCSS;
		case 'html':
		case 'xml':
		case 'svg':
			return tokenizeHTML;
		default:
			return tokenizeJS;
	}
};

const tokenToClass = (type: TokenType): string => `ink-hl-${type}`;

export const highlight = (code: string, language?: string): EffuseChild[] => {
	const tokenizer = getTokenizer(language);
	const tokens = tokenizer(code);

	return tokens.map((token) => {
		if (token.type === 'text') {
			return token.value;
		}

		return CreateElementNode({
			[EFFUSE_NODE]: true,
			tag: 'span',
			props: { class: tokenToClass(token.type) },
			children: [token.value],
		});
	});
};

export const highlightToString = (code: string, language?: string): string => {
	const tokenizer = getTokenizer(language);
	const tokens = tokenizer(code);

	return tokens
		.map((token) => {
			if (token.type === 'text') {
				return escapeHtml(token.value);
			}
			return `<span class="${tokenToClass(token.type)}">${escapeHtml(token.value)}</span>`;
		})
		.join('');
};

const escapeHtml = (str: string): string =>
	str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
