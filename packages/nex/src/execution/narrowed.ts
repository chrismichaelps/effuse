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

const ALREADY = Symbol.for('nex.alreadyNarrowed');

interface Narrowed {
	readonly [ALREADY]: true;
	readonly value: unknown;
}

/**
 * Say that a resolver has already applied the pipeline it was given.
 *
 * A resolver is told the stages written on its field so it can push them down
 * to whatever it reads from - a database that can `LIMIT`, a service that can
 * page. Having done that, the rows it hands back are already narrowed, and
 * applying the pipeline again here would narrow what was narrowed.
 *
 * Wrap the answer in this and the stages are not applied a second time. What
 * is inside is taken as the finished shape of the field, page and all.
 *
 * ```ts
 * posts: (_source, _args, _context, info) =>
 *   alreadyNarrowed(await db.posts.page(info.pipeline));
 * ```
 */
export const alreadyNarrowed = <TValue>(value: TValue): TValue =>
	({ [ALREADY]: true, value }) as unknown as TValue;

/** What a resolver handed back, and whether it had already been narrowed. */
export const readNarrowed = (
	value: unknown
): { readonly narrowed: boolean; readonly value: unknown } => {
	if (typeof value !== 'object' || value === null || !(ALREADY in value)) {
		return { narrowed: false, value };
	}

	return { narrowed: true, value: (value as Narrowed).value };
};
