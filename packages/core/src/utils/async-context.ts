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

export interface AsyncContextStorage<T> {
	getStore(): T | undefined;
	run<R>(store: T, callback: () => R): R;
}

type NativeAsyncContextStorageConstructor = new <T>() => AsyncContextStorage<T>;

interface BuiltinModuleLoader {
	getBuiltinModule?: (specifier: string) => unknown;
}

interface NativeAsyncContextModule {
	AsyncLocalStorage?: NativeAsyncContextStorageConstructor;
}

const isPromiseLike = <T>(value: T): value is T & PromiseLike<unknown> =>
	typeof value === 'object' &&
	value !== null &&
	'then' in value &&
	typeof value.then === 'function';

const createNativeAsyncContextStorage = <T>():
	| AsyncContextStorage<T>
	| undefined => {
	const processLike = (globalThis as { process?: BuiltinModuleLoader }).process;
	const getBuiltinModule = processLike?.getBuiltinModule;

	if (typeof getBuiltinModule !== 'function') {
		return undefined;
	}

	const asyncContextModule = getBuiltinModule(
		['async', 'hooks'].join('_')
	) as NativeAsyncContextModule | undefined;
	const NativeAsyncContextStorage = asyncContextModule?.AsyncLocalStorage;

	return typeof NativeAsyncContextStorage === 'function'
		? new NativeAsyncContextStorage<T>()
		: undefined;
};

const createStackAsyncContextStorage = <T>(): AsyncContextStorage<T> => {
	const stack: T[] = [];

	const removeStore = (store: T): void => {
		const last = stack.length - 1;
		if (stack[last] === store) {
			stack.pop();
			return;
		}

		const index = stack.lastIndexOf(store);
		if (index !== -1) {
			stack.splice(index, 1);
		}
	};

	return {
		getStore: () => stack[stack.length - 1],
		run: <R>(store: T, callback: () => R): R => {
			stack.push(store);

			try {
				const result = callback();
				if (isPromiseLike(result)) {
					return Promise.resolve(result).finally(() => {
						removeStore(store);
					}) as R;
				}

				removeStore(store);
				return result;
			} catch (error) {
				removeStore(store);
				throw error;
			}
		},
	};
};

export const createAsyncContextStorage = <T>(): AsyncContextStorage<T> =>
	createNativeAsyncContextStorage<T>() ?? createStackAsyncContextStorage<T>();
