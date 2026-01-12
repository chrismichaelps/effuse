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

import { Effect, Option, pipe, Predicate } from 'effect';
import type { EffuseChild } from '../render/node.js';
import { define } from '../blueprint/define.js';
import { pushContext, popContext, getContext } from './registry.js';
import { ContextNotFoundError } from './errors.js';

export interface ContextOptions<T> {
	readonly id: string;
	readonly defaultValue?: T | (() => T);
	readonly displayName?: string;
}

export interface ProviderProps<T> {
	readonly value: T;
	readonly children: EffuseChild;
}

export interface EffuseContext<T> {
	readonly id: string;
	readonly displayName: string;
	readonly Provider: ReturnType<typeof define>;
	readonly defaultValue: T | undefined;
	readonly hasDefault: boolean;
	readonly _tag: 'EffuseContext';
}

const createdContexts = new Map<string, EffuseContext<unknown>>();

const resolveDefaultValue = <T>(defaultValue?: T | (() => T)): T | undefined =>
	Predicate.isFunction(defaultValue)
		? (defaultValue as () => T)()
		: defaultValue;

export function createContext<T>(options: ContextOptions<T>): EffuseContext<T> {
	const { id, defaultValue, displayName = id } = options;

	const existing = createdContexts.get(id);
	if (existing && typeof window !== 'undefined') {
		return existing as EffuseContext<T>;
	}

	const resolvedDefault = resolveDefaultValue(defaultValue);

	const Provider = define<ProviderProps<T>>({
		script: ({ props, onMount }) => {
			onMount(() => {
				pushContext(id, props.value);

				return () => {
					popContext(id);
				};
			});

			return {};
		},
		template: ({ children }) => children,
	});

	const context: EffuseContext<T> = {
		id,
		displayName,
		Provider: Provider as ReturnType<typeof define>,
		defaultValue: resolvedDefault,
		hasDefault: defaultValue !== undefined,
		_tag: 'EffuseContext',
	};

	createdContexts.set(id, context as EffuseContext<unknown>);

	return context;
}

const getContextValue = <T>(
	context: EffuseContext<T>
): Effect.Effect<T, ContextNotFoundError> =>
	Effect.gen(function* () {
		const value = getContext<T>(context.id);

		return yield* pipe(
			value,
			Option.match({
				onSome: (v) => Effect.succeed(v),
				onNone: () =>
					context.hasDefault
						? Effect.succeed(context.defaultValue as T)
						: Effect.fail(new ContextNotFoundError({ contextId: context.id })),
			})
		);
	});

export function useContext<T>(
	context: EffuseContext<T>,
	componentName?: string
): T {
	return Effect.runSync(
		pipe(
			getContextValue(context),
			Effect.mapError((error) =>
				componentName
					? new ContextNotFoundError({
							contextId: error.contextId,
							componentName,
						})
					: error
			)
		)
	);
}

export function hasContextValue<T>(context: EffuseContext<T>): boolean {
	return Effect.runSync(
		Effect.sync(() => {
			const value = getContext<T>(context.id);
			return Option.isSome(value) || context.hasDefault;
		})
	);
}

export const isEffuseContext = (
	value: unknown
): value is EffuseContext<unknown> =>
	Predicate.isObject(value) &&
	Predicate.hasProperty(value, '_tag') &&
	value._tag === 'EffuseContext';
