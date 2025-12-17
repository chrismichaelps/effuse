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

import { Dep, isTracking } from './dep.js';
import { REACTIVE_MARKER } from '../constants.js';
import {
	getPropertyWithPrivateFieldSupport,
	setPropertyWithPrivateFieldSupport,
	bindMethodToTarget,
	getCurrentValue,
} from './proxy-utils.js';

const reactiveMap = new WeakMap<object, object>();
const proxyToRaw = new WeakMap<object, object>();

export type Reactive<T extends object> = T & {
	readonly [REACTIVE_MARKER]: true;
};

const isMarkedRaw = (obj: object): boolean => {
	return (
		Object.prototype.hasOwnProperty.call(obj, REACTIVE_MARKER) &&
		(obj as Record<symbol, unknown>)[REACTIVE_MARKER] === false
	);
};

export const reactive = <T extends object>(target: T): Reactive<T> => {
	if (isMarkedRaw(target)) {
		return target as Reactive<T>;
	}

	const existingProxy = reactiveMap.get(target);
	if (existingProxy) {
		return existingProxy as Reactive<T>;
	}

	const deps = new Map<string | symbol, Dep>();

	const iterateDep = new Dep();

	const getOrCreateDep = (key: string | symbol): Dep => {
		let dep = deps.get(key);
		if (!dep) {
			dep = new Dep();
			deps.set(key, dep);
		}
		return dep;
	};

	const handler: ProxyHandler<T> = {
		get(obj, key, _receiver) {
			if (key === REACTIVE_MARKER) {
				return true;
			}

			const value = getPropertyWithPrivateFieldSupport(obj, key);

			const dep = getOrCreateDep(key);
			dep.track();

			const boundValue = bindMethodToTarget(value, obj);

			if (typeof boundValue === 'object' && boundValue !== null) {
				if (isMarkedRaw(boundValue as object)) {
					return boundValue;
				}
				return reactive(boundValue as object);
			}

			return boundValue;
		},

		set(obj, key, value, _receiver) {
			const oldValue = getCurrentValue(obj, key);
			const hadKey = Reflect.has(obj, key);

			if (!Object.is(oldValue, value)) {
				const result = setPropertyWithPrivateFieldSupport(obj, key, value);

				const dep = getOrCreateDep(key);
				dep.trigger();

				if (!hadKey) {
					iterateDep.trigger();
				}

				return result;
			}

			return true;
		},

		deleteProperty(obj, key) {
			const hadKey = Reflect.has(obj, key);
			const result = Reflect.deleteProperty(obj, key);

			if (hadKey && result) {
				const dep = deps.get(key);
				if (dep) {
					dep.trigger();
					deps.delete(key);
				}
				iterateDep.trigger();
			}

			return result;
		},

		has(obj, key) {
			if (key !== REACTIVE_MARKER && isTracking()) {
				getOrCreateDep(key).track();
			}
			return Reflect.has(obj, key);
		},

		ownKeys(obj) {
			iterateDep.track();
			return Reflect.ownKeys(obj);
		},
	};

	const proxy = new Proxy(target, handler) as Reactive<T>;
	reactiveMap.set(target, proxy);
	proxyToRaw.set(proxy, target);

	return proxy;
};

export const isReactive = (value: unknown): value is Reactive<object> => {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as Record<symbol, unknown>)[REACTIVE_MARKER] === true
	);
};

export const toRaw = <T extends object>(observed: T): T => {
	const raw = proxyToRaw.get(observed);
	return raw !== undefined ? (raw as T) : observed;
};

export const markRaw = <T extends object>(value: T): T => {
	Object.defineProperty(value, REACTIVE_MARKER, {
		value: false,
		writable: false,
		enumerable: false,
	});
	return value;
};
