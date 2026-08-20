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

import type { BinaryOperator } from '../ast/index.js';
import { OperationType } from '../kinds/index.js';
import { TokenKind } from '../token/index.js';
import { KEYWORD } from './keywords.js';

export const OPERATION_KEYWORDS: ReadonlyMap<string, OperationType> = new Map([
	[OperationType.QUERY, OperationType.QUERY],
	[OperationType.MUTATION, OperationType.MUTATION],
	[OperationType.LIVE, OperationType.LIVE],
]);

export const COMPARISON_OPERATORS: ReadonlyMap<TokenKind, BinaryOperator> =
	new Map([
		[TokenKind.EQUALS_EQUALS, '=='],
		[TokenKind.BANG_EQUALS, '!='],
		[TokenKind.LT, '<'],
		[TokenKind.LT_EQUALS, '<='],
		[TokenKind.GT, '>'],
		[TokenKind.GT_EQUALS, '>='],
	]);

/** Keywords that open a definition describing the catalog. */
export const TYPE_SYSTEM_KEYWORDS: ReadonlySet<string> = new Set([
	KEYWORD.SCHEMA,
	KEYWORD.SCALAR,
	KEYWORD.TYPE,
	KEYWORD.INTERFACE,
	KEYWORD.UNION,
	KEYWORD.ENUM,
	KEYWORD.INPUT,
	KEYWORD.DIRECTIVE,
]);
