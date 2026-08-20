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

import { NexSyntaxError } from '../errors/index.js';
import type { DocumentNode } from '../language/ast/index.js';
import { getOperation, separateOperations } from '../language/documents.js';
import { Kind } from '../language/kinds/index.js';
import { parse } from './parse.js';
import { print } from './print.js';

/** Which operation of a document to keep. */
export interface NormalizeOptions {
	/** The operation to keep, when the document holds several. */
	readonly operationName?: string | undefined;
}

/**
 * Write a request in one canonical form.
 *
 * Two requests that run the same way normalize to the same string, whatever
 * the spacing and comments were, and only the operation asked for survives,
 * with the fragments it reaches. That is what makes a request nameable: the
 * same request always gets the same name.
 *
 * @throws {NexSyntaxError} when the source does not parse, or the document
 * holds no operation to run.
 */
export const normalizeRequest = (
	input: string | DocumentNode,
	options: NormalizeOptions = {}
): string => {
	const document = typeof input === 'string' ? parse(input) : input;
	const operation = getOperation(document, options.operationName);

	if (operation === undefined) {
		throw new NexSyntaxError({
			message:
				options.operationName === undefined
					? 'This document holds no operation to run'
					: `This document holds no operation named "${options.operationName}"`,
			location: { start: 0, line: 1, column: 1 },
		});
	}

	const key = operation.name?.value ?? '';
	const separated = separateOperations(document)[key];

	return print(separated ?? { kind: Kind.DOCUMENT, definitions: [operation] });
};

const toHex = (digest: ArrayBuffer): string =>
	[...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');

/**
 * Name a request by what it does.
 *
 * The key is the SHA-256 of the normalized request, so a persisted-operation
 * store, a response cache, or a request log can agree on one name for it
 * without agreeing on formatting. Hashing goes through the platform's own
 * crypto, which every runtime this package targets provides.
 */
export const requestKey = async (
	input: string | DocumentNode,
	options: NormalizeOptions = {}
): Promise<string> => {
	const normalized = normalizeRequest(input, options);
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(normalized)
	);

	return toHex(digest);
};
