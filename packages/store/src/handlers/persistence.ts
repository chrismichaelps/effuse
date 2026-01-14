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

import { Option } from 'effect';

export interface StorageHandlerDeps {
	storage: Map<string, string>;
}

export interface StorageGetInput {
	key: string;
}

export interface StorageSetInput {
	key: string;
	value: string;
}

export interface StorageRemoveInput {
	key: string;
}

export const getItem = (
	deps: StorageHandlerDeps,
	input: StorageGetInput
): Option.Option<string> => {
	return Option.fromNullable(deps.storage.get(input.key));
};

export const setItem = (
	deps: StorageHandlerDeps,
	input: StorageSetInput
): void => {
	deps.storage.set(input.key, input.value);
};

export const removeItem = (
	deps: StorageHandlerDeps,
	input: StorageRemoveInput
): boolean => {
	return deps.storage.delete(input.key);
};

export const hasItem = (
	deps: StorageHandlerDeps,
	input: StorageGetInput
): boolean => {
	return deps.storage.has(input.key);
};

export const clearStorage = (deps: StorageHandlerDeps): void => {
	deps.storage.clear();
};

export const getStorageKeys = (deps: StorageHandlerDeps): string[] => {
	return Array.from(deps.storage.keys());
};

export const getStorageSize = (deps: StorageHandlerDeps): number => {
	return deps.storage.size;
};
