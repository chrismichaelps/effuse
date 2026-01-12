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

import type { EffuseNode, EffuseChild } from '../render/node.js';
import { createListNode } from '../render/node.js';
import type { Signal } from '../types/index.js';
import { signal, getSignalDep } from '../reactivity/index.js';
import { Data, Option, Either, pipe, Predicate } from 'effect';

type AwaitState<T> = Data.TaggedEnum<{
	Pending: object;
	Success: { readonly data: T };
	Failure: { readonly error: unknown };
}>;

interface AwaitStateDefinition extends Data.TaggedEnum.WithGenerics<1> {
	readonly taggedEnum: AwaitState<this['A']>;
}

const AwaitState = Data.taggedEnum<AwaitStateDefinition>();

export interface AwaitProps<T> {
	readonly promise: Promise<T> | (() => Promise<T>) | Signal<Promise<T>>;
	readonly pending?: EffuseChild | (() => EffuseChild);
	readonly error?: EffuseChild | ((error: unknown) => EffuseChild);
	readonly children: (data: T) => EffuseChild;
}

const isSignalLike = <T>(val: unknown): val is Signal<T> =>
	Predicate.isObject(val) && Predicate.hasProperty(val, 'value');

const isPromiseFn = Predicate.isFunction;

const resolveChild = (
	child: EffuseChild | (() => EffuseChild) | undefined
): Option.Option<EffuseChild> =>
	pipe(
		child,
		Option.fromNullable,
		Option.map((c) => (Predicate.isFunction(c) ? c() : c))
	);

const resolveErrorChild = (
	child: EffuseChild | ((err: unknown) => EffuseChild) | undefined,
	error: unknown
): Option.Option<EffuseChild> =>
	pipe(
		child,
		Option.fromNullable,
		Option.map((c) => (Predicate.isFunction(c) ? c(error) : c))
	);

const optionToArray = <A>(opt: Option.Option<A>): A[] =>
	Option.isSome(opt) ? [opt.value] : [];

const promiseToEither = <T>(
	promise: Promise<T>
): Promise<Either.Either<T, unknown>> =>
	promise.then(Either.right).catch((e: unknown) => Either.left(e));

export const Await = <T>(props: AwaitProps<T>): EffuseNode => {
	const {
		promise: promiseInput,
		pending,
		error: errorFallback,
		children: renderSuccess,
	} = props;

	const state = signal<AwaitState<T>>(AwaitState.Pending() as AwaitState<T>);
	let currentPromiseId = 0;

	const startFetch = (promise: Promise<T>): void => {
		const promiseId = ++currentPromiseId;

		void promiseToEither(promise).then((result) => {
			if (promiseId !== currentPromiseId) return;

			state.value = pipe(
				result,
				Either.match({
					onLeft: (error) => AwaitState.Failure({ error }),
					onRight: (data) => AwaitState.Success({ data }),
				})
			);
		});
	};

	const getPromise = (): Promise<T> => {
		if (isSignalLike<Promise<T>>(promiseInput)) {
			return promiseInput.value;
		}
		if (isPromiseFn(promiseInput)) {
			return promiseInput();
		}
		return promiseInput;
	};

	startFetch(getPromise());

	if (isSignalLike<Promise<T>>(promiseInput)) {
		const dep = getSignalDep(promiseInput);
		if (dep) {
			dep.subscribe(() => {
				startFetch(promiseInput.value);
			});
		}
	}

	const listNode = createListNode([]);

	Object.defineProperty(listNode, 'children', {
		enumerable: true,
		configurable: true,
		get() {
			return pipe(
				state.value,
				AwaitState.$match({
					Pending: () => optionToArray(resolveChild(pending)),
					Failure: ({ error }) =>
						optionToArray(resolveErrorChild(errorFallback, error)),
					Success: ({ data }) => [renderSuccess(data)],
				})
			);
		},
	});

	return listNode;
};
