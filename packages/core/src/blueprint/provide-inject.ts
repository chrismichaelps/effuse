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

import { devWarn } from '../utils/dev-warnings.js';
import { createAsyncContextStorage } from '../utils/async-context.js';
import {
	getCurrentLifecycleErrorHandler,
	type LifecycleErrorHandler,
} from './lifecycle.js';

export interface ProvideScope {
	readonly parent: ProvideScope | null;
	readonly values: Map<symbol | string, unknown>;
	readonly lifecycleErrorHandler: LifecycleErrorHandler | undefined;
}

const provideStorage = createAsyncContextStorage<ProvideScope>();

export const createProvideScope = (
	parent: ProvideScope | null = null
): ProvideScope => ({
	parent,
	values: new Map(),
	lifecycleErrorHandler:
		parent?.lifecycleErrorHandler ?? getCurrentLifecycleErrorHandler(),
});

export const runWithProvideScope = <T>(scope: ProvideScope, fn: () => T): T => {
	return provideStorage.run(scope, fn);
};

export const getCurrentProvideScope = (): ProvideScope | null => {
	return provideStorage.getStore() ?? null;
};

export const provide = <T>(key: symbol | string, value: T): void => {
	const scope = getCurrentProvideScope();
	if (!scope) {
		devWarn(
			'provide() called outside a component scope. ' +
				'Call it inside a script() function.'
		);
		return;
	}
	scope.values.set(key, value);
};

export const inject = <T>(
	key: symbol | string,
	defaultValue?: T
): T | undefined => {
	let scope = getCurrentProvideScope();
	while (scope) {
		if (scope.values.has(key)) {
			return scope.values.get(key) as T;
		}
		scope = scope.parent;
	}
	if (defaultValue === undefined) {
		devWarn(
			`inject(${typeof key === 'symbol' ? key.toString() : `"${key}"`}) ` +
				`returned undefined because no provider was found. ` +
				`Pass a default value, or ensure a parent component calls provide().`
		);
	}
	return defaultValue;
};
