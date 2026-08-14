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

import { Context, Effect, Layer, Predicate } from 'effect';
import type { Signal } from '../../reactivity/signal.js';
import { isSignal } from '../../reactivity/signal.js';
import { watchEffect } from '../../effects/effect.js';
import type { EffectHandle } from '../../types/index.js';
import { applyRef, isRefCallback, isRefObject } from '../../refs/ref.js';
import type { Ref } from '../../refs/types.js';
import { applyDirective } from '../../refs/directive.js';
import {
	getDOMNamespace,
	normalizeDOMAttributeName,
} from '../../render/attribute-name.js';
import { normalizeClassValue } from '../../render/class-value.js';
import { isEventHandlerName } from '../../render/event-prop.js';

export interface PropBindingResult {
	cleanup: () => void;
}

type FormValue = string | number | boolean;
type FormValueSource = Signal<FormValue> | (() => FormValue);

export interface PropServiceInterface {
	readonly bindProp: (
		element: Element,
		key: string,
		value: unknown
	) => Effect.Effect<PropBindingResult>;

	readonly bindFormControl: (
		element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
		source: FormValueSource
	) => Effect.Effect<PropBindingResult>;
}

export class PropService extends Context.Tag('effuse/PropService')<
	PropService,
	PropServiceInterface
>() {}

const boundElementRefs = new WeakMap<Element, Ref>();

const isRef = (value: unknown): value is Ref =>
	isRefCallback(value) || isRefObject(value);

const clearElementRef = (element: Element): void => {
	const current = boundElementRefs.get(element);
	if (current) {
		boundElementRefs.delete(element);
		applyRef(current, null);
	}
};

export const patchElementRef = (element: Element, next: unknown): void => {
	const current = boundElementRefs.get(element);
	if (current === next) return;
	clearElementRef(element);
	if (isRef(next)) {
		boundElementRefs.set(element, next);
		try {
			applyRef(next, element);
		} catch (error) {
			if (boundElementRefs.get(element) === next) {
				boundElementRefs.delete(element);
			}
			throw error;
		}
	}
};

const setElementProp = (
	element: Element,
	key: string,
	value: unknown
): void => {
	if (key === 'class' || key === 'className') {
		// Shared with the server serializer so both sides flatten objects and
		// arrays identically; handling only strings here silently dropped every
		// conditional class on the client.
		element.className = value == null ? '' : normalizeClassValue(value);
		return;
	}

	if (key === 'style') {
		const el = element as HTMLElement;
		// The server writes a string style straight through as an attribute, so
		// discarding it here left the element unstyled on any client render.
		if (Predicate.isString(value)) {
			el.style.cssText = value;
			return;
		}
		if (value == null) {
			el.removeAttribute('style');
			return;
		}
		if (Predicate.isObject(value)) {
			const styles = value as Record<string, string | number>;
			for (const [prop, val] of Object.entries(styles)) {
				const cssProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
				el.style.setProperty(cssProp, String(val));
			}
		}
		return;
	}

	if (key === 'value') {
		const inputEl = element as HTMLInputElement | HTMLTextAreaElement;
		let stringValue = '';
		if (Predicate.isString(value)) {
			stringValue = value;
		} else if (Predicate.isNumber(value)) {
			stringValue = String(value);
		}
		if (inputEl.value !== stringValue) {
			inputEl.value = stringValue;
		}
		return;
	}

	if (key === 'checked') {
		(element as HTMLInputElement).checked = Boolean(value);
		return;
	}
	const attributeName = normalizeDOMAttributeName(
		key,
		getDOMNamespace(element.namespaceURI)
	);

	if (Predicate.isBoolean(value)) {
		if (value) {
			element.setAttribute(attributeName, '');
		} else {
			element.removeAttribute(attributeName);
		}
		return;
	}

	if (value == null) {
		element.removeAttribute(attributeName);
	} else if (Predicate.isString(value) || Predicate.isNumber(value)) {
		element.setAttribute(attributeName, String(value));
	}
};

const getValue = (source: FormValueSource): FormValue => {
	if (isSignal(source)) {
		return (source as Signal<FormValue>).value;
	}
	return (source as () => FormValue)();
};

const bindFormControlImpl = (
	element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
	source: FormValueSource
): PropBindingResult => {
	const cleanups: (() => void)[] = [];
	const tagName = element.tagName.toLowerCase();
	const inputEl = element as HTMLInputElement;
	const inputType = inputEl.type ? inputEl.type.toLowerCase() : '';

	if (inputType === 'checkbox' || inputType === 'radio') {
		const handle: EffectHandle = watchEffect(() => {
			const newVal = Boolean(getValue(source));
			if (inputEl.checked !== newVal) {
				inputEl.checked = newVal;
			}
		});
		cleanups.push(handle.stop);
	} else if (tagName === 'select') {
		const handle: EffectHandle = watchEffect(() => {
			const newVal = String(getValue(source));
			if (element.value !== newVal) {
				element.value = newVal;
			}
		});
		cleanups.push(handle.stop);
	} else {
		const textEl = element as HTMLInputElement | HTMLTextAreaElement;
		const handle: EffectHandle = watchEffect(() => {
			const newVal = String(getValue(source));
			if (textEl.value !== newVal) {
				textEl.value = newVal;
			}
		});
		cleanups.push(handle.stop);
	}

	return {
		cleanup: () => {
			for (const fn of cleanups) {
				fn();
			}
		},
	};
};

const isEventHandler = isEventHandlerName;

const isCompilerGetter = (value: unknown): value is () => unknown => {
	return Predicate.isFunction(value) && value.length === 0;
};

export const PropServiceLive = Layer.succeed(PropService, {
	bindProp: (element: Element, key: string, value: unknown) =>
		Effect.sync(() => {
			if (key === 'ref') {
				if (isRef(value)) {
					patchElementRef(element, value);
				}
				// Detaching on unmount keeps `ref.current` honest and lets the
				// removed element be collected; without it a ref pins a detached
				// node for as long as the ref itself is reachable.
				return { cleanup: () => clearElementRef(element) };
			}
			if (key.startsWith('use:')) {
				const directiveName = key.slice(4);
				const cleanup = applyDirective(directiveName, element, () => value);
				return { cleanup: cleanup ?? (() => {}) };
			}

			if (isEventHandler(key)) {
				if (Predicate.isFunction(value)) {
					const handler = value as EventListener;
					const eventName = key.slice(2).toLowerCase();
					element.addEventListener(eventName, handler);
					return {
						cleanup: () => {
							element.removeEventListener(eventName, handler);
						},
					};
				}
				return {
					cleanup: () => {
						/*  */
					},
				};
			}

			if (isSignal(value)) {
				const sig = value;
				const handle: EffectHandle = watchEffect(() => {
					setElementProp(element, key, sig.value);
				});
				return { cleanup: handle.stop };
			}

			if (isCompilerGetter(value)) {
				const getter = value;
				const handle: EffectHandle = watchEffect(() => {
					const computedValue = getter();
					setElementProp(element, key, computedValue);
				});
				return { cleanup: handle.stop };
			}

			setElementProp(element, key, value);
			return { cleanup: () => {} };
		}),

	bindFormControl: (
		element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
		source: FormValueSource
	) => Effect.sync(() => bindFormControlImpl(element, source)),
});
