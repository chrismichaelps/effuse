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

import { Predicate } from 'effect';

export interface PropertyLookupResult {
	descriptor: PropertyDescriptor | undefined;
	found: boolean;
}

// Locate property descriptor in prototype chain
export function findPropertyDescriptor(
	obj: object,
	key: string | symbol
): PropertyLookupResult {
	let proto: object | null = obj;

	while (proto !== null) {
		const descriptor = Object.getOwnPropertyDescriptor(proto, key);
		if (descriptor) {
			return { descriptor, found: true };
		}
		proto = Object.getPrototypeOf(proto) as object | null;
	}

	return { descriptor: undefined, found: false };
}

// Access property value with private field support
export function getPropertyWithPrivateFieldSupport(
	target: object,
	key: string | symbol
): unknown {
	const { descriptor, found } = findPropertyDescriptor(target, key);

	if (found && descriptor) {
		if (descriptor.get) {
			return descriptor.get.call(target);
		} else if ('value' in descriptor) {
			return descriptor.value;
		}
	}

	return Reflect.get(target, key, target);
}

// Update property value with private field support
export function setPropertyWithPrivateFieldSupport(
	target: object,
	key: string | symbol,
	value: unknown
): boolean {
	const { descriptor, found } = findPropertyDescriptor(target, key);

	if (
		found &&
		Predicate.isNotNullable(descriptor) &&
		Predicate.isFunction(descriptor.set) // eslint-disable-line @typescript-eslint/unbound-method
	) {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		Reflect.apply(descriptor.set, target, [value]);
		return true;
	}

	return Reflect.set(target, key, value, target);
}

// Bind method to reactive target
export function bindMethodToTarget<T>(method: T, target: object): T {
	if (Predicate.isFunction(method)) {
		return method.bind(target) as T;
	}
	return method;
}

// Access current property value
export function getCurrentValue(target: object, key: string | symbol): unknown {
	return getPropertyWithPrivateFieldSupport(target, key);
}
