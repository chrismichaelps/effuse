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

import type { Signal } from '../types/index.js';
import type { EffuseChild, EffuseNode } from '../render/node.js';
import type { BlueprintDef } from '../render/node.js';
import type { Reactive } from '../reactivity/reactive.js';
import { EFFUSE_NODE, REACTIVE_MARKER, READONLY_MARKER } from '../constants.js';

export const isSignal = <T>(value: unknown): value is Signal<T> => {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const obj = value as Record<string, unknown>;
	if (!('value' in obj) || !('_dep' in obj)) {
		return false;
	}
	const dep = obj._dep;
	if (typeof dep !== 'object' || dep === null) {
		return false;
	}
	const depObj = dep as Record<string, unknown>;
	return (
		typeof depObj.track === 'function' && typeof depObj.trigger === 'function'
	);
};

export const isReactive = (value: unknown): value is Reactive<object> => {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as Record<symbol, unknown>)[REACTIVE_MARKER] === true
	);
};

export const isReadonly = (value: unknown): boolean => {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as Record<symbol, unknown>)[READONLY_MARKER] === true
	);
};

export const isBlueprint = (value: unknown): value is BlueprintDef => {
	return (
		typeof value === 'object' &&
		value !== null &&
		'_tag' in value &&
		(value as { _tag: unknown })._tag === 'Blueprint'
	);
};

export const isEffuseNode = (value: unknown): value is EffuseNode => {
	return (
		typeof value === 'object' &&
		value !== null &&
		EFFUSE_NODE in value &&
		(value as Record<symbol, unknown>)[EFFUSE_NODE] === true
	);
};

export const isSignalChild = (value: unknown): value is Signal<EffuseChild> => {
	return isSignal(value);
};
