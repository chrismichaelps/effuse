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

import { NexSyntaxError } from '../../errors/index.js';
import { Kind } from '../kinds/index.js';
import { createCursor } from '../parser/context.js';
import { parseName } from '../parser/values.js';
import { TokenKind } from '../token/index.js';
import type { CoordinateNode } from './ast.js';

/**
 * Read a coordinate: `Type`, `Type.member`, `Type.member(argument:)`,
 * `@directive`, or `@directive(argument:)`.
 *
 * @throws {NexSyntaxError} when the source is not one of those five shapes.
 */
export const parseCoordinate = (source: string): CoordinateNode => {
	try {
		return readCoordinate(source);
	} catch (cause) {
		// The grammar underneath reports what it wanted next, which is useful
		// but says nothing about what the caller was trying to write.
		const detail = cause instanceof Error ? cause.message : String(cause);
		throw new NexSyntaxError({
			message: `${JSON.stringify(source)} is not a coordinate: ${detail}`,
			location:
				cause instanceof NexSyntaxError
					? cause.location
					: { start: 0, line: 1, column: 1 },
			...(cause instanceof NexSyntaxError && cause.excerpt !== undefined
				? { excerpt: cause.excerpt }
				: {}),
		});
	}
};

const readCoordinate = (source: string): CoordinateNode => {
	const cursor = createCursor(source);
	const startToken = cursor.peek();

	const finish = <T extends CoordinateNode>(node: T): T => {
		if (!cursor.at(TokenKind.EOF)) {
			cursor.fail(
				`A coordinate ends after what it names, found ${cursor.describe(cursor.peek())}`
			);
		}
		return { ...node, loc: cursor.locate(startToken) };
	};

	const parseArgumentName = (): ReturnType<typeof parseName> => {
		cursor.expect(TokenKind.PAREN_L);
		const argument = parseName(cursor);
		cursor.expect(TokenKind.COLON);
		cursor.expect(TokenKind.PAREN_R);
		return argument;
	};

	if (cursor.at(TokenKind.AT)) {
		cursor.advance();
		const name = parseName(cursor);

		if (!cursor.at(TokenKind.PAREN_L)) {
			return finish({ kind: Kind.DIRECTIVE_COORDINATE, name });
		}

		return finish({
			kind: Kind.DIRECTIVE_ARGUMENT_COORDINATE,
			name,
			argument: parseArgumentName(),
		});
	}

	if (cursor.at(TokenKind.EOF)) {
		throw new NexSyntaxError({
			message: 'A coordinate must name something',
			location: { start: 0, line: 1, column: 1 },
		});
	}

	const name = parseName(cursor);

	if (!cursor.at(TokenKind.DOT)) {
		return finish({ kind: Kind.TYPE_COORDINATE, name });
	}
	cursor.advance();

	const member = parseName(cursor);

	if (!cursor.at(TokenKind.PAREN_L)) {
		return finish({ kind: Kind.MEMBER_COORDINATE, name, member });
	}

	return finish({
		kind: Kind.ARGUMENT_COORDINATE,
		name,
		member,
		argument: parseArgumentName(),
	});
};
