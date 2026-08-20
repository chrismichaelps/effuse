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
 * How a server writes and reads one scalar the catalog names.
 *
 * A scalar the language does not define is opaque: the catalog says a value
 * of this type exists, and only the server knows what one is. Without a
 * definition it travels untouched, which is right for a type that is already
 * JSON. Give it one and the two directions become explicit - what a resolver
 * hands back becomes what goes on the wire, and what a caller sent becomes
 * what a resolver is handed.
 *
 * Either may throw to refuse a value. What it throws becomes the problem
 * reported, so say what was wrong with the value rather than that there was
 * something wrong with it.
 */
export interface NexScalar {
	/** What a resolver returned, as it should go on the wire. */
	readonly serialize: (value: unknown) => unknown;
	/** What a caller sent, as a resolver should receive it. */
	readonly parse: (value: unknown) => unknown;
}

/** The scalars a server defines, by the name the catalog gives each. */
export type NexScalars = Readonly<Record<string, NexScalar>>;
