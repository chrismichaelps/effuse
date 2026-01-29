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

import { Option, Either, pipe } from 'effect';

const getLocalStorage = (): Option.Option<Storage> =>
	typeof localStorage === 'undefined'
		? Option.none()
		: Option.some(localStorage);

export const readStorage = (key: string): Option.Option<string> =>
	pipe(
		getLocalStorage(),
		Option.flatMap((storage) =>
			Either.match(
				Either.try(() => storage.getItem(key)),
				{
					onLeft: () => Option.none(),
					onRight: (value) =>
						value === null ? Option.none() : Option.some(value),
				}
			)
		)
	);

export const writeStorage = (key: string, value: string): boolean =>
	pipe(
		getLocalStorage(),
		Option.map((storage) =>
			Either.isRight(Either.try(() => storage.setItem(key, value)))
		),
		Option.getOrElse(() => false)
	);

export const removeStorage = (key: string): boolean =>
	pipe(
		getLocalStorage(),
		Option.map((storage) =>
			Either.isRight(Either.try(() => storage.removeItem(key)))
		),
		Option.getOrElse(() => false)
	);

export const isStorageAvailable = (): boolean =>
	pipe(
		getLocalStorage(),
		Option.map((storage) => {
			const testKey = '__effuse_storage_test__';
			return Either.isRight(
				Either.try(() => {
					storage.setItem(testKey, 'test');
					storage.removeItem(testKey);
				})
			);
		}),
		Option.getOrElse(() => false)
	);
