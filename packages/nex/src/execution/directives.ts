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

import type { ResolverInfo } from './resolvers.js';

/** What a directive is given when it wraps a field. */
export interface DirectiveContext<TContext = unknown> {
	/** What the directive itself was written with, already read. */
	readonly arguments: Readonly<Record<string, unknown>>;
	/** The value the field is being resolved from. */
	readonly source: unknown;
	/** What the field was asked with. */
	readonly fieldArguments: Readonly<Record<string, unknown>>;
	/** Whatever the run was given as its context. */
	readonly context: TContext;
	/** Which field this is, and everything else a resolver is told. */
	readonly info: ResolverInfo;
}

/**
 * What a directive does when a field carries it.
 *
 * A catalog can declare a directive and this package will check that it is
 * used where it is allowed - but a declaration on its own does nothing, and a
 * schema author marking a field `@upper` reasonably expects something to
 * happen. This is where a server says what.
 *
 * `next` produces what the field would have answered with. A directive may
 * change that, replace it, or not call `next` at all - which is how one that
 * answers from a cache, or refuses, is written.
 */
export interface NexDirective<TContext = unknown> {
	readonly onField?:
		| ((
				next: () => Promise<unknown>,
				context: DirectiveContext<TContext>
		  ) => unknown)
		| undefined;
}

/** The directives a server gave meaning to, by name without the `@`. */
export type NexDirectives<TContext = unknown> = Readonly<
	Record<string, NexDirective<TContext>>
>;
