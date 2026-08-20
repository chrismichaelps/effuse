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

/**
 * What kind of problem an error reports.
 *
 * A client branches on the code, never on the message: messages are written
 * for people and change as they are improved, while a code is a promise.
 */
export const NexErrorCode = {
	/** The source could not be read as a document. */
	SYNTAX: 'SYNTAX',
	/** The catalog itself does not hold together. */
	CATALOG: 'CATALOG',
	/** The request does not agree with the catalog. */
	VALIDATION: 'VALIDATION',
	/** The request is priced above what the server allows. */
	COST_LIMIT: 'COST_LIMIT',
	/** The request nests deeper than the server allows. */
	DEPTH_LIMIT: 'DEPTH_LIMIT',
	/** A variable was missing, or its value does not fit its type. */
	VARIABLE: 'VARIABLE',
	/** A resolver threw. */
	RESOLVER: 'RESOLVER',
	/** A field the catalog declares non-null produced null. */
	NON_NULL: 'NON_NULL',
	/** A cursor was not one this server handed out. */
	CURSOR: 'CURSOR',
	/** The catalog guards this field, and the caller was not allowed it. */
	FORBIDDEN: 'FORBIDDEN',
	/** The caller went away, or the run was called off. */
	ABORTED: 'ABORTED',
	/** Anything else that went wrong while running. */
	INTERNAL: 'INTERNAL',
} as const;

export type NexErrorCode = (typeof NexErrorCode)[keyof typeof NexErrorCode];
