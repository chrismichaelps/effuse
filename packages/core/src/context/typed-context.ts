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

import {
	getCurrentProvideScope,
	provide as provideValue,
} from '../blueprint/provide-inject.js';
import { ContextNotFoundError } from './errors.js';

/**
 * Typed context over the component provide scope.
 *
 * This replaces a string-keyed, mount-time context with one resolved through
 * the same scope tree the renderer already establishes. Three properties
 * follow, each of which the previous design got wrong:
 *
 * - **Resolved during render, so server rendering works.** A value pushed in
 *   `onMount` is invisible to a server render, which silently produced default
 *   values in SSR output and only corrected after hydration.
 * - **Identity is the token, not a string.** The returned object *is* the key,
 *   so two contexts that happen to share a name are two contexts. A
 *   string-keyed global registry silently merged a library's context with an
 *   application's.
 * - **Scope tree, not a global stack.** Resolution walks parent links, so
 *   nesting shadows correctly and siblings never interfere, independent of
 *   mount ordering.
 *
 * **Reactivity is the point.** Provide a signal or computed rather than a
 * snapshot, and consumers track it directly. Because rendering is fine-grained,
 * a consumer updates only for the values it actually reads — so there is no
 * re-render cascade and no need for a selector API of the kind React requires
 * to work around context invalidating every consumer.
 */
export interface TypedContextOptions<Value> {
	/** Diagnostic name only; it never participates in identity. */
	readonly name: string;
	/** Value returned when no provider is found, instead of throwing. */
	readonly defaultValue?: Value;
}

export interface TypedContext<Value> {
	readonly name: string;
	/** Publishes `value` to this scope and its descendants. */
	provide(value: Value): void;
	/** Reads the value; throws `ContextNotFoundError` when absent. */
	use(componentName?: string): Value;
	/** Reads the value, or `undefined` when absent. */
	useOptional(): Value | undefined;
	/** True when a provider or default can satisfy a read. */
	isProvided(): boolean;
}

export const createTypedContext = <Value>(
	options: TypedContextOptions<Value>
): TypedContext<Value> => {
	const { name } = options;
	const hasDefault = 'defaultValue' in options;
	// Identity lives in this symbol, so two contexts sharing a name stay
	// distinct and no global registry is needed.
	const key = Symbol(`effuse.context.${name}`);

	/** Walks the scope chain; distinguishes "absent" from a stored undefined. */
	const lookup = (): { found: boolean; value: Value | undefined } => {
		let scope = getCurrentProvideScope();
		while (scope) {
			if (scope.values.has(key)) {
				return { found: true, value: scope.values.get(key) as Value };
			}
			scope = scope.parent;
		}
		return { found: false, value: undefined };
	};

	const context: TypedContext<Value> = {
		name,

		provide(value) {
			if (!getCurrentProvideScope()) {
				throw new ContextNotFoundError({
					contextId: name,
					componentName: 'provide() requires an active component scope',
				});
			}
			provideValue(key, value);
		},

		use(componentName) {
			const { found, value } = lookup();
			if (found) return value as Value;
			if (hasDefault) return options.defaultValue as Value;
			throw new ContextNotFoundError({
				contextId: name,
				...(componentName ? { componentName } : {}),
			});
		},

		useOptional() {
			const { found, value } = lookup();
			if (found) return value;
			return hasDefault ? options.defaultValue : undefined;
		},

		isProvided() {
			return lookup().found || hasDefault;
		},
	};

	return context;
};
